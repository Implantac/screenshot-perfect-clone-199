/**
 * Cotação automática — núcleo determinístico.
 *
 * Duas decisões moldam este módulo:
 *
 * 1. **O símbolo é canônico.** O banco guarda `PETR4`, `HGLG11`, `USD/BRL`,
 *    `US:AAPL`. Cada provedor faz a tradução (`PETR4` → `PETR4.SA` no Yahoo,
 *    `PETR4` → `PETR4` na brapi). Sem isso, "PETR4 ", "petr4" e "PETR4.SA"
 *    viram três linhas na série de preços.
 *
 * 2. **O plano de atualização é uma função pura.** Nada de escrever no banco no
 *    meio do parse: `planQuoteUpdates` recebe posições + cotações e devolve o que
 *    exatamente deve mudar. É o que permite testar sem rede.
 */

export type QuoteSource = "yahoo" | "brapi" | "cvm";

export type Quote = {
  /** Símbolo canônico do PATRIUM (PETR4, HGLG11, USD/BRL, US:AAPL). */
  symbol: string;
  price: number;
  currency: string;
  /** Data de referência do preço, ISO (yyyy-mm-dd). */
  asOf: string;
  source: QuoteSource;
  /** Nome longo quando o provedor devolve (útil na UI). */
  name?: string;
};

export type ProviderResult = {
  quotes: Quote[];
  errors: { symbol: string; message: string }[];
};

export type QuoteProvider = {
  id: QuoteSource;
  label: string;
  fetch: (symbols: string[]) => Promise<ProviderResult>;
};

/**
 * Normaliza o símbolo digitado pelo operador.
 *
 * - `petr4`, `PETR4.SA`, `PETR4 - Petrobras PN` → `PETR4`
 * - `usd/brl`, `USDBRL`, `USD-BRL`               → `USD/BRL`
 * - `us:aapl`, `AAPL.US`                          → `US:AAPL`
 * - qualquer outra coisa                          → `null` (não cotável)
 */
/** Moedas aceitas em par cambial (evita falso positivo com ticker de fundo). */
const CURRENCIES = new Set([
  "USD", "EUR", "BRL", "GBP", "JPY", "CHF", "ARS", "CAD", "AUD", "CNY", "MXN",
]);

export function normalizeSymbol(raw: string): string | null {
  if (!raw) return null;
  let value = raw
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    // corta sufixo descritivo: "PETR4 - PETROBRAS PN"
    .replace(/\s+-\s+.*$/, "")
    .replace(/\s+/g, "");

  // par de moedas — exige que as duas pontas sejam moedas conhecidas, senão
  // "FIAGRO" (FIA+GRO) viraria um par cambial inexistente.
  const pair = value.match(/^([A-Z]{3})[\/\-]?([A-Z]{3})$/);
  if (pair && CURRENCIES.has(pair[1]) && CURRENCIES.has(pair[2])) {
    return `${pair[1]}/${pair[2]}`;
  }

  // ação americana: aceita "US:AAPL" e "AAPL.US" (o sufixo marca a bolsa)
  if (value.endsWith(".US")) value = `US:${value.slice(0, -3)}`;
  if (value.startsWith("US:")) return /^[A-Z.]{1,6}$/.test(value.slice(3)) ? value : null;

  // B3 com sufixo .SA
  value = value.replace(/\.SA$/, "");

  // B3: 4 letras + 1 ou 2 dígitos (PETR4, HGLG11, BOVA11, AAPL34)
  if (/^[A-Z]{4}\d{1,2}$/.test(value)) return value;
  // fundo/ação com dígito final de 1 a 3 letras + dígitos (ex.: XPLG11 já coberto)
  if (/^[A-Z]{3}\d{1,2}$/.test(value)) return value;

  return null;
}

/**
 * CNPJ → 14 dígitos. Aceita `12.345.678/0001-90`, `12345678000190` e espaços.
 * É a identidade do fundo de investimento (não existe ticker para fundo aberto).
 */
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  // Rejeita sequências óbvias (00000000000000, 11111111111111…).
  if (/^(\d)\1{13}$/.test(digits)) return null;
  return digits;
}

/** Símbolo canônico de fundo: `FUND:12345678000190`. */
export function fundSymbol(cnpj: string): string {
  return `FUND:${normalizeCnpj(cnpj) ?? cnpj}`;
}

export function isFundSymbol(symbol: string): boolean {
  return symbol.startsWith("FUND:");
}

/** Diz se o símbolo é cotável automaticamente (e, portanto, vale pedir). */
export function isQuotable(symbol: string | null | undefined): symbol is string {
  return normalizeSymbol(symbol ?? "") !== null;
}

/** Tradução para o dialeto do Yahoo Finance. */
export function toYahooSymbol(symbol: string): string | null {
  const canonical = normalizeSymbol(symbol);
  if (!canonical) return null;
  if (canonical.includes("/")) {
    const [from, to] = canonical.split("/");
    return `${from}${to}=X`;
  }
  if (canonical.startsWith("US:")) return canonical.slice(3);
  return `${canonical}.SA`;
}

/** Tradução para o dialeto da brapi (B3 e moedas). */
export function toBrapiSymbol(symbol: string): string | null {
  const canonical = normalizeSymbol(symbol);
  if (!canonical) return null;
  if (canonical.startsWith("US:")) return null; // brapi não cobre bolsa americana
  if (canonical.includes("/")) return canonical.replace("/", "");
  return canonical;
}

// --------------------------------------------------------------- freshness

export const STALE_DAYS = 30;

/** Dias inteiros entre duas datas ISO (b - a). Datas inválidas → null. */
export function daysBetween(a: string | null | undefined, b: string): number | null {
  if (!a) return null;
  const from = Date.parse(`${a}T00:00:00Z`);
  const to = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

export function daysSince(date: string | null | undefined, today = new Date()): number | null {
  return daysBetween(date, today.toISOString().slice(0, 10));
}

export type Freshness = "atual" | "atencao" | "defasado" | "sem-preco";

export function classifyFreshness(
  asOf: string | null | undefined,
  price: number,
  today = new Date(),
): Freshness {
  if (!(price > 0)) return "sem-preco";
  const days = daysSince(asOf, today);
  if (days === null) return "sem-preco";
  if (days <= 2) return "atual";
  if (days <= STALE_DAYS) return "atencao";
  return "defasado";
}

// ------------------------------------------------------ plano de atualização

export type PositionLike = {
  id: string;
  symbol?: string | null;
  /** CNPJ do fundo (posições de fundo não têm ticker). */
  instrument_id?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  as_of?: string | null;
  asset_class?: string | null;
};

/**
 * Chave de casamento posição ↔ cotação.
 * CNPJ do fundo tem precedência: um fundo pode ter `symbol` descritivo ("FIM-MULTI")
 * e o CNPJ em `instrument_id`.
 */
export function positionQuoteKey(position: PositionLike): string | null {
  const cnpj = normalizeCnpj(position.instrument_id ?? "");
  if (cnpj) return fundSymbol(cnpj);
  return normalizeSymbol(position.symbol ?? "");
}

export type QuoteUpdate = {
  positionId: string;
  symbol: string;
  fromPrice: number;
  toPrice: number;
  fromAsOf: string | null;
  toAsOf: string;
  source: QuoteSource;
  /** Variação % do preço da posição para o preço de mercado. */
  deltaPct: number;
};

export type QuotePlan = {
  updates: QuoteUpdate[];
  unchanged: number;
  /** Posições sem símbolo cotável (imóvel, fundo fechado, ativo alternativo). */
  notQuotable: { positionId: string; name: string }[];
  /** Símbolos cotáveis que o provedor não trouxe. */
  missing: string[];
  totalDeltaBrl: number;
};

/**
 * Calcula o que a sincronização deve gravar. Regras:
 *  - posição sem quantidade > 0 é ignorada (não há valor a recalcular);
 *  - cotação com data anterior ao `as_of` da posição é descartada (não
 *    "envelhece" dado que já está mais novo);
 *  - preço idêntico e data idêntica → não atualiza (evita ruído no updated_at).
 */
export function planQuoteUpdates(positions: PositionLike[], quotes: Quote[]): QuotePlan {
  const bySymbol = new Map<string, Quote>();
  for (const quote of quotes) {
    const canonical = isFundSymbol(quote.symbol)
      ? quote.symbol
      : normalizeSymbol(quote.symbol) ?? quote.symbol;
    const current = bySymbol.get(canonical);
    if (!current || quote.asOf >= current.asOf) bySymbol.set(canonical, quote);
  }

  const updates: QuoteUpdate[] = [];
  const notQuotable: { positionId: string; name: string }[] = [];
  const missing = new Set<string>();
  let unchanged = 0;
  let totalDeltaBrl = 0;

  const wanted = new Set<string>();

  for (const position of positions) {
    const quantity = Number(position.quantity ?? 0);
    const currentPrice = Number(position.unit_price ?? 0);
    const canonical = positionQuoteKey(position);
    if (!canonical || !(quantity > 0)) {
      notQuotable.push({ positionId: position.id, name: position.name ?? "—" });
      continue;
    }
    wanted.add(canonical);
    const quote = bySymbol.get(canonical);
    if (!quote) {
      missing.add(canonical);
      continue;
    }
    if (position.as_of && quote.asOf < position.as_of) {
      unchanged += 1;
      continue;
    }
    if (Math.abs(quote.price - currentPrice) < 0.0001 && quote.asOf === position.as_of) {
      unchanged += 1;
      continue;
    }
    const deltaPct = currentPrice > 0 ? ((quote.price - currentPrice) / currentPrice) * 100 : 0;
    totalDeltaBrl += (quote.price - currentPrice) * quantity;
    updates.push({
      positionId: position.id,
      symbol: canonical,
      fromPrice: currentPrice,
      toPrice: quote.price,
      fromAsOf: position.as_of ?? null,
      toAsOf: quote.asOf,
      source: quote.source,
      deltaPct: Math.round(deltaPct * 100) / 100,
    });
  }

  return {
    updates,
    unchanged,
    notQuotable,
    missing: [...missing],
    totalDeltaBrl: Math.round(totalDeltaBrl * 100) / 100,
  };
}

/** Símbolos únicos e cotáveis de uma carteira — o que pedir ao provedor. */
export function splitQuotableSymbols(positions: PositionLike[]): {
  market: string[];
  funds: string[];
} {
  const market: string[] = [];
  const funds: string[] = [];
  for (const symbol of quotableSymbols(positions)) {
    (isFundSymbol(symbol) ? funds : market).push(symbol);
  }
  return { market, funds };
}

export function quotableSymbols(positions: PositionLike[]): string[] {
  const set = new Set<string>();
  for (const position of positions) {
    const canonical = positionQuoteKey(position);
    if (canonical && Number(position.quantity ?? 0) > 0) set.add(canonical);
  }
  return [...set].sort();
}
