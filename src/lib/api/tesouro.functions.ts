/**
 * Renda fixa a mercado — Server Functions (wave 27).
 *
 * O QUE ACONTECE AQUI
 *  1. `syncTesouro`: baixa o CSV público do Tesouro Transparente, guarda a curva
 *     em `quotes` (source `tesouro`) e atualiza `positions.unit_price/as_of`
 *     das posições que são título público.
 *  2. `getTesouroPanel`: lê a curva já gravada, monta resumo/sanidade e mostra o
 *     impacto da marcação **sem** aplicar — o operador vê o número antes.
 *
 * DECISÕES
 *  - **Nenhuma migration nova.** A tabela `quotes` (wave 6) é série de preço por
 *    símbolo com `source` livre, e `positions` já tem `price_source`. Criar uma
 *    tabela de renda fixa seria duplicar o que existe.
 *  - **Só o servidor fala com o Tesouro.** O CSV tem 14,6 MB: baixar no browser
 *    seria lento e auditável de menos.
 *  - **O preço que grava é o de venda** (o que o cliente receberia hoje). O de
 *    compra aparece como spread na tela, não como valor da posição.
 *  - **Falha de rede não derruba nada.** Sem curva nova, a última gravada
 *    continua servindo (com a idade declarada).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bondFromSymbol,
  bondSymbol,
  checkCurve,
  curveHealth,
  latestCurve,
  markPositions,
  parseTesouroCsv,
  planTesouroMarks,
  summarizeCurve,
  type CurveFinding,
  type CurveSummary,
  type MarkedPosition,
  type TesouroRow,
} from "@/lib/market/tesouro";
import { reportError } from "@/lib/observability/report.server";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

/** URL canônica do CSV (CKAN do Tesouro Transparente). Sobrescreva via ambiente em teste. */
const DEFAULT_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";

/** 20 MB: o arquivo tem 14,6 MB; acima disso é resposta truncada ou HTML de erro. */
const MAX_BYTES = 20 * 1024 * 1024;

export function tesouroUrl(): string {
  return process.env.TESOURO_CSV_URL?.trim() || DEFAULT_URL;
}

/** Baixa e converte. Exportada para o teste de integração poder chamar sem Server Fn. */
export async function fetchTesouroCurve(options: { sinceDays?: number } = {}): Promise<{
  rows: TesouroRow[];
  skipped: number;
  unknownBonds: string[];
  bytes: number;
}> {
  const since = new Date(Date.now() - (options.sinceDays ?? 10) * 86_400_000).toISOString().slice(0, 10);

  const response = await fetch(tesouroUrl(), {
    headers: { accept: "text/csv,*/*" },
    // 90 s: o arquivo levou ~37 s no teste feito no sandbox.
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Tesouro respondeu ${response.status}.`);

  const text = await response.text();
  const bytes = text.length;
  if (bytes > MAX_BYTES) throw new Error("Resposta do Tesouro maior que o esperado: abortado por segurança.");
  // Página de erro do portal não começa com o header do CSV.
  if (!text.startsWith("Tipo Titulo;")) {
    throw new Error("O Tesouro devolveu algo que não é o CSV de taxas (mudou o layout ou a URL).");
  }

  const parsed = parseTesouroCsv(text, { since });
  return { rows: parsed.rows, skipped: parsed.skipped, unknownBonds: parsed.unknownBonds, bytes };
}

export type SyncTesouroResult = {
  ok: boolean;
  /** Data-base da curva gravada. */
  asOf: string | null;
  bonds: number;
  quotesWritten: number;
  positionsUpdated: number;
  positionsUnresolved: number;
  positionsAmbiguous: number;
  totalDeltaBrl: number;
  skippedRows: number;
  unknownBonds: string[];
  durationMs: number;
  note?: string;
};

const syncInput = z.object({
  entity_id: z.string().uuid().optional(),
  /** Aplica o preço nas posições. Sem isso, só grava a curva (e o operador vê o impacto). */
  apply: z.boolean().default(true),
});

export const syncTesouro = authed.inputValidator(syncInput).handler(
  async ({ data, context }): Promise<SyncTesouroResult> => {
    const started = Date.now();

    let fetched: Awaited<ReturnType<typeof fetchTesouroCurve>>;
    try {
      fetched = await fetchTesouroCurve({ sinceDays: 10 });
    } catch (error) {
      await reportError(error, { source: "tesouro.sync", kind: "integration", context: { step: "download" } });
      return {
        ok: false,
        asOf: null,
        bonds: 0,
        quotesWritten: 0,
        positionsUpdated: 0,
        positionsUnresolved: 0,
        positionsAmbiguous: 0,
        totalDeltaBrl: 0,
        skippedRows: 0,
        unknownBonds: [],
        durationMs: Date.now() - started,
        note: error instanceof Error ? error.message : "Falha ao baixar a curva do Tesouro.",
      };
    }

    if (fetched.rows.length === 0) {
      return {
        ok: false,
        asOf: null,
        bonds: 0,
        quotesWritten: 0,
        positionsUpdated: 0,
        positionsUnresolved: 0,
        positionsAmbiguous: 0,
        totalDeltaBrl: 0,
        skippedRows: fetched.skipped,
        unknownBonds: fetched.unknownBonds,
        durationMs: Date.now() - started,
        note: "O arquivo veio sem nenhuma linha reconhecida — layout mudou?",
      };
    }

    const curve = latestCurve(fetched.rows);

    // 1) série de preços (idempotente por symbol+source+as_of)
    const payload = curve.map((row) => ({
      symbol: bondSymbol(row.code, row.maturity),
      // PU de venda: valor de resgate hoje. Guardar o de compra inflaria o PL.
      price: row.puSell,
      currency: "BRL",
      as_of: row.asOf,
      source: "tesouro",
      fetched_at: new Date().toISOString(),
    }));

    const { error: quoteError } = await context.supabase
      .from("quotes")
      .upsert(payload, { onConflict: "symbol,source,as_of" });

    if (quoteError) {
      await reportError(quoteError, { source: "tesouro.sync", kind: "error", context: { step: "quotes" } });
      return {
        ok: false,
        asOf: curve[0]?.asOf ?? null,
        bonds: curve.length,
        quotesWritten: 0,
        positionsUpdated: 0,
        positionsUnresolved: 0,
        positionsAmbiguous: 0,
        totalDeltaBrl: 0,
        skippedRows: fetched.skipped,
        unknownBonds: fetched.unknownBonds,
        durationMs: Date.now() - started,
        note: /does not exist|schema cache|relation/i.test(quoteError.message)
          ? "Falta a tabela quotes: aplique a migration 20261030170000_quotes.sql."
          : quoteError.message,
      };
    }

    // 2) posições
    let query = context.supabase
      .from("positions")
      .select("id, entity_id, name, symbol, quantity, unit_price, asset_class, as_of");
    if (data.entity_id) query = query.eq("entity_id", data.entity_id);

    const { data: rows, error: positionError } = await query;
    if (positionError) {
      return {
        ok: false,
        asOf: curve[0]?.asOf ?? null,
        bonds: curve.length,
        quotesWritten: payload.length,
        positionsUpdated: 0,
        positionsUnresolved: 0,
        positionsAmbiguous: 0,
        totalDeltaBrl: 0,
        skippedRows: fetched.skipped,
        unknownBonds: fetched.unknownBonds,
        durationMs: Date.now() - started,
        note: positionError.message,
      };
    }

    const positions = (rows ?? []) as (Parameters<typeof planTesouroMarks>[0][number])[];
    const plan = planTesouroMarks(positions, curve);

    let positionsUpdated = 0;
    const failures: string[] = [];
    if (data.apply) {
      for (const update of plan.updates) {
        const { error } = await context.supabase
          .from("positions")
          .update({
            unit_price: update.toPrice,
            as_of: update.asOf,
            price_source: "tesouro",
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.positionId);
        if (error) failures.push(`${update.name}: ${error.message}`);
        else positionsUpdated += 1;
      }
    }

    // 3) log do run (auditoria do preço, mesma tabela das outras fontes)
    await context.supabase.from("quote_runs").insert({
      entity_id: data.entity_id ?? null,
      user_id: context.userId,
      provider: "tesouro",
      symbols_requested: curve.length,
      symbols_found: curve.length,
      positions_updated: positionsUpdated,
      errors: failures.map((failure) => ({ symbol: "positions", message: failure })),
    });

    return {
      ok: true,
      asOf: curve[0]?.asOf ?? null,
      bonds: curve.length,
      quotesWritten: payload.length,
      positionsUpdated,
      positionsUnresolved: plan.unresolved,
      positionsAmbiguous: plan.ambiguous,
      totalDeltaBrl: plan.totalDeltaBrl,
      skippedRows: fetched.skipped,
      unknownBonds: fetched.unknownBonds,
      durationMs: Date.now() - started,
      note:
        failures.length > 0
          ? `${failures.length} posição(ões) não atualizada(s): ${failures[0]}`
          : data.apply
            ? undefined
            : "Curva gravada sem aplicar nas posições (modo simulação).",
    };
  },
);

export type TesouroPanelPayload = {
  updatedAt: string;
  curve: {
    code: string;
    name: string;
    maturity: string; // ISO
    maturityBr: string;
    rateBuy: number;
    rateSell: number;
    puBuy: number;
    puSell: number;
    asOf: string;
  }[];
  summary: CurveSummary;
  findings: CurveFinding[];
  health: { ok: boolean; failed: number; total: number };
  positions: {
    positionId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    status: MarkedPosition["resolution"]["status"];
    reason?: string;
    marketPrice?: number;
    deltaBrl?: number;
    deltaPct?: number;
    ageDays?: number;
    stale?: boolean;
  }[];
  /** Data-base da curva em uso — pode ser antiga se a sincronização falhou. */
  migrationPending: string | null;
};

/**
 * A leitura usa a curva **gravada**, não o CSV: o painel abre rápido e funciona
 * offline. A idade da curva aparece na tela; se estiver velha, é isso que o
 * operador precisa ver — não uma tela vazia.
 */
export const getTesouroPanel = authed
  .inputValidator(z.object({ entity_id: z.string().uuid().optional() }).default({}))
  .handler(async ({ data, context }): Promise<TesouroPanelPayload> => {
    const { data: quoteRows, error } = await context.supabase
      .from("quotes")
      .select("symbol, price, as_of")
      .eq("source", "tesouro")
      .order("as_of", { ascending: false })
      .limit(500);

    const emptySummary = summarizeCurve([]);

    if (error) {
      return {
        updatedAt: new Date().toISOString(),
        curve: [],
        summary: emptySummary,
        findings: [],
        health: { ok: true, failed: 0, total: 0 },
        positions: [],
        migrationPending: /does not exist|schema cache|relation/i.test(error.message)
          ? "20261030170000_quotes.sql"
          : null,
      };
    }

    // A tabela guarda série; para o painel interessa a última data de cada papel.
    const bySell = new Map<string, { symbol: string; price: number; asOf: string }>();
    for (const row of quoteRows ?? []) {
      const key = row.symbol;
      const current = bySell.get(key);
      if (!current || row.as_of > current.asOf) {
        bySell.set(key, { symbol: key, price: Number(row.price), asOf: row.as_of });
      }
    }

    // Reconstrói a curva a partir do símbolo canônico, com taxas quando houver
    // (as taxas não vão para `quotes`: só o PU é preço).
    let curveRows: TesouroRow[] = [];
    let ratesByKey = new Map<string, { rateBuy: number; rateSell: number; puBuy: number }>();

    let positionQuery = context.supabase
      .from("positions")
      .select("id, name, symbol, quantity, unit_price, asset_class, as_of");
    if (data.entity_id) positionQuery = positionQuery.eq("entity_id", data.entity_id);
    const { data: positionRows } = await positionQuery;

    const positions = (positionRows ?? []) as (Parameters<typeof markPositions>[0][number])[];

    // Com posições de título na carteira, busca a curva fresca direto na fonte —
    // é o único jeito de ter taxa e PU de compra (que não são preço de posição).
    const hasBondPositions = positions.some((position) =>
      /tesouro|ntn|lft|ltn|ipca|prefixad|selic/i.test(`${position.name ?? ""} ${position.symbol ?? ""}`),
    );

    if (hasBondPositions) {
      try {
        const fetched = await fetchTesouroCurve({ sinceDays: 5 });
        curveRows = latestCurve(fetched.rows);
        ratesByKey = new Map(
          curveRows.map((row) => [
            bondSymbol(row.code, row.maturity),
            { rateBuy: row.rateBuy, rateSell: row.rateSell, puBuy: row.puBuy },
          ]),
        );
      } catch {
        // Sem rede: cai para o que está gravado (PU apenas) — a tela avisa a idade.
        curveRows = [];
      }
    } else {
      // Sem posição de título, o painel ainda mostra a curva já sincronizada.
      curveRows = [...bySell.values()]
        .map((entry) => bondFromSymbol(entry.symbol, entry.price, entry.asOf))
        .filter((row): row is TesouroRow => row !== null);
    }

    const summary = summarizeCurve(curveRows);
    const findings = curveRows.length > 0 ? checkCurve(curveRows) : [];
    const health = curveHealth(findings);

    const marked = markPositions(positions, curveRows);

    return {
      updatedAt: new Date().toISOString(),
      curve: curveRows.map((row) => {
        const rate = ratesByKey.get(bondSymbol(row.code, row.maturity));
        return {
          code: row.code,
          name: row.officialName,
          maturity: row.maturity,
          maturityBr: row.maturity.split("-").reverse().join("/"),
          rateBuy: rate?.rateBuy ?? row.rateBuy,
          rateSell: rate?.rateSell ?? row.rateSell,
          puBuy: rate?.puBuy ?? row.puBuy,
          puSell: row.puSell,
          asOf: row.asOf,
        };
      }),
      summary,
      findings,
      health: { ok: health.ok, failed: health.failed.length, total: health.total },
      positions: marked.map((entry) => {
        if (entry.resolution.status === "resolved") {
          const mark = entry.resolution.mark;
          return {
            positionId: entry.positionId,
            name: entry.name,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
            status: "resolved" as const,
            marketPrice: mark.marketPrice,
            deltaBrl: mark.deltaBrl,
            deltaPct: mark.deltaPct,
            ageDays: mark.ageDays,
            stale: mark.stale,
          };
        }
        return {
          positionId: entry.positionId,
          name: entry.name,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          status: entry.resolution.status,
          reason: entry.resolution.reason,
        };
      }),
      migrationPending: null,
    };
  });
