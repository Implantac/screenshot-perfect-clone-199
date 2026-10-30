/**
 * Provedores de cotação.
 *
 * - **yahoo** (padrão): sem chave, cobre B3 (`PETR4.SA`), bolsa americana e
 *   pares de moeda (`USDBRL=X`). É uma chamada por símbolo — aceitável para
 *   carteiras de family office (dezenas de papéis), não para varejo.
 * - **brapi**: aceita lote (`/quote/PETR4,HGLG11`) quando há token; sem token,
 *   responde um símbolo por vez com limite de requisições.
 *
 * Os parsers são funções puras (`parseYahooChart`, `parseBrapiQuote`) justamente
 * para serem testados sem rede — o formato dessas APIs muda sem avisar.
 */
import {
  normalizeSymbol,
  toBrapiSymbol,
  toYahooSymbol,
  type ProviderResult,
  type Quote,
  type QuoteProvider,
  type QuoteSource,
} from "./index";

/** Data ISO a partir de um timestamp em segundos (Yahoo). */
export function isoFromEpochSeconds(seconds: number | null | undefined, fallback: string): string {
  if (!seconds || !Number.isFinite(seconds)) return fallback;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/** Extrai a cotação do payload do Yahoo (`/v8/finance/chart/...`). */
export function parseYahooChart(json: unknown, symbol: string, today = new Date()): Quote | null {
  const fallbackDate = today.toISOString().slice(0, 10);
  const result = (json as { chart?: { result?: unknown[]; error?: unknown } })?.chart?.result?.[0] as
    | {
        meta?: {
          symbol?: string;
          regularMarketPrice?: number;
          currency?: string;
          regularMarketTime?: number;
          shortName?: string;
          longName?: string;
        };
      }
    | undefined;
  if (!result?.meta) return null;
  const price = Number(result.meta.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const canonical = normalizeSymbol(symbol) ?? symbol.toUpperCase();
  return {
    symbol: canonical,
    price,
    currency: result.meta.currency ?? "BRL",
    asOf: isoFromEpochSeconds(result.meta.regularMarketTime, fallbackDate),
    source: "yahoo",
    name: result.meta.longName ?? result.meta.shortName ?? undefined,
  };
}

/** Extrai a cotação do payload da brapi (`/api/quote/...`). */
export function parseBrapiQuote(json: unknown, symbol: string, today = new Date()): Quote | null {
  const fallbackDate = today.toISOString().slice(0, 10);
  const first = (json as { results?: unknown[] })?.results?.[0] as
    | {
        symbol?: string;
        regularMarketPrice?: number;
        currency?: string;
        regularMarketTime?: string;
        longName?: string;
        shortName?: string;
      }
    | undefined;
  if (!first) return null;
  const price = Number(first.regularMarketPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const asOf = first.regularMarketTime
    ? new Date(first.regularMarketTime).toISOString().slice(0, 10)
    : fallbackDate;
  return {
    symbol: normalizeSymbol(symbol) ?? symbol.toUpperCase(),
    price,
    currency: first.currency ?? "BRL",
    asOf,
    source: "brapi",
    name: first.longName ?? first.shortName ?? undefined,
  };
}

const TIMEOUT_MS = 8_000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** Executa em lotes, para não abrir 50 conexões simultâneas. */
async function mapLimit<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(run))));
  }
  return out;
}

export function createYahooProvider(): QuoteProvider {
  return {
    id: "yahoo",
    label: "Yahoo Finance",
    async fetch(symbols: string[]): Promise<ProviderResult> {
      const quotes: Quote[] = [];
      const errors: { symbol: string; message: string }[] = [];

      await mapLimit(symbols, 4, async (symbol) => {
        const ticker = toYahooSymbol(symbol);
        if (!ticker) {
          errors.push({ symbol, message: "Símbolo não suportado pelo Yahoo." });
          return;
        }
        try {
          const json = await getJson(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
              ticker,
            )}?interval=1d&range=1d`,
            { "user-agent": "Mozilla/5.0 (compatible; PATRIUM-OS/1.0)" },
          );
          const quote = parseYahooChart(json, symbol);
          if (quote) quotes.push(quote);
          else errors.push({ symbol, message: "Sem preço no retorno." });
        } catch (error) {
          errors.push({
            symbol,
            message: error instanceof Error ? error.message : "Falha na requisição.",
          });
        }
      });

      return { quotes, errors };
    },
  };
}

export function createBrapiProvider(token = process.env.BRAPI_TOKEN ?? ""): QuoteProvider {
  return {
    id: "brapi",
    label: "brapi",
    async fetch(symbols: string[]): Promise<ProviderResult> {
      const quotes: Quote[] = [];
      const errors: { symbol: string; message: string }[] = [];
      const mapped = symbols
        .map((symbol) => ({ symbol, ticker: toBrapiSymbol(symbol) }))
        .filter((item): item is { symbol: string; ticker: string } => item.ticker !== null);

      for (const symbol of symbols) {
        if (!mapped.some((item) => item.symbol === symbol)) {
          errors.push({ symbol, message: "brapi não cobre este símbolo (use B3 ou moedas)." });
        }
      }

      const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
      const batchSize = token ? 12 : 1;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const chunk = mapped.slice(i, i + batchSize);
        try {
          const json = await getJson(
            `https://brapi.dev/api/quote/${chunk.map((item) => item.ticker).join(",")}${suffix}`,
          );
          // A brapi devolve um único `results` para o lote; casa por símbolo quando há.
          const results = ((json as { results?: { symbol?: string }[] })?.results ?? []).map(
            (item, index) => ({ item, index }),
          );
          if (results.length === 0) throw new Error("Resposta vazia.");
          for (const { item, index } of results) {
            // Sem `symbol` no retorno, assume a ordem do pedido (lote).
            const requested =
              chunk.find((entry) => entry.ticker === item.symbol)?.symbol ??
              chunk[index]?.symbol ??
              chunk[0].symbol;
            const quote = parseBrapiQuote({ results: [item] }, requested);
            if (quote) quotes.push(quote);
            else errors.push({ symbol: requested, message: "Sem preço no retorno." });
          }
        } catch (error) {
          for (const item of chunk) {
            errors.push({
              symbol: item.symbol,
              message: error instanceof Error ? error.message : "Falha na requisição.",
            });
          }
        }
      }

      return { quotes, errors };
    },
  };
}

/** Escolhe o provedor: brapi se houver token (cobre lote), senão Yahoo. */
export function resolveProvider(preferred?: string): QuoteProvider {
  const choice = (preferred ?? process.env.QUOTES_PROVIDER ?? "").toLowerCase();
  if (choice === "brapi") return createBrapiProvider();
  if (choice === "yahoo") return createYahooProvider();
  return createYahooProvider();
}

export function providerById(id: QuoteSource): QuoteProvider {
  return id === "brapi" ? createBrapiProvider() : createYahooProvider();
}
