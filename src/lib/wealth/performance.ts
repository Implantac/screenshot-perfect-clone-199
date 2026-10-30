/**
 * Performance — TWR, MWR (IRR), drawdown, volatilidade e comparação com benchmark.
 *
 * Regras que este módulo respeita (e que quase todo dashboard de mercado erra):
 *
 * 1. **Retorno ≠ variação de saldo.** Um aporte de R$ 1 milhão não é lucro. Por isso
 *    TWR é calculado por sub-período, descontando o fluxo do denominador, e MWR usa
 *    os fluxos com data (XIRR), não uma média simples.
 * 2. **TWR mede a estratégia; MWR mede o investidor.** Os dois aparecem lado a lado
 *    justamente porque divergem quando há aporte em mau momento.
 * 3. **Anualização só acima de 1 período** e sempre informando o período usado —
 *    anualizar 2 meses e chamar de "retorno anual" é o erro mais comum do setor.
 *
 * Módulo puro: zero dependência de React, Supabase ou DOM.
 */

export type Snapshot = {
  as_of: string;
  market_value: number;
  /** Aportes - resgates ocorridos no período até esta data (assinado). */
  net_flow?: number;
  cost_basis?: number;
};

export type Flow = {
  flow_date: string;
  amount: number;
  kind: string;
};

const MS_DAY = 86_400_000;

function toDate(value: string): Date {
  // Datas puras ("2026-01-31") são interpretadas como UTC para não deslocar o dia.
  return new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / MS_DAY);
}

function ascending(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort((a, b) => toDate(a.as_of).getTime() - toDate(b.as_of).getTime());
}

export type TwrResult = {
  /** Retorno acumulado do período, em %. */
  cumulative: number;
  /** Retorno médio por sub-período, em %. */
  averagePeriod: number;
  /** Anualizado — só quando o período tem ≥ 365 dias. */
  annualized: number | null;
  periods: number;
  /** Série acumulada para o gráfico (base 0). */
  series: { as_of: string; value: number }[];
  /** Dias corridos cobertos pela série. */
  spanDays: number;
};

/**
 * Time-Weighted Return por encadeamento geométrico de sub-períodos.
 *
 * Fórmula por sub-período (fluxo no fim do período, convenção simples e conservadora):
 *   r_t = (V_t - F_t) / V_{t-1} - 1
 * onde F_t é o fluxo líquido do período. Encadeia: Π(1 + r_t) - 1.
 */
export function computeTwr(snapshots: Snapshot[]): TwrResult {
  const points = ascending(snapshots).filter((s) => Number.isFinite(Number(s.market_value)));

  if (points.length < 2) {
    return {
      cumulative: 0,
      averagePeriod: 0,
      annualized: null,
      periods: 0,
      series: points.map((p) => ({ as_of: p.as_of, value: 0 })),
      spanDays: 0,
    };
  }

  let growth = 1;
  const series: { as_of: string; value: number }[] = [{ as_of: points[0].as_of, value: 0 }];

  for (let i = 1; i < points.length; i += 1) {
    const previous = Number(points[i - 1].market_value);
    const current = Number(points[i].market_value);
    const flow = Number(points[i].net_flow ?? 0);

    // Fator de crescimento do sub-período: (V_t - F_t) / V_{t-1}.
    // Saldo anterior zero (conta recém-criada) usa (V_t - F_t) como base próprio,
    // o que equivale a tratar o primeiro aporte como custo.
    const base = previous > 0 ? previous : current - flow;
    if (base > 0) {
      growth *= (current - flow) / base;
    }

    series.push({ as_of: points[i].as_of, value: round((growth - 1) * 100, 4) });
  }

  const periods = points.length - 1;
  const spanDays = daysBetween(points[0].as_of, points[points.length - 1].as_of);
  const cumulative = growth - 1;
  const annualized =
    spanDays >= 365 ? round((Math.pow(growth, 365 / spanDays) - 1) * 100, 4) : null;

  return {
    cumulative: round(cumulative * 100, 4),
    averagePeriod: round((Math.pow(growth, 1 / periods) - 1) * 100, 4),
    annualized,
    periods,
    series,
    spanDays,
  };
}

/** Série "valor da cota" começando em 100 — útil para comparar com benchmark. */
export function indexSeries(snapshots: Snapshot[]): { as_of: string; value: number }[] {
  const twr = computeTwr(snapshots);
  return twr.series.map((point) => ({ as_of: point.as_of, value: round(100 * (1 + point.value / 100), 4) }));
}

/**
 * MWR / IRR via XIRR (bisseção + Newton fallback).
 *
 * Convenção de sinal: saída de caixa do bolso do investidor é negativa (aporte),
 * entrada é positiva (resgate), e o valor final da carteira entra como resgate.
 */
export function computeXirr(flows: Flow[], finalValue: number, finalDate: string): number | null {
  const dated: { date: Date; amount: number }[] = flows
    .map((flow) => {
      const sign = flow.kind === "aporte" ? -1 : 1;
      return { date: toDate(flow.flow_date), amount: sign * Math.abs(Number(flow.amount)) };
    })
    .filter((f) => Number.isFinite(f.amount) && f.amount !== 0);

  if (finalValue > 0) dated.push({ date: toDate(finalDate), amount: finalValue });
  if (dated.length < 2) return null;

  const start = dated.reduce((min, f) => (f.date < min ? f.date : min), dated[0].date);
  const hasPositive = dated.some((f) => f.amount > 0);
  const hasNegative = dated.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const npv = (rate: number) =>
    dated.reduce((sum, flow) => {
      const years = (flow.date.getTime() - start.getTime()) / (365 * MS_DAY);
      return sum + flow.amount / Math.pow(1 + rate, years);
    }, 0);

  // Bisseção em [-0.9999, 10] (até 1.000% a.a.) — robusta para séries curtas.
  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const midValue = npv(mid);
    if (Math.abs(midValue) < 1e-7) return round(mid * 100, 4);
    if (lowValue * midValue < 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }
  return round(((low + high) / 2) * 100, 4);
}

export type DrawdownResult = {
  /** Queda máxima do pico ao vale, em %. */
  maxDrawdown: number;
  peakDate: string | null;
  troughDate: string | null;
};

export function computeMaxDrawdown(snapshots: Snapshot[]): DrawdownResult {
  const points = ascending(snapshots);
  let peak = -Infinity;
  let peakDate: string | null = null;
  let worst = 0;
  let worstPeak: string | null = null;
  let worstTrough: string | null = null;

  for (const point of points) {
    const value = Number(point.market_value);
    if (value > peak) {
      peak = value;
      peakDate = point.as_of;
    } else if (peak > 0) {
      const drawdown = (value - peak) / peak;
      if (drawdown < worst) {
        worst = drawdown;
        worstPeak = peakDate;
        worstTrough = point.as_of;
      }
    }
  }

  return {
    maxDrawdown: round(worst * 100, 4),
    peakDate: worstPeak,
    troughDate: worstTrough,
  };
}

/** Volatilidade dos retornos por sub-período (desvio-padrão amostral), em %. */
export function computeVolatility(snapshots: Snapshot[]): number | null {
  const points = ascending(snapshots);
  if (points.length < 3) return null;

  const returns: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = Number(points[i - 1].market_value);
    const current = Number(points[i].market_value);
    const flow = Number(points[i].net_flow ?? 0);
    if (previous <= 0) continue;
    returns.push((current - flow) / previous - 1);
  }
  if (returns.length < 2) return null;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return round(Math.sqrt(variance) * 100, 4);
}

// ------------------------------------------------------------------ benchmark

/**
 * CDI acumulado aproximado para um intervalo, a partir da taxa anual.
 * Usado para responder "bati o CDI?" sem depender de série diária da B3.
 */
export function benchmarkReturn(
  annualRatePercent: number,
  days: number,
): number {
  if (!Number.isFinite(annualRatePercent) || days <= 0) return 0;
  const daily = Math.pow(1 + annualRatePercent / 100, 1 / 252) - 1;
  const businessDays = Math.max(1, Math.round((days / 365) * 252));
  return round((Math.pow(1 + daily, businessDays) - 1) * 100, 4);
}

/** CDI de referência — sobrescrevível pela UI; valor usado quando não há feed. */
export const CDI_REFERENCE_ANNUAL = 10.65;

export type PerformanceSummary = {
  twr: TwrResult;
  mwr: number | null;
  drawdown: DrawdownResult;
  volatility: number | null;
  benchmark: { name: string; annualRate: number; periodReturn: number; excess: number };
  currentValue: number;
  netFlows: number;
  unrealizedGain: number;
};

export function summarizePerformance(
  snapshots: Snapshot[],
  flows: Flow[],
  options: { cdiAnnual?: number } = {},
): PerformanceSummary {
  const points = ascending(snapshots);
  const last = points[points.length - 1];
  const twr = computeTwr(points);
  const currentValue = Number(last?.market_value ?? 0);
  const netFlows = flows.reduce(
    (sum, flow) => sum + (flow.kind === "aporte" ? -1 : 1) * Math.abs(Number(flow.amount)),
    0,
  );
  const mwr = last ? computeXirr(flows, currentValue, last.as_of) : null;
  const cdiAnnual = options.cdiAnnual ?? CDI_REFERENCE_ANNUAL;
  const periodReturn = benchmarkReturn(cdiAnnual, twr.spanDays);

  return {
    twr,
    mwr,
    drawdown: computeMaxDrawdown(points),
    volatility: computeVolatility(points),
    benchmark: {
      name: "CDI",
      annualRate: cdiAnnual,
      periodReturn,
      excess: round(twr.cumulative - periodReturn, 4),
    },
    currentValue,
    netFlows: round(netFlows, 2),
    unrealizedGain: round(
      points.reduce((sum, p) => sum + (Number(p.market_value) - Number(p.cost_basis ?? 0)), 0),
      2,
    ),
  };
}

function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
