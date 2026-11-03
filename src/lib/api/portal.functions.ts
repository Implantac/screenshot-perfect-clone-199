/**
 * Portal do cliente — leitura do retrato patrimonial pelo convidado.
 *
 * Por que isto não é uma query no cliente:
 *
 * As políticas de RLS de `positions`, `liabilities` e `goals` exigem
 * `owns_entity()`. O herdeiro **não** é dono da entidade, então o cliente dele não
 * lê nada — e isso é correto. Ler com privilégio elevado e mandar o objeto inteiro
 * para a tela "esconder" seria pior: o dado trafega, fica no cache do navegador e
 * aparece no devtools.
 *
 * A ordem aqui é: (1) identifica a pessoa pelo JWT, (2) procura o grant ativo
 * daquele e-mail, (3) só então lê os agregados com o client de serviço,
 * (4) resolve a permissão e **redige antes de devolver**. O que a pessoa não pode
 * ver nunca sai do servidor.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolvePortalAccess, type PortalGrant } from "@/lib/portal/access";
import { buildPortalView, type PortalSnapshotInput, type PortalView } from "@/lib/portal/snapshot";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

const CLASS_LABELS: Record<string, string> = {
  caixa: "Caixa",
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  fundos: "Fundos",
  imoveis: "Imóveis",
  internacional: "Internacional",
  alternativos: "Alternativos",
  cripto: "Cripto",
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export type PortalSnapshotResult =
  | { ok: true; view: PortalView }
  | { ok: false; reason: "sem_acesso" | "sem_configuracao"; message: string };

/**
 * Devolve a visão do convidado já resolvida e redigida.
 * Nunca lança por falta de acesso: o portal precisa saber explicar a negativa.
 */
export const getPortalSnapshot = authed.handler(async ({ context }): Promise<PortalSnapshotResult> => {
  const email = String((context.claims as { email?: string })?.email ?? "").toLowerCase();
  if (!email) {
    return { ok: false, reason: "sem_acesso", message: "Sessão sem e-mail: entre com o e-mail que recebeu o convite." };
  }

  let admin: typeof supabaseAdmin;
  try {
    // O getter cria o client de serviço na primeira leitura e lança se faltar env.
    admin = supabaseAdmin;
  } catch {
    return {
      ok: false,
      reason: "sem_configuracao",
      message: "Leitura do portal indisponível: falta SUPABASE_SERVICE_ROLE_KEY no servidor.",
    };
  }

  const { data: grants, error: grantError } = await admin
    .from("portal_grants")
    .select("*")
    .ilike("email", email)
    .order("created_at", { ascending: false });

  if (grantError) {
    return { ok: false, reason: "sem_configuracao", message: grantError.message };
  }
  if (!grants || grants.length === 0) {
    return {
      ok: false,
      reason: "sem_acesso",
      message: "Nenhum acesso foi concedido a este e-mail. Peça ao gestor responsável.",
    };
  }

  const today = new Date();
  // Vale o grant mais permissivo que não esteja suspenso/revogado nem vencido.
  const grant = (grants as PortalGrant[]).find((item) => {
    const access = resolvePortalAccess(item, today);
    return access.allowedSections.length > 0;
  });

  if (!grant) {
    const motivo = (grants as PortalGrant[])[0];
    const access = resolvePortalAccess(motivo, today);
    return {
      ok: false,
      reason: "sem_acesso",
      message:
        access.expired
          ? "Seu acesso venceu. Peça a renovação ao gestor responsável."
          : `Seu acesso está ${motivo.status === "suspenso" ? "suspenso" : "indisponível"} no momento.`,
    };
  }

  const entityId = grant.entity_id as string;
  const [{ data: entity }, { data: positions }, { data: liabilities }, { data: goals }, { data: snapshots }] =
    await Promise.all([
      admin.from("entities").select("name").eq("id", entityId).maybeSingle(),
      admin.from("positions").select("asset_class, quantity, unit_price").eq("entity_id", entityId),
      admin.from("liabilities").select("outstanding").eq("entity_id", entityId),
      admin
        .from("goals")
        .select("name, target_amount, allocated, target_date, expected_return, is_active")
        .eq("entity_id", entityId),
      admin
        .from("portfolio_snapshots")
        .select("as_of, market_value, net_flow")
        .eq("entity_id", entityId)
        .order("as_of", { ascending: true }),
    ]);

  const financial = (positions ?? []).reduce(
    (total: number, row: { quantity: unknown; unit_price: unknown }) =>
      total + num(row.quantity) * num(row.unit_price),
    0,
  );
  const debt = (liabilities ?? []).reduce(
    (total: number, row: { outstanding: unknown }) => total + num(row.outstanding),
    0,
  );

  const byClass = new Map<string, number>();
  for (const row of (positions ?? []) as { asset_class?: string | null; quantity: unknown; unit_price: unknown }[]) {
    const key = String(row.asset_class ?? "outros");
    byClass.set(key, (byClass.get(key) ?? 0) + num(row.quantity) * num(row.unit_price));
  }
  const classes = [...byClass.entries()]
    .map(([key, value]) => ({
      key,
      label: CLASS_LABELS[key] ?? key,
      value,
      percentage: financial > 0 ? (value / financial) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Retorno por fechamentos: variação do patrimônio descontando aporte/resgate.
  const series = (snapshots ?? []).map((row: { as_of: unknown; market_value: unknown; net_flow: unknown }) => ({
    asOf: String(row.as_of).slice(0, 10),
    value: num(row.market_value),
    flow: num(row.net_flow),
  }));
  const yearStart = `${today.getUTCFullYear()}-01-01`;
  const inYear = series.filter((item) => item.asOf >= yearStart);
  const monthPrefix = today.toISOString().slice(0, 7);
  const inMonth = series.filter((item) => item.asOf.startsWith(monthPrefix));
  const returnOf = (list: typeof series) => {
    if (list.length < 2) return 0;
    const first = list[0];
    const last = list[list.length - 1];
    const flows = list.slice(1).reduce((total, item) => total + item.flow, 0);
    const base = first.value + flows;
    if (base <= 0) return 0;
    return ((last.value - base) / base) * 100;
  };

  const goalRows = (goals ?? [])
    .filter((row: { is_active?: boolean | null }) => row.is_active !== false)
    .map((row: { name: unknown; target_amount: unknown; allocated: unknown; expected_return: unknown; target_date: unknown }) => {
      const target = num(row.target_amount);
      const allocated = num(row.allocated);
      return {
        name: String(row.name),
        progressPct: target > 0 ? (allocated / target) * 100 : 0,
        requiredMonthly: monthlyGap(target, allocated, num(row.expected_return), String(row.target_date ?? ""), today),
        targetDate: String(row.target_date ?? "").slice(0, 10) || today.toISOString().slice(0, 10),
      };
    })
    .sort((a, b) => b.progressPct - a.progressPct);

  const input: PortalSnapshotInput = {
    grant,
    entityName: String((entity as { name?: string } | null)?.name ?? "Patrimônio"),
    totals: { financial, registered: 0, debt },
    classes,
    // Atribuição por classe exige série de cotações por ativo — este endpoint
    // entrega só o consolidado. É melhor não mostrar do que mostrar zero: zero
    // parece "não rendeu", e o correto é "não apurado neste fechamento".
    contributions: [],
    monthReturnPct: returnOf(inMonth),
    ytdReturnPct: returnOf(inYear),
    goals: goalRows,
    asOf: series.at(-1)?.asOf ?? today.toISOString().slice(0, 10),
    today: today.toISOString().slice(0, 10),
  };

  return { ok: true, view: buildPortalView(input) };
});

/** Anuidade: aporte mensal para fechar a lacuna no prazo, com o retorno esperado. */
function monthlyGap(target: number, allocated: number, annualRatePct: number, targetDate: string, today: Date): number {
  const missing = Math.max(0, target - allocated);
  if (missing === 0) return 0;
  const months = Math.max(
    1,
    Math.round(
      (Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`) - today.getTime()) / (86_400_000 * 30.44),
    ),
  );
  const monthly = (1 + annualRatePct / 100) ** (1 / 12) - 1;
  if (monthly <= 0) return missing / months;
  return (missing * monthly) / ((1 + monthly) ** months - 1);
}
