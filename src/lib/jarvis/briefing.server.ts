/**
 * Monta o briefing patrimonial que alimenta o JARVIS.
 *
 * Server-only (`.server.ts`): nunca é bundlado para o browser.
 * O client Supabase recebido carrega o JWT do usuário, então todo o recorte de
 * dados respeita RLS — o JARVIS só enxerga o patrimônio de quem perguntou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeAllocation } from "@/lib/wealth/allocation";
import { summarizePerformance } from "@/lib/wealth/performance";
import type { Database } from "@/integrations/supabase/types";
import type {
  BriefingAsset,
  BriefingCategory,
  BriefingDocument,
  BriefingEntity,
  BriefingInsight,
  BriefingRisk,
  BriefingCustody,
  PortfolioBriefing,
} from "./types";

const EXPIRING_WINDOW_DAYS = 60;

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(then)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((then - today.getTime()) / 86_400_000);
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export async function buildBriefing(
  supabase: SupabaseClient<Database>,
): Promise<PortfolioBriefing> {
  const [
    { data: auth },
    entitiesRes,
    assetsRes,
    risksRes,
    docsRes,
    insightsRes,
    txRes,
    membersRes,
    positionsRes,
    snapshotsRes,
    flowsRes,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("entities").select("id, name, type, compliance_score"),
    supabase.from("assets").select("name, type, value, status, area, location, entity_id"),
    supabase.from("risks").select("title, severity, status, due_date, entity_id, asset_id"),
    supabase.from("documents").select("title, type, expiry_date, status, asset_id, entity_id"),
    supabase.from("jarvis_insights").select("title, severity, type, is_resolved"),
    supabase
      .from("transactions")
      .select("amount, type, category, transaction_date")
      .gte(
        "transaction_date",
        new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().slice(0, 10),
      ),
    supabase.from("members").select("id, full_name, role"),
    supabase
      .from("positions")
      .select("name, asset_class, liquidity, quantity, unit_price, is_offshore"),
    supabase.from("portfolio_snapshots").select("as_of, market_value, cost_basis, net_flow"),
    supabase.from("cash_flows").select("flow_date, amount, kind"),
  ]);

  const entities = entitiesRes.data ?? [];
  const assets = assetsRes.data ?? [];
  const risks = risksRes.data ?? [];
  const documents = docsRes.data ?? [];
  const insights = insightsRes.data ?? [];
  const transactions = txRes.data ?? [];

  const entityName = new Map<string, string>();
  for (const e of entities) entityName.set(e.id, e.name);
  const assetName = new Map<string, string>();
  for (const a of assets) assetName.set((a as { name: string }).name, a.name);

  const valueOf = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
  const aum = assets.reduce((sum, a) => sum + valueOf(a.value), 0);

  const openRisks = risks.filter((r) => r.status !== "resolved" && r.status !== "ignored");

  const byEntity: BriefingEntity[] = entities.map((e) => {
    const own = assets.filter((a) => a.entity_id === e.id);
    return {
      name: e.name,
      type: e.type,
      compliance: valueOf(e.compliance_score) || 0,
      assets: own.length,
      value: own.reduce((s, a) => s + valueOf(a.value), 0),
    };
  });

  const typeMap = new Map<string, { count: number; value: number }>();
  for (const a of assets) {
    const key = (a.type as string) ?? "outro";
    const cur = typeMap.get(key) ?? { count: 0, value: 0 };
    cur.count += 1;
    cur.value += valueOf(a.value);
    typeMap.set(key, cur);
  }

  const topAssets: BriefingAsset[] = [...assets]
    .sort((a, b) => valueOf(b.value) - valueOf(a.value))
    .slice(0, 8)
    .map((a) => ({
      name: a.name,
      type: (a.type as string) ?? "outro",
      entity: a.entity_id ? (entityName.get(a.entity_id) ?? null) : null,
      value: valueOf(a.value),
      status: (a.status as string) ?? "regular",
      area: a.area,
      location: a.location,
    }));

  const briefingRisks: BriefingRisk[] = [...openRisks]
    .sort((a, b) => {
      const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      const bySev = (rank[a.severity ?? "low"] ?? 9) - (rank[b.severity ?? "low"] ?? 9);
      if (bySev !== 0) return bySev;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    })
    .slice(0, 10)
    .map((r) => ({
      title: r.title,
      severity: r.severity ?? "medium",
      status: r.status ?? "pending",
      dueDate: r.due_date,
      entity: r.entity_id ? (entityName.get(r.entity_id) ?? null) : null,
      asset: r.asset_id ? (assetName.get(assetName.get(r.asset_id) ?? "") ?? null) : null,
    }));

  const docsWithDays: BriefingDocument[] = documents
    .map((d) => ({
      title: d.title,
      type: d.type,
      expiryDate: d.expiry_date,
      daysToExpire: daysBetween(d.expiry_date),
      status: (d.status as string) ?? "regular",
      asset: d.asset_id ? (assetName.get(d.asset_id) ?? null) : null,
    }))
    .filter((d) => d.daysToExpire !== null && d.daysToExpire <= EXPIRING_WINDOW_DAYS)
    .sort((a, b) => (a.daysToExpire ?? 0) - (b.daysToExpire ?? 0));

  const categoryMap = new Map<string, BriefingCategory>();
  for (const t of transactions) {
    const category = t.category ?? "Outros";
    const type = (t.type as "income" | "expense") ?? "expense";
    const key = `${type}:${category}`;
    const cur = categoryMap.get(key) ?? { category, type, total: 0 };
    cur.total += valueOf(t.amount);
    categoryMap.set(key, cur);
  }

  const income6m = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + valueOf(t.amount), 0);
  const expense6m = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + valueOf(t.amount), 0);

  // ---------------------------------------------------------- custódia (wave 4)
  // Se a migration 20261030150000 não estiver aplicada, os selects falham e
  // `positionRows` fica vazio: o briefing continua funcionando sem a seção.
  const positionRows = (positionsRes.data ?? []) as {
    name: string;
    asset_class: string;
    liquidity: string | null;
    quantity: number | string | null;
    unit_price: number | string | null;
    is_offshore: boolean | null;
  }[];
  const snapshotRows = (snapshotsRes.data ?? []) as {
    as_of: string;
    market_value: number | string | null;
    cost_basis: number | string | null;
    net_flow: number | string | null;
  }[];
  const flowRows = (flowsRes.data ?? []) as { flow_date: string; amount: number | string | null; kind: string }[];

  let custody: BriefingCustody | undefined;
  if (positionRows.length > 0) {
    const allocation = summarizeAllocation(positionRows);
    const performance = summarizePerformance(
      snapshotRows.map((row) => ({
        as_of: row.as_of,
        market_value: Number(row.market_value ?? 0),
        cost_basis: Number(row.cost_basis ?? 0),
        net_flow: Number(row.net_flow ?? 0),
      })),
      flowRows.map((row) => ({
        flow_date: row.flow_date,
        amount: Number(row.amount ?? 0),
        kind: row.kind,
      })),
    );

    custody = {
      positions: allocation.positionsCount,
      financialValue: allocation.total,
      byClass: allocation.byClass.map((bucket) => ({
        asset_class: bucket.label,
        value: bucket.value,
        percentage: bucket.percentage,
      })),
      liquidPercentage: allocation.liquidPercentage,
      offshorePercentage: allocation.offshorePercentage,
      concentration: allocation.concentration,
      twr: performance.twr.periods > 0 ? performance.twr.cumulative : null,
      mwr: performance.mwr,
      benchmarkExcess: performance.twr.periods > 0 ? performance.benchmark.excess : null,
      topPosition: allocation.top[0] ? { name: allocation.top[0].name, percentage: allocation.top[0].percentage } : null,
    };
  }

  return {
    custody,
    generatedAt: new Date().toISOString(),
    userEmail: auth?.user?.email ?? null,
    totals: {
      aum,
      assets: assets.length,
      entities: entities.length,
      members: membersRes.data?.length ?? 0,
      risksOpen: openRisks.length,
      risksCritical: openRisks.filter((r) => r.severity === "critical").length,
      documentsExpiring: docsWithDays.filter((d) => (d.daysToExpire ?? 0) >= 0).length,
      documentsOverdue: docsWithDays.filter((d) => (d.daysToExpire ?? 0) < 0).length,
      insightsOpen: insights.filter((i) => !i.is_resolved).length,
      income6m,
      expense6m,
    },
    entities: byEntity,
    topAssets,
    assetsByType: [...typeMap.entries()].map(([type, v]) => ({ type, ...v })),
    risks: briefingRisks,
    documentsExpiring: docsWithDays.slice(0, 10),
    insights: insights
      .filter((i) => !i.is_resolved)
      .slice(0, 8)
      .map((i) => ({
        title: i.title,
        severity: i.severity,
        type: i.type,
        resolved: Boolean(i.is_resolved),
      })),
    categories: [...categoryMap.values()].sort((a, b) => b.total - a.total),
  };
}

/** Serializa o briefing como contexto factual para o LLM. */
export function briefingToPrompt(briefing: PortfolioBriefing): string {
  const t = briefing.totals;
  const lines: string[] = [];

  lines.push(`DATA DE HOJE: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`GESTOR: ${briefing.userEmail ?? "não identificado"}`);
  lines.push("");
  lines.push("## RESUMO CONSOLIDADO");
  lines.push(`- Patrimônio total (AUM): ${brl(t.aum)}`);
  lines.push(
    `- Ativos cadastrados: ${t.assets} | Holdings/entidades: ${t.entities} | Pessoas: ${t.members}`,
  );
  lines.push(`- Riscos abertos: ${t.risksOpen} (críticos: ${t.risksCritical})`);
  lines.push(
    `- Documentos vencendo em até ${EXPIRING_WINDOW_DAYS} dias: ${t.documentsExpiring} | já vencidos: ${t.documentsOverdue}`,
  );
  lines.push(`- Insights do JARVIS não resolvidos: ${t.insightsOpen}`);
  lines.push(`- Entradas (6 meses): ${brl(t.income6m)} | Saídas (6 meses): ${brl(t.expense6m)}`);

  if (briefing.entities.length) {
    lines.push("");
    lines.push("## HOLDINGS");
    for (const e of briefing.entities) {
      lines.push(
        `- ${e.name} (${e.type ?? "sem tipo"}) — ${brl(e.value)} em ${e.assets} ativos, compliance ${e.compliance}%`,
      );
    }
  }

  if (briefing.assetsByType.length) {
    lines.push("");
    lines.push("## ATIVOS POR TIPO");
    for (const a of briefing.assetsByType) {
      lines.push(`- ${a.type}: ${a.count} ativo(s), ${brl(a.value)}`);
    }
  }

  if (briefing.topAssets.length) {
    lines.push("");
    lines.push("## MAIORES ATIVOS");
    for (const a of briefing.topAssets) {
      lines.push(
        `- ${a.name} | ${a.type} | ${brl(a.value)} | status ${a.status} | ${a.area ?? "área n/d"} | ${a.location ?? "local n/d"} | ${a.entity ?? "sem entidade"}`,
      );
    }
  }

  if (briefing.risks.length) {
    lines.push("");
    lines.push("## RISCOS ABERTOS (ordenados por severidade)");
    for (const r of briefing.risks) {
      const dias = r.dueDate ? daysBetween(r.dueDate.slice(0, 10)) : null;
      lines.push(
        `- [${r.severity}] ${r.title} — vencimento ${r.dueDate?.slice(0, 10) ?? "n/d"}${dias !== null ? ` (${dias} dias)` : ""} — entidade ${r.entity ?? "n/d"}`,
      );
    }
  }

  if (briefing.documentsExpiring.length) {
    lines.push("");
    lines.push("## DOCUMENTOS NA JANELA DE VENCIMENTO");
    for (const d of briefing.documentsExpiring) {
      lines.push(
        `- ${d.title} (${d.type ?? "sem tipo"}) — ${d.daysToExpire !== null && d.daysToExpire < 0 ? `vencido há ${Math.abs(d.daysToExpire)} dias` : `vence em ${d.daysToExpire} dias`} — status ${d.status}`,
      );
    }
  }

  if (briefing.insights.length) {
    lines.push("");
    lines.push("## INSIGHTS ABERTOS");
    for (const i of briefing.insights) {
      lines.push(`- [${i.severity}/${i.type}] ${i.title}`);
    }
  }

  if (briefing.categories.length) {
    lines.push("");
    lines.push("## FINANCEIRO POR CATEGORIA (6 meses)");
    for (const c of briefing.categories.slice(0, 10)) {
      lines.push(`- ${c.type === "income" ? "Entrada" : "Saída"} · ${c.category}: ${brl(c.total)}`);
    }
  }

  return lines.join("\n");
}

export { brl, daysBetween };
