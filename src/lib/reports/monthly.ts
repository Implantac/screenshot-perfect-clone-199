/**
 * Relatório mensal do cliente.
 *
 * Este módulo transforma os motores das waves 9–12 (projeção, balanço, atribuição,
 * política-alvo) em **um documento com assinatura de gestor**: o que aconteceu no
 * mês, de onde veio o retorno, quanto o plano andou e o que está pendente.
 *
 * Três regras que orientam o desenho:
 *  1. **Nada de número solto.** Todo indicador aparece no mesmo documento que o
 *     explica (retorno junto da cobertura, PL junto da alavancagem).
 *  2. **Pendência é parte do relatório, não apêndice.** O cliente lê a lista do que
 *     precisa de decisão dele; o resto é contexto.
 *  3. **Função pura.** Nenhuma data implícita, nenhum acesso a banco — o PDF, a tela
 *     e o teste consomem o mesmo objeto.
 */

import {
  computeDrift,
  summarizeAllocation,
  type DriftRow,
  type PolicyTarget,
  type PositionLike,
} from "@/lib/wealth/allocation";
import {
  computeAttribution,
  type AttributionResult,
  type PricePoint,
} from "@/lib/wealth/attribution";
import {
  buildBalanceSheet,
  evaluateGoals,
  type BalanceSheet,
  type Goal,
  type GoalProgress,
  type Liability,
} from "@/lib/wealth/balance";
import {
  brl,
  brlCompact,
  competenciaBounds,
  competenciaLabel,
  formatDate,
  pct,
  signedBrl,
  signedPct,
  signedPoints,
} from "./format";

/** Política-alvo padrão de um family office balanceado — a mesma da tela de custódia. */
export const DEFAULT_POLICY: PolicyTarget[] = [
  { asset_class: "caixa", target: 10 },
  { asset_class: "renda_fixa", target: 30 },
  { asset_class: "renda_variavel", target: 20 },
  { asset_class: "fundos", target: 10 },
  { asset_class: "imoveis", target: 15 },
  { asset_class: "internacional", target: 10 },
  { asset_class: "alternativos", target: 5 },
];

/** Posição como vem do banco: campos de alocação + os que a atribuição usa. */
export type ReportPosition = PositionLike & {
  id?: string;
  symbol?: string | null;
  instrument_id?: string | null;
  cost_basis?: number | string | null;
  as_of?: string | null;
  account_id?: string | null;
  custodian?: string | null;
};

export type SnapshotLike = {
  as_of: string;
  market_value: number | string;
  net_flow?: number | string | null;
  cost_basis?: number | string | null;
};

export type MonthlyReportInput = {
  /** Competência "YYYY-MM". */
  competencia: string;
  /** Data de emissão ISO (YYYY-MM-DD). Padrão: fim da competência. */
  issuedAt?: string;
  clientName?: string | null;
  entityName?: string | null;
  positions: ReportPosition[];
  registeredAssets?: { current_value?: number | string | null }[];
  snapshots?: SnapshotLike[];
  liabilities?: Liability[];
  goals?: Goal[];
  quotes?: PricePoint[];
  policy?: PolicyTarget[];
  /** Banda de tolerância da política, em p.p. */
  tolerance?: number;
  /** Data de referência das metas (padrão: fim da competência). */
  today?: string;
};

export type ClassReportRow = {
  key: string;
  label: string;
  actual: number;
  target: number;
  drift: number;
  breach: boolean;
  action: DriftRow["action"];
  /** Retorno do mês da classe, vindo da atribuição. */
  returnPct: number;
  /** Contribuição da classe no mês, em p.p. */
  contribution: number;
};

export type Pendency = {
  severity: "alta" | "media" | "baixa";
  area: string;
  text: string;
};

export type MonthlyEvolution = {
  previousDate: string | null;
  previousValue: number | null;
  currentValue: number;
  /** Variação de PL no período (R$). */
  change: number;
  changePct: number | null;
  /** Aportes e resgates somados no período. */
  netFlow: number;
  /** Variação que não veio de fluxo — o retorno de verdade. */
  marketGain: number;
};

export type MonthlyReport = {
  meta: {
    competencia: string;
    label: string;
    periodFrom: string;
    periodTo: string;
    issuedAt: string;
    client: string;
    entity: string;
  };
  summary: {
    netWorth: number;
    financial: number;
    registered: number;
    debt: number;
    leverage: number;
    monthReturnPct: number;
    monthGain: number;
    ytdReturnPct: number;
    ytdGain: number;
    coverage: number;
    monthlyService: number;
  };
  evolution: MonthlyEvolution;
  attribution: {
    month: AttributionResult;
    ytd: AttributionResult;
    /** Início efetivo de cada janela (encolhida até a 1ª cotação, se preciso). */
    windows: { monthFrom: string; ytdFrom: string };
  };
  classes: ClassReportRow[];
  balance: BalanceSheet;
  goals: { items: GoalProgress[]; totals: ReturnType<typeof evaluateGoals>["totals"] };
  pendencies: Pendency[];
  narrative: { headline: string; paragraphs: string[]; nextSteps: string[] };
  warnings: string[];
};

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Primeiro dia do ano da competência — base do acumulado no ano. */
function yearStart(competencia: string): string {
  return `${competencia.slice(0, 4)}-01-01`;
}

function toAttributionPositions(positions: ReportPosition[]) {
  return positions.map((position, index) => {
    const row = position;
    return {
      id: row.id ?? `pos-${index}`,
      name: row.name,
      symbol: row.symbol ?? null,
      instrument_id: row.instrument_id ?? null,
      asset_class: row.asset_class,
      currency: row.currency ?? "BRL",
      quantity: row.quantity ?? 0,
      unit_price: row.unit_price ?? 0,
      cost_basis: row.cost_basis ?? null,
      as_of: row.as_of ?? null,
      account_id: row.account_id ?? null,
      custodian: row.custodian ?? null,
    };
  });
}

export function buildMonthlyReport(input: MonthlyReportInput): MonthlyReport {
  const { from, to } = competenciaBounds(input.competencia);
  const issuedAt = input.issuedAt ?? to;
  const today = input.today ?? to;

  const positions = input.positions ?? [];
  const liabilities = input.liabilities ?? [];
  const goals = input.goals ?? [];

  const balance = buildBalanceSheet({
    positions,
    registeredAssets: input.registeredAssets ?? [],
    liabilities,
  });
  const goalReport = evaluateGoals(goals, new Date(`${today}T12:00:00Z`));
  const allocation = summarizeAllocation(positions);

  // Atribuição em dois horizontes: o mês (o que o relatório conta) e o ano
  // (o que o cliente compara com o CDI).
  const attrRows = toAttributionPositions(positions);
  // Quando a série de cotações começa depois do início da janela, medir "desde o
  // início do ano" jogaria tudo para o custo de aquisição e produziria um número
  // que não é retorno de período. A janela é então encolhida até a primeira
  // cotação disponível — e o relatório diz qual janela usou.
  const earliestQuote = (input.quotes ?? [])
    .map((quote) => quote.asOf.slice(0, 10))
    .filter((date) => date <= to)
    .sort()[0];
  const clamp = (start: string) => (earliestQuote && earliestQuote > start ? earliestQuote : start);
  const monthFrom = clamp(from);
  const ytdFrom = clamp(yearStart(input.competencia));

  const monthAttr = computeAttribution({
    positions: attrRows,
    quotes: input.quotes,
    periodStart: monthFrom,
    periodEnd: to,
  });
  const ytdAttr = computeAttribution({
    positions: attrRows,
    quotes: input.quotes,
    periodStart: ytdFrom,
    periodEnd: to,
  });

  const drift = computeDrift(positions, input.policy ?? DEFAULT_POLICY, input.tolerance ?? 5);
  const attributionByClass = new Map(monthAttr.byClass.map((bucket) => [bucket.key, bucket]));
  const classes: ClassReportRow[] = drift.map((row) => {
    const bucket = attributionByClass.get(row.key);
    return {
      key: row.key,
      label: row.label,
      actual: row.actual,
      target: row.target,
      drift: row.drift,
      breach: row.breach,
      action: row.action,
      returnPct: bucket?.returnPct ?? 0,
      contribution: bucket?.contribution ?? 0,
    };
  });

  const evolution = computeEvolution(input.snapshots ?? [], from, to, balance.assets.financial);

  const summary = {
    netWorth: balance.totals.netWorth,
    financial: balance.assets.financial,
    registered: balance.assets.registered,
    debt: balance.totals.debt,
    leverage: balance.totals.leverage,
    monthReturnPct: monthAttr.totals.returnPct,
    monthGain: monthAttr.totals.gain,
    ytdReturnPct: ytdAttr.totals.returnPct,
    ytdGain: ytdAttr.totals.gain,
    coverage: monthAttr.totals.coverage,
    monthlyService: balance.totals.monthlyService,
  };

  const pendencies = buildPendencies({
    balance,
    monthAttr,
    goals: goalReport.goals,
    classes,
    evolution,
  });

  const meta = {
    competencia: input.competencia,
    label: competenciaLabel(input.competencia),
    periodFrom: from,
    periodTo: to,
    issuedAt,
    client: input.clientName?.trim() || "Cliente",
    entity: input.entityName?.trim() || "Consolidado do grupo familiar",
  };

  const narrative = buildNarrative({
    meta,
    summary,
    evolution,
    monthAttr,
    ytdAttr,
    classes,
    balance,
    goals: goalReport.goals,
    pendencies,
    windows: { monthFrom, ytdFrom },
    allocationTop: allocation.top[0] ?? null,
    liquid: allocation.liquidPercentage,
  });

  return {
    meta,
    summary,
    evolution,
    attribution: { month: monthAttr, ytd: ytdAttr, windows: { monthFrom, ytdFrom } },
    classes,
    balance,
    goals: { items: goalReport.goals, totals: goalReport.totals },
    pendencies,
    narrative,
    warnings: [...monthAttr.warnings, ...balance.warnings],
  };
}

function computeEvolution(
  snapshots: SnapshotLike[],
  from: string,
  to: string,
  currentValue: number,
): MonthlyEvolution {
  const ordered = [...snapshots]
    .map((snapshot) => ({
      asOf: String(snapshot.as_of).slice(0, 10),
      value: num(snapshot.market_value),
      netFlow: num(snapshot.net_flow),
    }))
    .sort((a, b) => a.asOf.localeCompare(b.asOf));

  // Linha de base: último fechamento antes do início do mês.
  const baseline = [...ordered].reverse().find((item) => item.asOf < from) ?? null;
  // Fluxos dentro do mês: tudo que foi aportado/resgatado entre `from` e `to`.
  const inMonth = ordered.filter((item) => item.asOf >= from && item.asOf <= to);
  const netFlow = round(inMonth.reduce((sum, item) => sum + item.netFlow, 0), 2);

  const current = inMonth.at(-1)?.value ?? currentValue;
  const previousValue = baseline?.value ?? null;
  const change = round(current - (previousValue ?? current), 2);
  const changePct =
    previousValue && previousValue !== 0 ? round((change / previousValue) * 100, 2) : null;

  return {
    previousDate: baseline?.asOf ?? null,
    previousValue,
    currentValue: round(current, 2),
    change,
    changePct,
    netFlow,
    marketGain: round(change - netFlow, 2),
  };
}

function buildPendencies(input: {
  balance: BalanceSheet;
  monthAttr: AttributionResult;
  goals: GoalProgress[];
  classes: ClassReportRow[];
  evolution: MonthlyEvolution;
}): Pendency[] {
  const list: Pendency[] = [];

  for (const goal of input.goals) {
    if (goal.status === "vencida") {
      list.push({
        severity: "alta",
        area: "Metas",
        text: `Meta "${goal.goal.name}" venceu em ${formatDate(goal.goal.target_date)} com ${pct(goal.progressPct, 0)} do alvo alocado — decidir extensão de prazo ou revisão do objetivo.`,
      });
    } else if (goal.status === "em_risco") {
      list.push({
        severity: "alta",
        area: "Metas",
        text: `Meta "${goal.goal.name}" exige ${brl(goal.requiredMonthly)}/mês para chegar a ${brl(goal.target)} até ${formatDate(goal.goal.target_date)}; hoje estão alocados ${brl(goal.allocated)}.`,
      });
    } else if (goal.status === "atencao") {
      list.push({
        severity: "media",
        area: "Metas",
        text: `Meta "${goal.goal.name}" está ${pct(goal.progressPct, 0)} do alvo e no limite do prazo — aporte necessário de ${brl(goal.requiredMonthly)}/mês.`,
      });
    }
  }

  const hasPortfolio = input.classes.some((row) => row.actual > 0);
  for (const row of input.classes.filter((item) => item.breach && hasPortfolio)) {
    list.push({
      severity: Math.abs(row.drift) >= 10 ? "alta" : "media",
      area: "Política",
      text: `${row.label} a ${pct(row.actual, 1)} contra alvo de ${pct(row.target, 1)} (${signedPoints(row.drift, 1)}) — ${row.action === "reduzir" ? "reduzir" : "aumentar"} exposição.`,
    });
  }

  if (input.monthAttr.totals.coverage < 70) {
    list.push({
      severity: input.monthAttr.totals.coverage < 40 ? "alta" : "media",
      area: "Dados",
      text: `Apenas ${pct(input.monthAttr.totals.coverage, 0)} do patrimônio tem série de cotação: ${brl(input.monthAttr.totals.unpricedValue)} está avaliado pelo custo de aquisição.`,
    });
  }

  const expensiveDebt = input.balance.liabilities.filter(
    (item) => num(item.liability.rate_annual) >= 12 && item.outstanding > 0,
  );
  if (expensiveDebt.length > 0) {
    list.push({
      severity: "media",
      area: "Dívida",
      text: `${expensiveDebt.length} dívida(s) acima de 12% a.a. somando ${brl(expensiveDebt.reduce((sum, item) => sum + item.outstanding, 0))} — avaliar quitação antecipada com caixa disponível.`,
    });
  }
  if (input.balance.totals.leverage > 30) {
    list.push({
      severity: input.balance.totals.leverage > 50 ? "alta" : "media",
      area: "Dívida",
      text: `Alavancagem em ${pct(input.balance.totals.leverage, 1)} do ativo — o serviço da dívida consome ${brl(input.balance.totals.monthlyService)}/mês.`,
    });
  }

  const unsecured = input.balance.liabilities.filter((item) => !item.isSecured && item.outstanding > 0);
  if (unsecured.length > 0) {
    list.push({
      severity: "media",
      area: "Dívida",
      text: `${unsecured.length} operação(ões) sem garantia informada — verificar registro e possibilidade de troca por dívida garantida mais barata.`,
    });
  }

  if (input.monthAttr.cashDrag < -0.3) {
    list.push({
      severity: "baixa",
      area: "Caixa",
      text: `Caixa arrastou ${pct(Math.abs(input.monthAttr.cashDrag))} p.p. do retorno do mês — avaliar alocação do excedente.`,
    });
  }

  const order = { alta: 0, media: 1, baixa: 2 } as const;
  return list.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 8);
}

/** Colapsa pontuação duplicada ("p.p.." → "p.p.") que surge ao concatenar valores. */
function tidy(text: string): string {
  return text.replace(/\.\.(?!\.)/g, ".").replace(/\s{2,}/g, " ").trim();
}

function buildNarrative(input: {
  meta: MonthlyReport["meta"];
  summary: MonthlyReport["summary"];
  evolution: MonthlyEvolution;
  monthAttr: AttributionResult;
  ytdAttr: AttributionResult;
  classes: ClassReportRow[];
  balance: BalanceSheet;
  goals: GoalProgress[];
  pendencies: Pendency[];
  windows: { monthFrom: string; ytdFrom: string };
  allocationTop: { name: string; value: number; percentage: number } | null;
  liquid: number;
}): MonthlyReport["narrative"] {
  const { summary, monthAttr, ytdAttr, evolution } = input;

  const headline =
    summary.monthReturnPct >= 0
      ? `Patrimônio líquido de ${brlCompact(summary.netWorth)}, com ${signedPct(summary.monthReturnPct)} no mês (${signedBrl(summary.monthGain)}).`
      : `Patrimônio líquido de ${brlCompact(summary.netWorth)}, com ${signedPct(summary.monthReturnPct)} no mês (${signedBrl(summary.monthGain)}).`;

  const paragraphs: string[] = [];

  // 1. O mês em números.
  const evolutionText =
    evolution.previousValue === null
      ? `O fechamento de ${brl(evolution.currentValue)} é o primeiro da série — a partir do próximo mês o relatório passa a comparar mês a mês.`
      : `O patrimônio financeiro foi de ${brl(evolution.previousValue)} em ${formatDate(evolution.previousDate)} para ${brl(evolution.currentValue)}, variação de ${signedBrl(evolution.change)} (${evolution.changePct === null ? "—" : signedPct(evolution.changePct)}). Desse total, ${signedBrl(evolution.netFlow)} são aportes líquidos e ${signedBrl(evolution.marketGain)} são retorno de mercado.`;
  paragraphs.push(evolutionText);

  // 2. De onde veio o retorno.
  const best = monthAttr.best[0];
  const worst = monthAttr.worst[0];
  const topClass = [...monthAttr.byClass].sort((a, b) => b.contribution - a.contribution)[0];
  const bottomClass = [...monthAttr.byClass].sort((a, b) => a.contribution - b.contribution)[0];
  if (monthAttr.positions.length > 0) {
    const parts = [
      `No mês, a carteira rendeu ${signedPct(summary.monthReturnPct)} (${signedBrl(summary.monthGain)})`,
      topClass ? `, com ${topClass.label} contribuindo ${signedPoints(topClass.contribution)}` : "",
      bottomClass && bottomClass.key !== topClass?.key
        ? ` e ${bottomClass.label} ${signedPoints(bottomClass.contribution)}`
        : "",
      best ? `. O melhor ativo foi ${best.name} (${signedPoints(best.contribution)})` : "",
      worst && worst.id !== best?.id
        ? ` e ${worst.contribution < 0 ? "o pior" : "a menor contribuição"}, ${worst.name} (${signedPoints(worst.contribution)})`
        : "",
      `. No acumulado desde ${formatDate(input.windows.ytdFrom)}, o retorno é de ${signedPct(summary.ytdReturnPct)}.`,
    ];
    paragraphs.push(parts.join(""));
  }

  // 3. Cobertura de dados — a nota de honestidade.
  paragraphs.push(
    summary.coverage >= 99
      ? "Todos os retornos vêm de série de cotação no período."
      : `${pct(summary.coverage, 0)} do patrimônio tem retorno medido por cotação; os ${brl(monthAttr.totals.unpricedValue)} restantes estão avaliados pelo custo de aquisição, o que tende a subestimar a volatilidade real.`,
  );

  // 4. Aderência à política.
  const breaches = input.classes.filter((row) => row.breach);
  paragraphs.push(
    breaches.length === 0
      ? "A alocação está dentro das bandas da política em todas as classes."
      : `${breaches.length} classe(s) fora da banda: ${breaches
          .map((row) => `${row.label} ${signedPoints(row.drift, 1)}`)
          .join("; ")} — ${breaches[0].action === "reduzir" ? "reduzir" : "aumentar"} ${breaches[0].label.toLowerCase()} é o ajuste de menor esforço.`,
  );

  // 5. Balanço.
  if (summary.debt > 0) {
    paragraphs.push(
      `O ativo de ${brl(summary.financial + summary.registered)} é financiado por ${brl(summary.debt)} de dívida, resultando em patrimônio líquido de ${brl(summary.netWorth)} e alavancagem de ${pct(summary.leverage, 1)}. O serviço da dívida consome ${brl(summary.monthlyService)} por mês.`,
    );
  }

  // 6. Metas.
  const goalsOk = input.goals.filter((goal) => goal.status === "no_prazo" || goal.status === "concluida");
  if (input.goals.length > 0) {
    paragraphs.push(
      `${goalsOk.length} de ${input.goals.length} metas estão no prazo. O aporte necessário para cumprir todas as metas no calendário é de ${brl(input.goals.reduce((sum, goal) => sum + goal.requiredMonthly, 0))} por mês.`,
    );
  }

  // Próximos passos: derivados das pendências de maior severidade.
  const nextSteps = input.pendencies
    .filter((item) => item.severity !== "baixa")
    .slice(0, 4)
    .map((item) => `${item.area}: ${item.text}`);
  if (nextSteps.length === 0) {
    nextSteps.push("Nenhuma pendência crítica: manter a política e revisar a alocação no próximo fechamento.");
  }

  return {
    headline: tidy(headline),
    paragraphs: paragraphs.map(tidy),
    nextSteps: nextSteps.map(tidy),
  };
}

/** Versão texto do relatório — para e-mail, WhatsApp e para o teste de regressão. */
export function formatMonthlyReportText(report: MonthlyReport): string {
  const lines: string[] = [];
  lines.push(`PATRIUM OS — RELATÓRIO DE ${report.meta.label.toUpperCase()}`);
  lines.push(`${report.meta.client} · ${report.meta.entity} · emitido em ${formatDate(report.meta.issuedAt)}`);
  lines.push("");
  lines.push(report.narrative.headline);
  lines.push("");
  lines.push("RESUMO");
  lines.push(`  Patrimônio líquido ....... ${brl(report.summary.netWorth)}`);
  lines.push(`  Ativo financeiro ........ ${brl(report.summary.financial)}`);
  lines.push(`  Ativos registrais ....... ${brl(report.summary.registered)}`);
  lines.push(`  Dívida .................. ${brl(report.summary.debt)}`);
  lines.push(`  Retorno no mês .......... ${signedPct(report.summary.monthReturnPct)}`);
  lines.push(`  Retorno no ano .......... ${signedPct(report.summary.ytdReturnPct)}`);
  lines.push("");
  lines.push("ALOCAÇÃO VS POLÍTICA");
  for (const row of report.classes) {
    lines.push(
      `  ${row.label.padEnd(16)} ${pct(row.actual, 1).padStart(6)} (alvo ${pct(row.target, 1).padStart(6)}) ${signedPoints(row.drift, 1).padStart(9)}`,
    );
  }
  lines.push("");
  lines.push("PENDÊNCIAS");
  if (report.pendencies.length === 0) lines.push("  Nenhuma pendência.");
  for (const item of report.pendencies) {
    lines.push(`  [${item.severity.toUpperCase()}] ${item.area} — ${item.text}`);
  }
  lines.push("");
  lines.push("PRÓXIMOS PASSOS");
  for (const step of report.narrative.nextSteps) lines.push(`  • ${step}`);
  lines.push("");
  lines.push(...report.narrative.paragraphs);
  return lines.join("\n");
}
