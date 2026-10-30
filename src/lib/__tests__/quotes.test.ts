import { describe, expect, test } from "bun:test";
import {
  classifyFreshness,
  daysBetween,
  isQuotable,
  normalizeSymbol,
  planQuoteUpdates,
  quotableSymbols,
  toBrapiSymbol,
  toYahooSymbol,
  type Quote,
} from "@/lib/quotes";
import { isoFromEpochSeconds, parseBrapiQuote, parseYahooChart } from "@/lib/quotes/providers";
import { applyQuotePlan, type QuoteWriter } from "@/lib/quotes/apply";

describe("símbolo canônico", () => {
  test("ações e FIIs da B3, com ou sem sufixo", () => {
    expect(normalizeSymbol("PETR4")).toBe("PETR4");
    expect(normalizeSymbol("petr4")).toBe("PETR4");
    expect(normalizeSymbol("PETR4.SA")).toBe("PETR4");
    expect(normalizeSymbol("HGLG11")).toBe("HGLG11");
    expect(normalizeSymbol("  BOVA11  ")).toBe("BOVA11");
    expect(normalizeSymbol("PETR4 - Petrobras PN")).toBe("PETR4");
  });

  test("pares de moeda em três grafias", () => {
    expect(normalizeSymbol("USD/BRL")).toBe("USD/BRL");
    expect(normalizeSymbol("usd-brl")).toBe("USD/BRL");
    expect(normalizeSymbol("USDBRL")).toBe("USD/BRL");
  });

  test("ticker de fundo não vira par cambial", () => {
    // FIAGRO casa com o formato XXXYYY, mas não é par de moedas.
    expect(normalizeSymbol("FIAGRO")).toBeNull();
    expect(normalizeSymbol("ABCDEF")).toBeNull();
  });

  test("ação americana exige prefixo explícito", () => {
    expect(normalizeSymbol("us:aapl")).toBe("US:AAPL");
    expect(normalizeSymbol("AAPL.US")).toBe("US:AAPL");
    // "AAPL" puro é ambíguo com B3 — não é cotado às cegas.
    expect(normalizeSymbol("AAPL")).toBeNull();
  });

  test("o que não é papel negociado não é cotável", () => {
    expect(normalizeSymbol("Fazenda Boa Vista")).toBeNull();
    expect(normalizeSymbol("")).toBeNull();
    expect(isQuotable(null)).toBe(false);
    expect(isQuotable("HGLG11")).toBe(true);
  });

  test("tradução para cada provedor", () => {
    expect(toYahooSymbol("PETR4")).toBe("PETR4.SA");
    expect(toYahooSymbol("usd/brl")).toBe("USDBRL=X");
    expect(toYahooSymbol("us:aapl")).toBe("AAPL");
    expect(toBrapiSymbol("PETR4.SA")).toBe("PETR4");
    expect(toBrapiSymbol("USD/BRL")).toBe("USDBRL");
    expect(toBrapiSymbol("US:AAPL")).toBeNull();
  });
});

describe("parsers dos provedores", () => {
  const yahooPayload = {
    chart: {
      result: [
        {
          meta: {
            currency: "BRL",
            symbol: "PETR4.SA",
            regularMarketPrice: 53.05,
            regularMarketTime: 1793380892,
            longName: "Petróleo Brasileiro S.A. - Petrobras",
          },
        },
      ],
      error: null,
    },
  };

  const brapiPayload = {
    results: [
      {
        symbol: "PETR4",
        currency: "BRL",
        regularMarketPrice: 53.07,
        regularMarketTime: "2026-10-30T17:07:00.000Z",
        longName: "Petroleo Brasileiro SA Pfd",
      },
    ],
  };

  test("Yahoo: preço, moeda, data e nome", () => {
    const quote = parseYahooChart(yahooPayload, "PETR4.SA");
    expect(quote).not.toBeNull();
    expect(quote!.symbol).toBe("PETR4");
    expect(quote!.price).toBeCloseTo(53.05, 2);
    expect(quote!.currency).toBe("BRL");
    expect(quote!.source).toBe("yahoo");
    expect(quote!.asOf).toBe(isoFromEpochSeconds(1793380892, "2026-01-01"));
    expect(quote!.name).toContain("Petrobras");
  });

  test("Yahoo: payload de erro ou sem preço devolve null", () => {
    expect(parseYahooChart({ chart: { result: null, error: {} } }, "PETR4")).toBeNull();
    expect(parseYahooChart({ chart: { result: [{ meta: {} }] } }, "PETR4")).toBeNull();
  });

  test("brapi: usa regularMarketTime ISO como data", () => {
    const quote = parseBrapiQuote(brapiPayload, "PETR4");
    expect(quote!.price).toBeCloseTo(53.07, 2);
    expect(quote!.asOf).toBe("2026-10-30");
    expect(quote!.source).toBe("brapi");
  });

  test("brapi: sem regularMarketTime cai para a data de hoje", () => {
    const quote = parseBrapiQuote(
      { results: [{ symbol: "HGLG11", regularMarketPrice: 160.2 }] },
      "HGLG11",
      new Date("2026-10-30T12:00:00Z"),
    );
    expect(quote!.asOf).toBe("2026-10-30");
  });
});

describe("frescor do preço", () => {
  const today = new Date("2026-10-30T12:00:00Z");

  test("conta dias entre datas ISO", () => {
    expect(daysBetween("2026-10-01", "2026-10-31")).toBe(30);
    expect(daysBetween(null, "2026-10-31")).toBeNull();
    expect(daysBetween("data-ruim", "2026-10-31")).toBeNull();
  });

  test("classifica atual, atenção, defasado e sem preço", () => {
    expect(classifyFreshness("2026-10-29", 53.05, today)).toBe("atual");
    expect(classifyFreshness("2026-10-10", 53.05, today)).toBe("atencao");
    expect(classifyFreshness("2026-08-01", 53.05, today)).toBe("defasado");
    expect(classifyFreshness("2026-10-29", 0, today)).toBe("sem-preco");
  });
});

describe("plano de atualização", () => {
  const quote = (symbol: string, price: number, asOf: string): Quote => ({
    symbol,
    price,
    asOf,
    currency: "BRL",
    source: "yahoo",
  });

  const positions = [
    { id: "p1", symbol: "PETR4", name: "Petrobras PN", quantity: 1000, unit_price: 50, as_of: "2026-09-30" },
    { id: "p2", symbol: "HGLG11", name: "CSHG Logística", quantity: 500, unit_price: 160.2, as_of: "2026-10-30" },
    { id: "p3", symbol: null, name: "Fazenda Boa Vista", quantity: 1, unit_price: 48_000_000, as_of: "2026-06-30" },
    { id: "p4", symbol: "VALE3", name: "Vale ON", quantity: 0, unit_price: 60, as_of: "2026-09-30" },
  ];

  test("atualiza só o que mudou, ignora o resto e calcula o delta em R$", () => {
    const plan = planQuoteUpdates(positions, [
      quote("PETR4", 53.05, "2026-10-30"),
      quote("HGLG11", 160.2, "2026-10-30"),
    ]);

    expect(plan.updates).toHaveLength(1);
    const update = plan.updates[0];
    expect(update.positionId).toBe("p1");
    expect(update.toPrice).toBeCloseTo(53.05, 2);
    expect(update.deltaPct).toBeCloseTo(6.1, 1);
    // 1000 papéis × (53,05 − 50,00)
    expect(plan.totalDeltaBrl).toBeCloseTo(3050, 2);

    // HGLG11 já está no preço e na data → sem atualização
    expect(plan.unchanged).toBe(1);
    // Fazenda não tem símbolo cotável; VALE3 tem quantidade zero
    expect(plan.notQuotable.map((item) => item.positionId).sort()).toEqual(["p3", "p4"]);
  });

  test("cotação mais antiga que a posição não rebaixa o preço", () => {
    const plan = planQuoteUpdates(
      [{ id: "p1", symbol: "PETR4", quantity: 10, unit_price: 53, as_of: "2026-10-30" }],
      [quote("PETR4", 40, "2026-09-01")],
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  test("símbolo pedido e não retornado entra em missing", () => {
    const plan = planQuoteUpdates(positions, []);
    expect(plan.missing.sort()).toEqual(["HGLG11", "PETR4"]);
  });

  test("posição sem preço anterior recebe o primeiro preço (delta 0%)", () => {
    const plan = planQuoteUpdates(
      [{ id: "p9", symbol: "BOVA11", quantity: 100, unit_price: 0, as_of: "2026-01-01" }],
      [quote("BOVA11", 135.4, "2026-10-30")],
    );
    expect(plan.updates[0].deltaPct).toBe(0);
    expect(plan.totalDeltaBrl).toBeCloseTo(13_540, 2);
  });

  test("símbolos cotáveis da carteira vêm únicos e ordenados", () => {
    expect(quotableSymbols(positions)).toEqual(["HGLG11", "PETR4"]);
  });
});

describe("aplicação do plano (escrita)", () => {
  const quote = (symbol: string, price: number, asOf = "2026-10-30"): Quote => ({
    symbol,
    price,
    asOf,
    currency: "BRL",
    source: "yahoo",
  });

  function fakeWriter(options: { failPosition?: string; failRun?: boolean } = {}) {
    const calls: string[] = [];
    const positions: { id: string; patch: Record<string, unknown> }[] = [];
    let quotesWritten = 0;
    const writer: QuoteWriter = {
      upsertQuotes: async (list) => {
        calls.push("quotes");
        quotesWritten = list.length;
      },
      updatePosition: async (id, patch) => {
        calls.push(`position:${id}`);
        if (options.failPosition === id) throw new Error("RLS negou a atualização");
        positions.push({ id, patch: patch as unknown as Record<string, unknown> });
      },
      logRun: async () => {
        calls.push("run");
        if (options.failRun) throw new Error("tabela quote_runs ausente");
      },
    };
    return { writer, calls, positions, quotes: () => quotesWritten };
  }

  const plan = (ids: string[]): ReturnType<typeof planQuoteUpdates> => ({
    updates: ids.map((id) => ({
      positionId: id,
      symbol: "PETR4",
      fromPrice: 41.2,
      toPrice: 53.06,
      fromAsOf: "2026-06-30",
      toAsOf: "2026-10-30",
      source: "yahoo" as const,
      deltaPct: 28.79,
    })),
    unchanged: 0,
    notQuotable: [],
    missing: [],
    totalDeltaBrl: 355_800,
  });

  test("grava série → posições → auditoria, nessa ordem", async () => {
    const fake = fakeWriter();
    const result = await applyQuotePlan(fake.writer, [quote("PETR4", 53.06)], plan(["p1", "p2"]), {
      provider: "yahoo",
      symbolsRequested: 1,
      errors: [],
    });
    expect(fake.calls).toEqual(["quotes", "position:p1", "position:p2", "run"]);
    expect(result.positionsUpdated).toBe(2);
    expect(result.quotesWritten).toBe(1);
    expect(result.runLogged).toBe(true);
    expect(fake.positions[0].patch).toEqual({
      unit_price: 53.06,
      as_of: "2026-10-30",
      price_source: "yahoo",
    });
  });

  test("preço inválido e duplicata não entram na série", async () => {
    const fake = fakeWriter();
    const result = await applyQuotePlan(
      fake.writer,
      [quote("PETR4", 53.06), quote("PETR4", 53.06), quote("VALE3", 0)],
      plan([]),
      { provider: "yahoo", symbolsRequested: 2, errors: [] },
    );
    expect(result.quotesWritten).toBe(1);
  });

  test("falha em uma posição não derruba as outras", async () => {
    const fake = fakeWriter({ failPosition: "p1" });
    const result = await applyQuotePlan(fake.writer, [quote("PETR4", 53.06)], plan(["p1", "p2"]), {
      provider: "yahoo",
      symbolsRequested: 1,
      errors: [],
    });
    expect(result.positionsUpdated).toBe(1);
    expect(result.positionErrors).toEqual([{ positionId: "p1", message: "RLS negou a atualização" }]);
    expect(result.runLogged).toBe(true);
  });

  test("falha na auditoria não desfaz o preço já gravado", async () => {
    const fake = fakeWriter({ failRun: true });
    const result = await applyQuotePlan(fake.writer, [quote("PETR4", 53.06)], plan(["p1"]), {
      provider: "yahoo",
      symbolsRequested: 1,
      errors: [],
    });
    expect(result.positionsUpdated).toBe(1);
    expect(result.runLogged).toBe(false);
  });
});
