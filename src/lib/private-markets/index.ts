/**
 * Privados: compromissos, capital calls e distribuições.
 *
 * O que este módulo entrega são as quatro métricas que um family office olha
 * toda semana, e nada além disso:
 *
 * | métrica | pergunta que responde |
 * |---|---|
 * | **unfunded** | quanto ainda vou ter de desembolsar (o número que estraga o caixa) |
 * | **DPI** | quanto já voltou para cada real investido |
 * | **TVPI** | quanto vale (realizado + não realizado) para cada real investido |
 * | **chamadas no radar** | o que vence nos próximos 30/60/90 dias |
 *
 * Regra que evita o erro clássico de planilha: **o realizado vem sempre dos
 * eventos**, nunca de um campo digitado. `committed` é contrato; `called`,
 * `distributed` e `unfunded` são derivados.
 */

export type Commitment = {
  id: string;
  entity_id: string;
  name: string;
  manager?: string | null;
  strategy: string;
  committed: number | string;
  currency?: string | null;
  vintage?: number | null;
  closed_at?: string | null;
  term_years?: number | string | null;
  nav?: number | string | null;
  nav_as_of?: string | null;
  notice_days?: number | null;
  is_active?: boolean | null;
};

export type CapitalEvent = {
  id: string;
  commitment_id: string;
  entity_id: string;
  kind: "call" | "distribution";
  due_date: string;
  paid_at?: string | null;
  amount: number | string;
  status: "previsto" | "pago" | "atrasado" | "cancelado";
  notice_ref?: string | null;
  notes?: string | null;
};

export type CommitmentSummary = {
  commitment: Commitment;
  /** Capital assinado. */
  committed: number;
  /** Já chamado (pago ou previsto? não: chamado = eventos de call não cancelados). */
  called: number;
  /** Ainda não integralizado — a obrigação futura. */
  unfunded: number;
  /** Já devolvido. */
  distributed: number;
  /** NAV informado pelo gestor. */
  nav: number;
  /** Distribuído / integralizado. */
  dpi: number;
  /** (Distribuído + NAV) / integralizado. */
  tvpi: number;
  /** % do compromisso já chamado. */
  calledPct: number;
  /** Chamadas previstas (não pagas) com data no passado. */
  overdueCalls: number;
  /** Chamadas previstas a vencer em até 90 dias. */
  upcomingCalls: number;
  nextCallDate: string | null;
};

export type PrivateMarketsSummary = {
  commitments: CommitmentSummary[];
  totals: {
    committed: number;
    called: number;
    unfunded: number;
    distributed: number;
    nav: number;
    dpi: number;
    tvpi: number;
    calledPct: number;
    overdueCalls: number;
    upcomingCalls30: number;
    upcomingCalls90: number;
  };
  /** Chamadas previstas ordenadas por vencimento (inclui as atrasadas). */
  schedule: {
    event: CapitalEvent;
    commitmentName: string;
    daysUntil: number;
    overdue: boolean;
  }[];
  /** Distribuições previstas no radar (crédito futuro). */
  expectedDistributions: { event: CapitalEvent; commitmentName: string; daysUntil: number }[];
  warning: string | null;
};

const MS_DAY = 86_400_000;

export function daysUntil(date: string, today = new Date()): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(target)) return Number.NaN;
  const reference = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - reference) / MS_DAY);
}

/** Um evento está liquidado quando `status = pago` ou quando tem `paid_at`. */
export function isSettled(event: CapitalEvent): boolean {
  return event.status === "pago" || Boolean(event.paid_at);
}

/** Data efetiva de caixa: a do pagamento quando existe, senão a do vencimento. */
export function effectiveDate(event: CapitalEvent): string {
  return event.paid_at ?? event.due_date;
}

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Resumo por compromisso.
 *
 * `called` conta chamadas não canceladas (pagas **e** previstas): um capital call
 * avisado já comprometeu aquele caixa, então ele reduz o unfunded mesmo antes de
 * ser pago. As previstas aparecem separadas em `upcomingCalls`/`overdueCalls`
 * para a tela poder mostrar o que já saiu do bolso e o que ainda vai sair.
 */
export function summarizeCommitment(
  commitment: Commitment,
  events: CapitalEvent[],
  today = new Date(),
): CommitmentSummary {
  const own = events.filter(
    (event) => event.commitment_id === commitment.id && event.status !== "cancelado",
  );

  const calls = own.filter((event) => event.kind === "call");
  const distributions = own.filter((event) => event.kind === "distribution");

  const committed = num(commitment.committed);
  const called = calls.reduce((total, event) => total + num(event.amount), 0);
  const distributed = distributions.reduce((total, event) => total + num(event.amount), 0);
  const nav = num(commitment.nav);

  const pendingCalls = calls.filter((event) => !isSettled(event));
  const overdueCalls = pendingCalls
    .filter((event) => daysUntil(event.due_date, today) < 0)
    .reduce((total, event) => total + num(event.amount), 0);
  const upcomingCalls = pendingCalls
    .filter((event) => {
      const days = daysUntil(event.due_date, today);
      return days >= 0 && days <= 90;
    })
    .reduce((total, event) => total + num(event.amount), 0);

  const nextCall = pendingCalls
    .filter((event) => daysUntil(event.due_date, today) >= 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const unfunded = Math.max(0, committed - called);

  return {
    commitment,
    committed,
    called,
    unfunded,
    distributed,
    nav,
    dpi: called > 0 ? distributed / called : 0,
    tvpi: called > 0 ? (distributed + nav) / called : 0,
    calledPct: committed > 0 ? (called / committed) * 100 : 0,
    overdueCalls,
    upcomingCalls,
    nextCallDate: nextCall?.due_date ?? null,
  };
}

/** Prioriza o que exige ação: chamada atrasada > chamada próxima > resto. */
export function buildWarning(
  totals: { overdueCalls: number; upcomingCalls30: number },
  schedule: { overdue: boolean }[],
): string | null {
  if (totals.overdueCalls > 0) {
    const count = schedule.filter((item) => item.overdue).length;
    return `${count} capital call(s) vencido(s) sem pagamento — revise antes de qualquer decisão de caixa.`;
  }
  if (totals.upcomingCalls30 > 0) {
    return "Há capital call vencendo em até 30 dias: o caixa precisa estar reservado.";
  }
  return null;
}

export function summarizePortfolio(
  commitments: Commitment[],
  events: CapitalEvent[],
  today = new Date(),
): PrivateMarketsSummary {
  const summaries = commitments
    .filter((commitment) => commitment.is_active !== false)
    .map((commitment) => summarizeCommitment(commitment, events, today));

  const sum = (pick: (summary: CommitmentSummary) => number) =>
    summaries.reduce((total, summary) => total + pick(summary), 0);

  const called = sum((summary) => summary.called);
  const distributed = sum((summary) => summary.distributed);
  const nav = sum((summary) => summary.nav);
  const committed = sum((summary) => summary.committed);

  const pendingCalls = events.filter(
    (event) => event.kind === "call" && event.status !== "cancelado" && !isSettled(event),
  );

  const nameOf = (commitmentId: string) =>
    commitments.find((commitment) => commitment.id === commitmentId)?.name ?? "—";

  const schedule = pendingCalls
    .map((event) => ({
      event,
      commitmentName: nameOf(event.commitment_id),
      daysUntil: daysUntil(event.due_date, today),
      overdue: daysUntil(event.due_date, today) < 0,
    }))
    .sort((a, b) => a.event.due_date.localeCompare(b.event.due_date));

  const expectedDistributions = events
    .filter(
      (event) =>
        event.kind === "distribution" && event.status !== "cancelado" && !isSettled(event),
    )
    .map((event) => ({
      event,
      commitmentName: nameOf(event.commitment_id),
      daysUntil: daysUntil(event.due_date, today),
    }))
    .sort((a, b) => a.event.due_date.localeCompare(b.event.due_date));

  const totals = {
    committed,
    called,
    unfunded: sum((summary) => summary.unfunded),
    distributed,
    nav,
    dpi: called > 0 ? distributed / called : 0,
    tvpi: called > 0 ? (distributed + nav) / called : 0,
    calledPct: committed > 0 ? (called / committed) * 100 : 0,
    overdueCalls: sum((summary) => summary.overdueCalls),
    upcomingCalls30: schedule
      .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 30)
      .reduce((total, item) => total + num(item.event.amount), 0),
    upcomingCalls90: schedule
      .filter((item) => item.daysUntil >= 0 && item.daysUntil <= 90)
      .reduce((total, item) => total + num(item.event.amount), 0),
  };

  return {
    commitments: summaries.sort((a, b) => b.committed - a.committed),
    totals,
    schedule,
    expectedDistributions,
    warning: buildWarning(totals, schedule),
  };
}

/**
 * Estimativa de ritmo de chamada: se o fundo tem prazo e safra, o capital
 * costuma ser chamado de forma aproximadamente linear. Serve para a tela avisar
 * "este fundo ainda vai chamar ~R$ X por ano" quando não há aviso formal.
 */
export function estimatedAnnualCall(commitment: Commitment, summary: CommitmentSummary): number {
  const term = num(commitment.term_years);
  if (!(term > 0) || summary.unfunded <= 0) return 0;
  return summary.unfunded / term;
}

/**
 * Converte chamadas previstas em saídas agendadas para a projeção de caixa.
 * É a ponte entre privados e liquidez — e o motivo de o unfunded importar.
 */
export function callsToScheduled(
  summary: PrivateMarketsSummary,
  options: { horizonDays?: number } = {},
): { date: string; amount: number; direction: "in" | "out"; label: string }[] {
  const horizon = options.horizonDays ?? 365;
  return summary.schedule
    .filter((item) => item.daysUntil <= horizon)
    .map((item) => ({
      // Chamada atrasada entra no mês corrente: o dinheiro sai de qualquer forma.
      date: item.overdue ? new Date().toISOString().slice(0, 10) : item.event.due_date,
      amount: num(item.event.amount),
      direction: "out" as const,
      label: `Capital call — ${item.commitmentName}`,
    }));
}
