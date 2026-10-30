/**
 * Projeção de fluxo de caixa (12 a 60 meses).
 *
 * A pergunta que o cliente faz não é "qual foi meu retorno": é **"tenho liquidez
 * para o próximo aporte, o capital call e o imposto do ano que vem?"**. Esta é a
 * primeira peça que responde isso com número, e não com adjetivo.
 *
 * Três decisões de modelagem, explícitas:
 *
 * 1. **Só o que é líquido paga conta.** O saldo projetado parte das posições com
 *    liquidez D+0/D+1 (opcionalmente D+30). Imóvel e ativo ilíquido entram no
 *    patrimônio, não no caixa — projetar caixa somando fazenda é ficção.
 * 2. **Recorrência é detectada, não cadastrada.** Fluxos que se repetem em
 *    intervalo mensal (25 a 35 dias) com pelo menos 3 ocorrências viram uma
 *    linha projetada, com o valor mediano. O que é esporádico não é projetado:
 *    inventar recorrência infla a projeção e destrui a confiança na ferramenta.
 * 3. **Rendimento incide sobre o saldo médio do mês**, não sobre o saldo inicial.
 *    Aportar no dia 28 não rende o mês inteiro.
 */

export type ForecastFlow = {
  date: string;
  amount: number;
  kind: string;
  description?: string | null;
};

export type ForecastPosition = {
  asset_class: string;
  liquidity: string;
  quantity: number | string;
  unit_price: number | string;
  currency?: string | null;
};

export type ForecastAssumptions = {
  /** Horizonte em meses (12 a 60). */
  months: number;
  /** Rentabilidade nominal esperada do caixa, % ao ano. */
  annualYield: number;
  /** Inflação anual, % — usada para reajustar recorrências quando pedido. */
  inflation?: number;
  adjustRecurringToInflation?: boolean;
  /** Considera posições D+30 como disponíveis (padrão: não). */
  includeD30?: boolean;
};

export type RecurringFlow = {
  /** Chave de agrupamento (descrição normalizada + tipo). */
  key: string;
  description: string;
  kind: string;
  direction: "in" | "out";
  /** Valor mediano das ocorrências (absoluto, mensal). */
  monthlyAmount: number;
  occurrences: number;
  /** % de intervalos dentro de 25–35 dias. 1 = perfeitamente mensal. */
  regularity: number;
  lastDate: string;
};

export type ForecastMonth = {
  /** Primeiro dia do mês, ISO. */
  month: string;
  label: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  /** Rendimento do saldo médio. */
  yield: number;
  closingBalance: number;
};

export type ForecastResult = {
  series: ForecastMonth[];
  recurring: RecurringFlow[];
  stats: {
    startingLiquid: number;
    endingLiquid: number;
    minLiquid: number;
    minLiquidMonth: string | null;
    firstNegativeMonth: string | null;
    monthsNegative: number;
    totalIn: number;
    totalOut: number;
    totalYield: number;
    /** Meses até o caixa virar negativo com o queima média (null = não vira). */
    runwayMonths: number | null;
    netMonthlyAverage: number;
  };
  alert: "ok" | "atencao" | "critico";
};

/** Direção de um `kind` de fluxo de custódia. */
export function flowDirection(kind: string): "in" | "out" {
  return kind === "aporte" || kind === "provento" ? "in" : "out";
}

/** Normaliza a descrição para agrupar recorrências. */
export function normalizeKey(description: string | null | undefined): string {
  return (description ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z# ]/g, " ")
    .replace(/\s+/g, " ")
    // "nº 12/2026" vira "# #": sequência de números colapsa num marcador só.
    .replace(/#(\s#)+/g, "#")
    .trim();
}

function toTime(date: string): number | null {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Detecta fluxos mensais recorrentes.
 *
 * Critério: pelo menos `minOccurrences` (padrão 3) lançamentos com o mesmo
 * rótulo normalizado e mesmo `kind`, e mediana dos intervalos entre 25 e 35 dias.
 */
export function detectRecurringFlows(
  flows: ForecastFlow[],
  options: { minOccurrences?: number; minRegularity?: number } = {},
): RecurringFlow[] {
  const minOccurrences = options.minOccurrences ?? 3;
  const minRegularity = options.minRegularity ?? 0.6;

  const groups = new Map<string, ForecastFlow[]>();
  for (const flow of flows) {
    if (!(Math.abs(Number(flow.amount)) > 0)) continue;
    if (toTime(flow.date) === null) continue;
    const key = `${normalizeKey(flow.description)}|${flow.kind}`;
    const list = groups.get(key) ?? [];
    list.push(flow);
    groups.set(key, list);
  }

  const recurring: RecurringFlow[] = [];
  for (const [key, list] of groups) {
    if (list.length < minOccurrences) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const intervals: number[] = [];
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = toTime(sorted[index - 1].date)!;
      const current = toTime(sorted[index].date)!;
      intervals.push(Math.round((current - previous) / 86_400_000));
    }
    if (intervals.length === 0) continue;
    const typicalInterval = median(intervals);
    if (typicalInterval < 25 || typicalInterval > 35) continue;
    const withinRange = intervals.filter((days) => days >= 25 && days <= 35).length;
    const regularity = withinRange / intervals.length;
    if (regularity < minRegularity) continue;

    const monthlyAmount = median(sorted.map((flow) => Math.abs(Number(flow.amount))));
    recurring.push({
      key,
      description: sorted[sorted.length - 1].description ?? "(sem descrição)",
      kind: sorted[sorted.length - 1].kind,
      direction: flowDirection(sorted[sorted.length - 1].kind),
      monthlyAmount,
      occurrences: sorted.length,
      regularity,
      lastDate: sorted[sorted.length - 1].date,
    });
  }

  return recurring.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

/** Soma o valor de mercado das posições que o caixa pode usar. */
export function liquidBalance(positions: ForecastPosition[], includeD30 = false): number {
  const usable = includeD30 ? ["d0", "d1", "d30"] : ["d0", "d1"];
  return positions
    .filter((position) => usable.includes(position.liquidity))
    .reduce(
      (total, position) =>
        total + Number(position.quantity ?? 0) * Number(position.unit_price ?? 0),
      0,
    );
}

const MONTH_LABELS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function monthStart(reference: Date, offset: number): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + offset, 1));
}

/**
 * Projeta o caixa mês a mês.
 *
 * Entradas = recorrências de entrada (aporte/provento).
 * Saídas   = recorrências de saída (resgate/taxa/imposto).
 * Rendimento = saldo médio do mês × taxa mensal equivalente.
 */
export function projectCashFlow(
  input: {
    positions: ForecastPosition[];
    flows: ForecastFlow[];
    scheduled?: { date: string; amount: number; direction: "in" | "out"; label?: string }[];
  },
  assumptions: ForecastAssumptions,
  reference = new Date(),
): ForecastResult {
  const months = Math.min(60, Math.max(1, Math.round(assumptions.months)));
  const includeD30 = assumptions.includeD30 ?? false;
  const startingLiquid = liquidBalance(input.positions, includeD30);
  const recurring = detectRecurringFlows(input.flows);

  const monthlyIn = recurring
    .filter((flow) => flow.direction === "in")
    .reduce((total, flow) => total + flow.monthlyAmount, 0);
  const monthlyOut = recurring
    .filter((flow) => flow.direction === "out")
    .reduce((total, flow) => total + flow.monthlyAmount, 0);

  const monthlyRate = Math.pow(1 + (assumptions.annualYield ?? 0) / 100, 1 / 12) - 1;
  const monthlyInflation = Math.pow(1 + (assumptions.inflation ?? 0) / 100, 1 / 12) - 1;
  const adjust = assumptions.adjustRecurringToInflation ?? false;

  const series: ForecastMonth[] = [];
  let balance = startingLiquid;

  for (let offset = 0; offset < months; offset += 1) {
    const date = monthStart(reference, offset);
    const monthKey = date.toISOString().slice(0, 7);
    const inflationFactor = adjust ? Math.pow(1 + monthlyInflation, offset) : 1;

    let inflow = monthlyIn * inflationFactor;
    let outflow = monthlyOut * inflationFactor;

    for (const item of input.scheduled ?? []) {
      if (!item.date.startsWith(monthKey)) continue;
      if (item.direction === "in") inflow += Math.abs(item.amount);
      else outflow += Math.abs(item.amount);
    }

    const opening = balance;
    const average = opening + (inflow - outflow) / 2;
    const yieldValue = average * monthlyRate;
    const closing = opening + inflow - outflow + yieldValue;

    series.push({
      month: monthKey,
      label: `${MONTH_LABELS[date.getUTCMonth()]}/${String(date.getUTCFullYear()).slice(2)}`,
      openingBalance: round(opening),
      inflow: round(inflow),
      outflow: round(outflow),
      yield: round(yieldValue),
      closingBalance: round(closing),
    });

    balance = closing;
  }

  const balances = series.map((month) => month.closingBalance);
  const minLiquid = balances.length > 0 ? Math.min(...balances) : startingLiquid;
  const minIndex = balances.indexOf(minLiquid);
  const negativeMonths = series.filter((month) => month.closingBalance < 0);
  const netMonthlyAverage = monthlyIn - monthlyOut;

  const runwayMonths =
    netMonthlyAverage < 0
      ? Math.max(0, Math.floor(startingLiquid / Math.abs(netMonthlyAverage)))
      : null;

  const alert: ForecastResult["alert"] =
    negativeMonths.length > 0 ? "critico" : minLiquid < startingLiquid * 0.2 ? "atencao" : "ok";

  return {
    series,
    recurring,
    stats: {
      startingLiquid: round(startingLiquid),
      endingLiquid: round(balance),
      minLiquid: round(minLiquid),
      minLiquidMonth: minIndex >= 0 ? series[minIndex].month : null,
      firstNegativeMonth: negativeMonths[0]?.month ?? null,
      monthsNegative: negativeMonths.length,
      totalIn: round(series.reduce((total, month) => total + month.inflow, 0)),
      totalOut: round(series.reduce((total, month) => total + month.outflow, 0)),
      totalYield: round(series.reduce((total, month) => total + month.yield, 0)),
      runwayMonths,
      netMonthlyAverage: round(netMonthlyAverage),
    },
    alert,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
