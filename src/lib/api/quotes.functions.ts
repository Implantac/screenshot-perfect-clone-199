/**
 * Sincronização de cotações (server function).
 *
 * Só o servidor fala com o provedor: a chave da brapi, se existir, nunca chega ao
 * browser. O handler faz o caminho completo — lê posições (RLS garante o tenant),
 * pede preço, grava a série em `quotes`, atualiza `positions.unit_price/as_of` e
 * registra o run em `quote_runs`.
 *
 * O que a função **não** faz: mexer em `portfolio_snapshots`. Snapshot é foto
 * mensal auditável; recalculá-la a cada clique apagaria o histórico de performance.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isFundSymbol,
  planQuoteUpdates,
  splitQuotableSymbols,
  type PositionLike,
  type Quote,
  type QuotePlan,
} from "@/lib/quotes";
import { fetchCvmFundQuotes } from "@/lib/quotes/cvm";
import { resolveProvider } from "@/lib/quotes/providers";
import { applyQuotePlan, type ApplyResult } from "@/lib/quotes/apply";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

/**
 * Erros de schema (migration não aplicada) em português, em vez do texto cru do
 * PostgREST. Sem isso o operador lê "could not find the 'price_source' column".
 */
function schemaError(error: { code?: string; message?: string }): Error {
  const message = error.message ?? "";
  if (
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.code === "42P01" ||
    /could not find the table|column .* does not exist|does not exist/i.test(message)
  ) {
    return new Error(
      "Faltam as tabelas de cotação neste banco. Aplique a migration 20261030170000_quotes.sql e tente de novo.",
    );
  }
  return new Error(message || "Falha na sincronização de cotações.");
}

const syncQuotesSchema = z.object({
  entity_id: z.string().uuid().optional(),
  /** Força um provedor específico (`yahoo`/`brapi`); padrão vem do ambiente. */
  provider: z.enum(["yahoo", "brapi"]).optional(),
});

export type SyncQuotesResult = {
  provider: string;
  /** Mês do informe da CVM usado para as cotas de fundo (null = sem fundos). */
  fundMonth: string | null;
  requested: number;
  found: number;
  plan: QuotePlan;
  quotes: Quote[];
  errors: { symbol: string; message: string }[];
};

export const syncQuotes = authed.validator(syncQuotesSchema).handler(async ({ data, context }) => {
  const provider = resolveProvider(data.provider);

  let query = context.supabase
    .from("positions")
    .select("id, entity_id, symbol, instrument_id, name, quantity, unit_price, as_of, asset_class");
  if (data.entity_id) query = query.eq("entity_id", data.entity_id);

  const { data: rows, error } = await query;
  if (error) throw schemaError(error);

  const positions = (rows ?? []) as (PositionLike & { entity_id: string })[];
  const { market, funds } = splitQuotableSymbols(positions);
  const symbols = [...market, ...funds];

  if (symbols.length === 0) {
    return {
      provider: provider.id,
      fundMonth: null,
      requested: 0,
      found: 0,
      plan: { updates: [], unchanged: 0, notQuotable: [], missing: [], totalDeltaBrl: 0 },
      quotes: [],
      errors: [],
    } satisfies SyncQuotesResult;
  }

  // Mercado (ação, FII, moeda) pelo provedor escolhido; fundos abertos pela CVM.
  const marketResult =
    market.length > 0 ? await provider.fetch(market) : { quotes: [] as Quote[], errors: [] };
  const fundCnpjs = funds.map((symbol) => symbol.replace("FUND:", ""));
  const fundResult =
    fundCnpjs.length > 0
      ? await fetchCvmFundQuotes(fundCnpjs)
      : { quotes: [] as Quote[], errors: [], month: null };

  const quotes: Quote[] = [...marketResult.quotes, ...fundResult.quotes];
  const errors = [...marketResult.errors, ...fundResult.errors];

  // Plano determinístico: o que muda, quanto muda, o que ficou de fora.
  const plan = planQuoteUpdates(positions, quotes);

  const writer = {
    upsertQuotes: async (list: Quote[]) => {
      const { error: quoteError } = await context.supabase.from("quotes").upsert(
        list.map((quote) => ({
          symbol: quote.symbol,
          price: quote.price,
          currency: quote.currency,
          as_of: quote.asOf,
          source: quote.source,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "symbol,source,as_of" },
      );
      if (quoteError) throw schemaError(quoteError);
    },
    updatePosition: async (
      positionId: string,
      patch: { unit_price: number; as_of: string; price_source: string },
    ) => {
      const { error: positionError } = await context.supabase
        .from("positions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", positionId);
      // Erro de coluna/tabela é de schema: sobe. Erro de RLS/registro: registra e segue.
      if (positionError) throw schemaError(positionError);
    },
    logRun: async (run: {
      provider: string;
      symbolsRequested: number;
      symbolsFound: number;
      positionsUpdated: number;
      errors: { symbol: string; message: string }[];
    }) => {
      const { error: runError } = await context.supabase.from("quote_runs").insert({
        entity_id: data.entity_id ?? null,
        user_id: context.userId,
        provider: run.provider,
        symbols_requested: run.symbolsRequested,
        symbols_found: run.symbolsFound,
        positions_updated: run.positionsUpdated,
        errors: run.errors,
      });
      if (runError) throw new Error(runError.message);
    },
  };

  const applied: ApplyResult = await applyQuotePlan(writer, quotes, plan, {
    provider: fundResult.quotes.length > 0 ? `${provider.id}+cvm` : provider.id,
    symbolsRequested: symbols.length,
    errors,
  });

  return {
    provider: fundResult.quotes.length > 0 ? `${provider.id}+cvm` : provider.id,
    fundMonth: fundResult.month,
    requested: symbols.length,
    found: applied.quotesWritten,
    plan: { ...plan, updates: plan.updates.filter((update) => !applied.positionErrors.some((failure) => failure.positionId === update.positionId)) },
    quotes,
    errors,
  } satisfies SyncQuotesResult;
});
