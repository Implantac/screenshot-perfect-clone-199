/**
 * Aplicação do plano de cotações.
 *
 * Separado da server function de propósito: aqui está a **ordem das escritas** e
 * as regras de tolerância a falha, e isso precisa ser testável sem Supabase.
 *
 * Ordem: série de preços → posições → log do run.
 *  - a série é histórico (market data) e só cresce; se falhar, nada mais faz sentido;
 *  - a posição é o que o cliente vê; falha aqui aborta e deixa o erro subir;
 *  - o log é auditoria: se falhar, o preço já está gravado e não se desfaz o trabalho.
 */
import type { Quote, QuotePlan } from "./index";

export type QuoteWriter = {
  /** Upsert idempotente por (symbol, source, as_of). */
  upsertQuotes: (quotes: Quote[]) => Promise<void>;
  updatePosition: (
    positionId: string,
    patch: { unit_price: number; as_of: string; price_source: string },
  ) => Promise<void>;
  logRun: (run: {
    provider: string;
    symbolsRequested: number;
    symbolsFound: number;
    positionsUpdated: number;
    errors: { symbol: string; message: string }[];
  }) => Promise<void>;
};

export type ApplyResult = {
  positionsUpdated: number;
  quotesWritten: number;
  /** Falhas por posição, sem abortar as demais. */
  positionErrors: { positionId: string; message: string }[];
  runLogged: boolean;
};

export async function applyQuotePlan(
  writer: QuoteWriter,
  quotes: Quote[],
  plan: QuotePlan,
  meta: { provider: string; symbolsRequested: number; errors: { symbol: string; message: string }[] },
): Promise<ApplyResult> {
  const normalized: Quote[] = [];
  const seen = new Set<string>();
  for (const quote of quotes) {
    const key = `${quote.symbol}|${quote.source}|${quote.asOf}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!(quote.price > 0)) continue;
    normalized.push(quote);
  }

  if (normalized.length > 0) await writer.upsertQuotes(normalized);

  const positionErrors: { positionId: string; message: string }[] = [];
  let positionsUpdated = 0;
  for (const update of plan.updates) {
    try {
      await writer.updatePosition(update.positionId, {
        unit_price: update.toPrice,
        as_of: update.toAsOf,
        price_source: update.source,
      });
      positionsUpdated += 1;
    } catch (error) {
      positionErrors.push({
        positionId: update.positionId,
        message: error instanceof Error ? error.message : "Falha ao atualizar a posição.",
      });
    }
  }

  let runLogged = false;
  try {
    await writer.logRun({
      provider: meta.provider,
      symbolsRequested: meta.symbolsRequested,
      symbolsFound: normalized.length,
      positionsUpdated,
      errors: meta.errors,
    });
    runLogged = true;
  } catch {
    // Auditoria não derruba a operação.
    runLogged = false;
  }

  return { positionsUpdated, quotesWritten: normalized.length, positionErrors, runLogged };
}
