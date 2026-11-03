/**
 * Atribuição de performance.
 *
 * O TWR responde "rendeu 11%". Não responde a pergunta que gera decisão:
 * **de onde veio o retorno, e o que eu faço com isso?** Esta camada decompõe o
 * resultado em contribuição por classe, por custodiante/gestor e por moeda.
 *
 * Método: contribuição = peso × retorno da posição (aritmética, não logarítmica,
 * porque a soma das contribuições tem de fechar com o retorno da carteira — é o
 * que o operador cobra). As três fontes de retorno, em ordem de preferência:
 *
 * 1. **Série de cotações** (`quotes`): preço no início e no fim do período. É a
 *    única fonte que mede performance de verdade.
 * 2. **Custo de aquisição**: `(valor − custo) / custo`. É retorno acumulado, não
 *    do período — por isso vem marcado como `custo` e conta em `coverage`.
 * 3. **Nenhuma**: posição sem preço fica fora do cálculo e entra em `unpriced`,
 *    porque inventar retorno é pior que admitir que não sabe.
 *
 * Cobertura (`coverage`) é parte do resultado, não nota de rodapé: atribuição com
 * 40% da carteira precificada não é atribuição, é ruído.
 */

export type AttributionPosition = {
  id: string;
  name: string;
  symbol?: string | null;
  instrument_id?: string | null;
  asset_class: string;
  currency?: string | null;
  quantity: number | string;
  unit_price: number | string;
  cost_basis?: number | string | null;
  as_of?: string | null;
  account_id?: string | null;
  custodian?: string | null;
};

export type PricePoint = {
  symbol: string;
  asOf: string;
  price: number;
};

export type ReturnSource = "cotacao" | "custo" | "sem-preco";

export type PositionAttribution = {
  id: string;
  name: string;
  symbol: string | null;
  asset_class: string;
  currency: string;
  custodian: string;
  value: number;
  weight: number;
  /** Retorno do período (ou acumulado, quando a fonte é custo). */
  returnPct: number;
  /** Peso × retorno — soma para o retorno da carteira. */
  contribution: number;
  source: ReturnSource;
  /** Decomposição cambial quando a posição não é em BRL e há série de FX. */
  localReturnPct?: number;
  fxReturnPct?: number;
};

export type AttributionBucket = {
  key: string;
  label: string;
  value: number;
  weight: number;
  returnPct: number;
  contribution: number;
  positions: number;
};

export type AttributionResult = {
  positions: PositionAttribution[];
  byClass: AttributionBucket[];
  byCustodian: AttributionBucket[];
  byCurrency: AttributionBucket[];
  totals: {
    value: number;
    /** Retorno da carteira no período (soma das contribuições). */
    returnPct: number;
    /** R$ gerados no período. */
    gain: number;
    /** % do valor com retorno vindo de série de cotação. */
    coverage: number;
    pricedValue: number;
    unpricedValue: number;
  };
  best: PositionAttribution[];
  worst: PositionAttribution[];
  /** Peso do caixa × (retorno do caixa − retorno da carteira). Negativo = arrasto. */
  cashDrag: number;
  warnings: string[];
};

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

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Série por símbolo, ordenada por data. */
export function indexQuotes(quotes: PricePoint[]): Map<string, PricePoint[]> {
  const map = new Map<string, PricePoint[]>();
  for (const quote of quotes) {
    if (!(quote.price > 0)) continue;
    const list = map.get(quote.symbol) ?? [];
    list.push(quote);
    map.set(quote.symbol, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.asOf.localeCompare(b.asOf));
  return map;
}

/** Preço mais próximo da data (para trás), dentro da série. */
export function priceAt(list: PricePoint[] | undefined, date: string): number | null {
  if (!list || list.length === 0) return null;
  let found: number | null = null;
  for (const point of list) {
    if (point.asOf <= date) found = point.price;
    else break;
  }
  return found;
}

/** Preço mais recente da série. */
export function latestPrice(list: PricePoint[] | undefined): number | null {
  if (!list || list.length === 0) return null;
  return list[list.length - 1].price;
}

function custodianLabel(position: AttributionPosition): string {
  return position.custodian?.trim() || "Sem custodiante";
}

/** Chave de série de preço: CNPJ de fundo tem precedência sobre o rótulo. */
function seriesKey(position: AttributionPosition): string | null {
  const cnpj = (position.instrument_id ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) return `FUND:${cnpj}`;
  return position.symbol?.trim() ? position.symbol.trim().toUpperCase() : null;
}

/**
 * Atribuição da carteira em um período.
 *
 * `periodStart` define o preço de partida; sem ele, usa o primeiro preço da série.
 */
export function computeAttribution(
  input: {
    positions: AttributionPosition[];
    quotes?: PricePoint[];
    periodStart?: string;
    periodEnd?: string;
  },
  today = new Date(),
): AttributionResult {
  const periodEnd = input.periodEnd ?? today.toISOString().slice(0, 10);
  const series = indexQuotes(input.quotes ?? []);
  const fxSeries = series.get("USD/BRL");

  const rows: PositionAttribution[] = [];
  const warnings: string[] = [];
  let pricedValue = 0;
  let unpricedValue = 0;

  for (const position of input.positions) {
    const quantity = num(position.quantity);
    const currentPrice = num(position.unit_price);
    const value = quantity * currentPrice;
    if (!(value > 0)) continue;

    const key = seriesKey(position);
    const list = key ? series.get(key) : undefined;
    const start = list ? (input.periodStart ? priceAt(list, input.periodStart) : list[0]?.price ?? null) : null;
    const end = list ? priceAt(list, periodEnd) ?? latestPrice(list) : null;

    let returnPct = 0;
    let source: ReturnSource = "sem-preco";

    if (start && end && start > 0) {
      returnPct = (end / start - 1) * 100;
      source = "cotacao";
      pricedValue += value;
    } else if (num(position.cost_basis) > 0) {
      returnPct = (value / num(position.cost_basis) - 1) * 100;
      source = "custo";
      unpricedValue += value;
    } else {
      returnPct = 0;
      source = "sem-preco";
      unpricedValue += value;
    }

    const currency = (position.currency ?? "BRL").toUpperCase();
    let localReturnPct: number | undefined;
    let fxReturnPct: number | undefined;

    // Decomposição cambial: só faz sentido com série de câmbio no período.
    if (currency !== "BRL" && currency === "USD" && fxSeries) {
      const fxStart = input.periodStart ? priceAt(fxSeries, input.periodStart) : fxSeries[0]?.price ?? null;
      const fxEnd = priceAt(fxSeries, periodEnd) ?? latestPrice(fxSeries);
      if (fxStart && fxEnd && fxStart > 0) {
        fxReturnPct = round((fxEnd / fxStart - 1) * 100);
        // Remove o efeito cambial: (1 + total) / (1 + fx) − 1
        localReturnPct = round(((1 + returnPct / 100) / (1 + (fxReturnPct ?? 0) / 100) - 1) * 100);
      }
    }

    rows.push({
      id: position.id,
      name: position.name,
      symbol: position.symbol ?? null,
      asset_class: position.asset_class,
      currency,
      custodian: custodianLabel(position),
      value: round(value),
      weight: 0, // preenchido depois
      returnPct: round(returnPct),
      contribution: 0,
      source,
      localReturnPct,
      fxReturnPct,
    });
  }

  const totalValue = rows.reduce((total, row) => total + row.value, 0);

  for (const row of rows) {
    row.weight = totalValue > 0 ? round((row.value / totalValue) * 100) : 0;
    row.contribution = round((row.weight / 100) * row.returnPct);
  }

  const portfolioReturn = rows.reduce((total, row) => total + row.contribution, 0);
  const gain = rows.reduce((total, row) => total + (row.value * row.returnPct) / 100, 0);

  const bucket = (keyOf: (row: PositionAttribution) => string, labelOf: (key: string) => string) => {
    const map = new Map<string, AttributionBucket>();
    for (const row of rows) {
      const key = keyOf(row);
      const current = map.get(key) ?? {
        key,
        label: labelOf(key),
        value: 0,
        weight: 0,
        returnPct: 0,
        contribution: 0,
        positions: 0,
      };
      current.value += row.value;
      current.contribution += row.contribution;
      current.positions += 1;
      map.set(key, current);
    }
    return [...map.values()]
      .map((item) => ({
        ...item,
        value: round(item.value),
        contribution: round(item.contribution),
        weight: totalValue > 0 ? round((item.value / totalValue) * 100) : 0,
        // Retorno do grupo ponderado pelo valor dentro do grupo.
        returnPct: item.value > 0 ? round((item.contribution / (item.value / totalValue || 1)) ) : 0,
      }))
      .map((item) => ({
        ...item,
        // Retorno médio ponderado do bucket: soma(contribuição) / peso do bucket.
        returnPct: item.weight > 0 ? round((item.contribution / item.weight) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  };

  const byClass = bucket(
    (row) => row.asset_class,
    (key) => CLASS_LABELS[key] ?? key,
  );
  const byCustodian = bucket(
    (row) => row.custodian,
    (key) => key,
  );
  const byCurrency = bucket(
    (row) => row.currency,
    (key) => key,
  );

  const priced = rows.filter((row) => row.source === "cotacao").length;
  if (rows.length > 0 && priced === 0) {
    warnings.push(
      "Nenhuma posição tem série de cotação no período: os retornos abaixo são acumulados desde o custo de aquisição, não do período.",
    );
  } else if (priced > 0 && priced < rows.length) {
    warnings.push(
      `${rows.length - priced} posição(ões) sem série de cotação — parte do retorno vem do custo de aquisição.`,
    );
  }

  const cash = rows.find((row) => row.asset_class === "caixa");
  const cashDrag = cash ? round((cash.weight / 100) * (cash.returnPct - portfolioReturn)) : 0;
  if (cash && cash.weight > 20 && cash.returnPct < portfolioReturn) {
    warnings.push(
      `Caixa em ${cash.weight.toFixed(1).replace(".", ",")}% da carteira rendendo menos que a média — arrasto de ${Math.abs(cashDrag).toFixed(2)} p.p.`,
    );
  }

  const sortedByContribution = [...rows].sort((a, b) => b.contribution - a.contribution);

  return {
    positions: rows.sort((a, b) => b.value - a.value),
    byClass,
    byCustodian,
    byCurrency,
    totals: {
      value: round(totalValue),
      returnPct: round(portfolioReturn),
      gain: round(gain),
      coverage: totalValue > 0 ? round((pricedValue / totalValue) * 100) : 0,
      pricedValue: round(pricedValue),
      unpricedValue: round(unpricedValue),
    },
    best: sortedByContribution.slice(0, 5),
    worst: sortedByContribution.slice(-5).reverse(),
    cashDrag,
    warnings,
  };
}

/**
 * Atribuição por moeda com decomposição local × cambial, agregada.
 * Só moedas com série de câmbio produzem decomposição — as demais ficam nulas.
 */
export function currencyBreakdown(result: AttributionResult): {
  currency: string;
  weight: number;
  totalReturnPct: number;
  localReturnPct: number | null;
  fxReturnPct: number | null;
}[] {
  return result.byCurrency.map((bucket) => {
    const rows = result.positions.filter((row) => row.currency === bucket.key);
    const weight = bucket.weight;
    const withFx = rows.filter((row) => row.localReturnPct !== undefined && row.fxReturnPct !== undefined);
    if (withFx.length === 0 || weight === 0) {
      return {
        currency: bucket.key,
        weight,
        totalReturnPct: bucket.returnPct,
        localReturnPct: null,
        fxReturnPct: null,
      };
    }
    const local = withFx.reduce((total, row) => total + (row.localReturnPct ?? 0) * row.weight, 0) /
      withFx.reduce((total, row) => total + row.weight, 0);
    const fx = withFx.reduce((total, row) => total + (row.fxReturnPct ?? 0) * row.weight, 0) /
      withFx.reduce((total, row) => total + row.weight, 0);
    return {
      currency: bucket.key,
      weight,
      totalReturnPct: bucket.returnPct,
      localReturnPct: round(local),
      fxReturnPct: round(fx),
    };
  });
}
