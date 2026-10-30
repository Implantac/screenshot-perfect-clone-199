/**
 * Verificação end-to-end contra o projeto Supabase real.
 *
 *   bun run scripts/verify-e2e.ts
 *
 * O que este script prova (e não apenas "compila"):
 *  1. o signup público funciona e o e-mail é auto-confirmado;
 *  2. o seed de demonstração grava 10 tabelas usando o JWT do usuário — ou seja,
 *     os INSERTs passam pelas políticas de RLS de ownership;
 *  3. o briefing do JARVIS é montado com os números reais;
 *  4. o analista local responde com esses números (sem LLM configurado);
 *  5. um segundo usuário NÃO enxerga nada do primeiro (isolamento multi-tenant).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { seedDemoData } from "../src/lib/demo/seedDemo";
import { buildBriefing, briefingToPrompt } from "../src/lib/jarvis/briefing.server";
import { analyzeLocally } from "../src/lib/jarvis/localAnalyst";

const URL_BASE = process.env.SUPABASE_URL ?? "https://gxmgjuzjohqgtzglerpt.supabase.co";
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

if (!ANON) {
  console.error("Defina SUPABASE_PUBLISHABLE_KEY (está no .env do projeto).");
  process.exit(1);
}

const stamp = Date.now().toString(36);
const OWNER_EMAIL = `demo.owner.${stamp}@patrium.qa`;
const GUEST_EMAIL = `demo.guest.${stamp}@patrium.qa`;
const PASSWORD = `Patrium!${stamp}`;

type Client = ReturnType<typeof createClient<Database>>;

function makeClient(): Client {
  return createClient<Database>(URL_BASE, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ok = (label: string, detail = "") =>
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
const bad = (label: string, detail = "") =>
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);

async function signup(client: Client, email: string): Promise<string> {
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
  if (error) throw new Error(`signup ${email}: ${error.message}`);
  if (!data.session) throw new Error(`signup ${email}: sem sessão (confirmação de e-mail ligada?)`);
  return data.session.access_token;
}

async function countRows(
  client: Client,
  table: keyof Database["public"]["Tables"],
): Promise<number> {
  const { data, error } = await client.from(table).select("id");
  if (error) return -1;
  return data?.length ?? 0;
}

async function main() {
  console.log(`\nPATRIUM OS — verificação E2E em ${URL_BASE}\n`);

  // ---------------------------------------------------------------- 1. signup
  console.log("1) Autenticação");
  const owner = makeClient();
  await signup(owner, OWNER_EMAIL);
  ok("signup + sessão imediata", OWNER_EMAIL);

  // ------------------------------------------------------------------ 2. seed
  console.log("\n2) Seed da demonstração (via JWT do usuário, sob RLS)");
  const before = await countRows(owner, "entities");
  ok("tenant começa vazio", `${before} entidades`);

  const result = await seedDemoData(owner);
  if (!result.seeded) throw new Error(`seed não executou: ${result.message}`);
  ok(result.message);
  for (const [table, count] of Object.entries(result.counts ?? {})) {
    console.log(`     · ${table.padEnd(22)} ${count}`);
  }

  const idempotent = await seedDemoData(owner);
  idempotent.seeded
    ? bad("seed deveria ser idempotente")
    : ok("seed idempotente", idempotent.message);

  // -------------------------------------------------------------- 3. briefing
  console.log("\n3) Briefing do JARVIS (dados reais)");
  const briefing = await buildBriefing(owner);
  const t = briefing.totals;
  console.log(
    `     · AUM ${t.aum.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} | ` +
      `${t.assets} ativos | ${t.entities} holdings | ${t.risksOpen} riscos (${t.risksCritical} crít.) | ` +
      `${t.documentsOverdue} docs vencidos | ${t.insightsOpen} insights`,
  );
  if (t.assets === 12 && t.entities === 3 && t.risksOpen === 8)
    ok("números do briefing batem com o dataset");
  else bad("números do briefing divergentes", JSON.stringify(t));

  const prompt = briefingToPrompt(briefing);
  prompt.includes("Fazenda Santa Fé") && prompt.includes("RISCOS ABERTOS")
    ? ok(`contexto para o LLM montado (${prompt.length} chars)`)
    : bad("contexto do LLM incompleto");

  // ------------------------------------------------------- 4. analista local
  console.log("\n4) Analista local (fallback sem LLM)");
  const questions = [
    "Quais são meus riscos críticos?",
    "Quais documentos vencem nos próximos 60 dias?",
    "Resumo do patrimônio",
    "Como está meu compliance?",
    "Como está meu fluxo de caixa?",
  ];
  for (const q of questions) {
    const a = analyzeLocally(q, briefing);
    const firstLine = a.answer.split("\n").find((l) => l.trim().length > 0) ?? "";
    const grounded = /R\$|\d+%|\d+ risco|\d+ documento|\d+ ativo/i.test(a.answer);
    console.log(`     ? ${q}`);
    console.log(`       ${firstLine.slice(0, 120)}`);
    grounded ? ok("resposta ancorada em números") : bad("resposta sem números", q);
  }

  // ------------------------------------------------- 5. isolamento entre tenants
  console.log("\n5) Isolamento multi-tenant (RLS)");
  const guest = makeClient();
  await signup(guest, GUEST_EMAIL);
  const guestCounts = {
    entities: await countRows(guest, "entities"),
    assets: await countRows(guest, "assets"),
    risks: await countRows(guest, "risks"),
    insights: await countRows(guest, "jarvis_insights"),
  };
  const isolated = Object.values(guestCounts).every((c) => c === 0);
  isolated
    ? ok("segundo usuário não vê dados do primeiro", JSON.stringify(guestCounts))
    : bad("VAZAMENTO ENTRE TENANTS", JSON.stringify(guestCounts));

  // tentativa ativa: guest tenta ler um ativo do owner pelo id
  const { data: ownerAssets } = await owner.from("assets").select("id, name").limit(1);
  const targetId = ownerAssets?.[0]?.id;
  if (targetId) {
    const { data: stolen } = await guest.from("assets").select("id, name").eq("id", targetId);
    stolen && stolen.length === 0
      ? ok("leitura direta por ID bloqueada pelo RLS")
      : bad("guest conseguiu ler ativo do owner", JSON.stringify(stolen));
  }

  // anon key sem sessão também não deve ver nada
  const anon = makeClient();
  const anonCount = await countRows(anon, "assets");
  anonCount === 0
    ? ok("anon key sem sessão não lê ativos")
    : bad("anon key lê ativos", String(anonCount));

  console.log(`\nContas de QA criadas (podem ser removidas no painel Authentication):`);
  console.log(`   ${OWNER_EMAIL}`);
  console.log(`   ${GUEST_EMAIL}\n`);
}

main().catch((error) => {
  console.error("\n❌ Falhou:", error);
  process.exit(1);
});
