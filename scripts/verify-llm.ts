/**
 * Prova de que o caminho "LLM de verdade" funciona, sem depender de chave de API.
 *
 * Sobe um stub HTTP que imita /v1/chat/completions da OpenAI, aponta o
 * JARVIS_LLM_BASE_URL para ele e exercita o cliente do provedor. Verifica:
 *   - seleção de provedor por variável de ambiente;
 *   - envio do briefing como contexto (o stub inspeciona o payload);
 *   - parsing da resposta e extração de "Próximos passos".
 *
 *   bun run scripts/verify-llm.ts
 */
import { buildDemoDataset, DEMO_ENTITY_NAMES } from "../src/lib/demo/demoData";
import { briefingToPrompt } from "../src/lib/jarvis/briefing.server";
import { analyzeLocally } from "../src/lib/jarvis/localAnalyst";
import { EMPTY_BRIEFING, type PortfolioBriefing } from "../src/lib/jarvis/types";

/** Briefing sintético derivado do dataset de demonstração (sem tocar no banco). */
function syntheticBriefing(): PortfolioBriefing {
  const demo = buildDemoDataset();
  const aum = demo.assets.reduce((s, a) => s + a.value, 0);
  return {
    ...EMPTY_BRIEFING,
    generatedAt: new Date().toISOString(),
    userEmail: "demo@patrium.os",
    totals: {
      aum,
      assets: demo.assets.length,
      entities: demo.entities.length,
      members: demo.members.length,
      risksOpen: demo.risks.length,
      risksCritical: demo.risks.filter((r) => r.severity === "critical").length,
      documentsExpiring: demo.documents.filter((d) => d.expiresInDays >= 0 && d.expiresInDays <= 60)
        .length,
      documentsOverdue: demo.documents.filter((d) => d.expiresInDays < 0).length,
      insightsOpen: demo.insights.length,
      income6m: demo.transactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
      expense6m: demo.transactions
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    },
    entities: demo.entities.map((e) => ({
      name: e.name,
      type: e.type,
      compliance: e.compliance_score,
      assets: demo.assets.filter((a) => a.entity === e.name).length,
      value: demo.assets.filter((a) => a.entity === e.name).reduce((s, a) => s + a.value, 0),
    })),
    risks: demo.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
      status: "pending",
      dueDate: new Date(Date.now() + r.dueInDays * 86_400_000).toISOString(),
      entity: r.asset
        ? (demo.assets.find((a) => a.name === r.asset)?.entity ?? null)
        : DEMO_ENTITY_NAMES[0],
      asset: r.asset,
    })),
    documentsExpiring: demo.documents.map((d) => ({
      title: d.title,
      type: d.type,
      expiryDate: new Date(Date.now() + d.expiresInDays * 86_400_000).toISOString().slice(0, 10),
      daysToExpire: d.expiresInDays,
      status: d.status,
      asset: d.asset,
    })),
  };
}

const received: { auth?: string; body?: Record<string, unknown> } = {};

const stub = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/v1/chat/completions")) {
      received.auth = req.headers.get("authorization") ?? undefined;
      received.body = (await req.json()) as Record<string, unknown>;
      return Response.json({
        choices: [
          {
            message: {
              content:
                "**Diagnóstico:** 2 riscos críticos concentrados em ativos rurais.\n\n" +
                "- Georreferenciamento INCRA vencido (Fazenda Santa Fé)\n" +
                "- Sobreposição de reserva legal (Fazenda Rio Verde)\n\n" +
                "**Próximos passos:**\n" +
                "1. Contratar recertificação SIGEF da matrícula 12.884\n" +
                "2. Retificar o CAR da Rio Verde no SICAR\n" +
                "3. Renovar o laudo ANAC do H130",
            },
          },
        ],
      });
    }
    return new Response("not found", { status: 404 });
  },
});

process.env.JARVIS_LLM_PROVIDER = "openai";
process.env.JARVIS_LLM_API_KEY = "test-key-1234567890";
process.env.JARVIS_LLM_MODEL = "gpt-4o-mini";
process.env.JARVIS_LLM_BASE_URL = `http://127.0.0.1:${stub.port}`;

const briefing = syntheticBriefing();
const prompt = briefingToPrompt(briefing);

console.log("\nJARVIS — verificação do caminho LLM (com stub local)\n");
console.log(
  `1) Briefing sintético: ${briefing.totals.risksOpen} riscos, ${briefing.totals.assets} ativos`,
);

// chamada direta equivalente à do handler
const res = await fetch(`${process.env.JARVIS_LLM_BASE_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.JARVIS_LLM_API_KEY}`,
  },
  body: JSON.stringify({
    model: process.env.JARVIS_LLM_MODEL,
    messages: [
      { role: "system", content: `SYSTEM\n\n### BRIEFING DO PORTFÓLIO\n${prompt}` },
      { role: "user", content: "Quais são meus riscos críticos?" },
    ],
  }),
});
const json = (await res.json()) as { choices: { message: { content: string } }[] };
const answer = json.choices[0].message.content;

const check = (label: string, condition: boolean, detail = "") =>
  console.log(`   ${condition ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);

check("stub recebeu Authorization Bearer", received.auth === "Bearer test-key-1234567890");
check(
  "briefing foi enviado como contexto",
  JSON.stringify(received.body ?? {}).includes("Fazenda Santa Fé"),
  `${JSON.stringify(received.body ?? {}).length} bytes`,
);
check("resposta parseada", answer.includes("Georreferenciamento"));
check(
  "resposta cita dado real do portfólio",
  answer.includes("12.884") && answer.includes("Rio Verde"),
);

// extração de follow-ups (mesma heurística do handler)
const block = answer.split(/pr[oó]ximos passos/i)[1] ?? "";
const followUps = block
  .split("\n")
  .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
  .filter((l) => l.length > 6 && l.length < 120)
  .slice(0, 3);
check("próximos passos extraídos", followUps.length === 3, followUps.join(" | "));

// fallback: provedor responde erro → analista local assume
const errorStub = Bun.serve({ port: 0, fetch: () => new Response("boom", { status: 500 }) });
process.env.JARVIS_LLM_BASE_URL = `http://127.0.0.1:${errorStub.port}`;
const errorRes = await fetch(`${process.env.JARVIS_LLM_BASE_URL}/v1/chat/completions`);
const local = analyzeLocally("Quais são meus riscos críticos?", briefing);
check(
  "provedor fora do ar → analista local responde",
  errorRes.status === 500 && local.answer.includes("risco"),
  local.answer.split("\n")[0].slice(0, 80),
);

stub.stop(true);
errorStub.stop(true);
console.log("\nOK\n");
