import { describe, expect, test } from "bun:test";
import {
  computeAttribution,
  currencyBreakdown,
  indexQuotes,
  latestPrice,
  priceAt,
  type AttributionPosition,
  type PricePoint,
} from "@/lib/wealth/attribution";

const TODAY = new Date("2026-10-30T00:00:00Z");

const position = (over: Partial<AttributionPosition> = {}): AttributionPosition => ({
  id: "p1",
  name: "Petrobras PN",
  symbol: "PETR4",
  asset_class: "renda_variavel",
  currency: "BRL",
  quantity: 10_000,
  unit_price: 55,
  cost_basis: 400_000,
  custodian: "XP Private",
  ...over,
});

const quotes: PricePoint[] = [
  { symbol: "PETR4", asOf: "2026-01-02", price: 50 },
  { symbol: "PETR4", asOf: "2026-06-30", price: 44 },
  { symbol: "PETR4", asOf: "2026-10-30", price: 55 },
  { symbol: "HGLG11", asOf: "2026-01-02", price: 160 },
  { symbol: "HGLG11", asOf: "2026-10-30", price: 148.8 },
  { symbol: "USD/BRL", asOf: "2026-01-02", price: 5.0 },
  { symbol: "USD/BRL", asOf: "2026-10-30", price: 5.5 },
];

describe("série de preços", () => {
  test("indexa e ordena por data", () => {
    const map = indexQuotes([...quotes, { symbol: "PETR4", asOf: "2026-03-01", price: 46 }]);
    const petr = map.get("PETR4")!;
    expect(petr.map((p) => p.asOf)).toEqual(["2026-01-02", "2026-03-01", "2026-06-30", "2026-10-30"]);
  });

  test("preço na data usa o mais recente até ela (para trás)", () => {
    const list = indexQuotes(quotes).get("PETR4")!;
    expect(priceAt(list, "2026-01-02")).toBe(50);
    // 15/05 é depois de 02/01 e antes de 30/06 → ainda vale o preço de janeiro
    expect(priceAt(list, "2026-05-15")).toBe(50);
    expect(priceAt(list, "2026-07-15")).toBe(44);
    expect(priceAt(list, "2025-12-01")).toBeNull();
    expect(priceAt(list, "2027-01-01")).toBe(55);
    expect(latestPrice(list)).toBe(55);
  });

  test("preço inválido é ignorado", () => {
    const map = indexQuotes([{ symbol: "X", asOf: "2026-01-01", price: 0 }]);
    expect(map.has("X")).toBe(false);
  });
});

describe("atribuição por posição", () => {
  test("retorno vem da série de cotações no período", () => {
    const result = computeAttribution(
      {
        positions: [position()],
        quotes,
        periodStart: "2026-01-02",
        periodEnd: "2026-10-30",
      },
      TODAY,
    );
    const row = result.positions[0];
    // 50 → 55 = +10%
    expect(row.source).toBe("cotacao");
    expect(row.returnPct).toBeCloseTo(10, 6);
    expect(row.weight).toBeCloseTo(100, 6);
    expect(row.contribution).toBeCloseTo(10, 6);
    expect(result.totals.returnPct).toBeCloseTo(10, 6);
    expect(result.totals.coverage).toBeCloseTo(100, 6);
  });

  test("sem série, cai para o custo de aquisição e marca a fonte", () => {
    const result = computeAttribution(
      { positions: [position({ symbol: null, unit_price: 55, cost_basis: 500_000 })], quotes: [] },
      TODAY,
    );
    const row = result.positions[0];
    expect(row.source).toBe("custo");
    // 550.000 / 500.000 − 1 = 10%
    expect(row.returnPct).toBeCloseTo(10, 6);
    expect(result.totals.coverage).toBe(0);
    expect(result.totals.unpricedValue).toBe(550_000);
    expect(result.warnings[0]).toContain("acumulados desde o custo");
  });

  test("posição sem preço e sem custo não inventa retorno", () => {
    const result = computeAttribution(
      { positions: [position({ symbol: null, cost_basis: 0, unit_price: 55 })], quotes: [] },
      TODAY,
    );
    expect(result.positions[0].source).toBe("sem-preco");
    expect(result.positions[0].returnPct).toBe(0);
  });
});

describe("contribuição e fechamento", () => {
  const positions = [
    position({ id: "a", symbol: "PETR4", quantity: 10_000, unit_price: 55 }),
    position({
      id: "b",
      name: "CSHG Logística",
      symbol: "HGLG11",
      asset_class: "fundos",
      quantity: 10_000,
      unit_price: 148.8,
      custodian: "BTG Core",
    }),
    position({
      id: "c",
      name: "CDB liquidez",
      symbol: null,
      asset_class: "caixa",
      quantity: 1_000_000,
      unit_price: 1,
      cost_basis: 1_000_000,
      custodian: "XP Private",
    }),
  ];

  test("as contribuições somam o retorno da carteira", () => {
    const result = computeAttribution(
      { positions, quotes, periodStart: "2026-01-02", periodEnd: "2026-10-30" },
      TODAY,
    );
    const sum = result.positions.reduce((total, row) => total + row.contribution, 0);
    expect(sum).toBeCloseTo(result.totals.returnPct, 1);

    // PETR4 +10%, HGLG11 −7%, caixa 0% (sem série, custo = valor)
    const petr = result.positions.find((row) => row.id === "a")!;
    const hglg = result.positions.find((row) => row.id === "b")!;
    expect(petr.returnPct).toBeCloseTo(10, 6);
    expect(hglg.returnPct).toBeCloseTo(-7, 6);
    expect(hglg.contribution).toBeLessThan(0);
  });

  test("pesos somam 100%", () => {
    const result = computeAttribution(
      { positions, quotes, periodStart: "2026-01-02", periodEnd: "2026-10-30" },
      TODAY,
    );
    const weight = result.positions.reduce((total, row) => total + row.weight, 0);
    expect(weight).toBeCloseTo(100, 1);
  });

  test("agrupa por classe, custodiante e moeda", () => {
    const result = computeAttribution(
      { positions, quotes, periodStart: "2026-01-02", periodEnd: "2026-10-30" },
      TODAY,
    );
    expect(result.byClass.map((item) => item.key).sort()).toEqual(["caixa", "fundos", "renda_variavel"]);
    expect(result.byCustodian.map((item) => item.key).sort()).toEqual(["BTG Core", "XP Private"]);
    expect(result.byCurrency).toHaveLength(1);
    // retorno do bucket de renda variável = retorno das posições dele
    const rv = result.byClass.find((item) => item.key === "renda_variavel")!;
    expect(rv.returnPct).toBeCloseTo(10, 6);
    expect(rv.positions).toBe(1);
  });

  test("melhores e piores contribuintes", () => {
    const result = computeAttribution(
      { positions, quotes, periodStart: "2026-01-02", periodEnd: "2026-10-30" },
      TODAY,
    );
    expect(result.best[0].id).toBe("a");
    expect(result.worst[0].id).toBe("b");
  });

  test("custodiante ausente recebe rótulo explícito", () => {
    const result = computeAttribution(
      { positions: [position({ custodian: null })], quotes, periodStart: "2026-01-02" },
      TODAY,
    );
    expect(result.byCustodian[0].label).toBe("Sem custodiante");
  });
});

describe("câmbio e arrasto de caixa", () => {
  test("posição em dólar decompõe retorno local e cambial", () => {
    const result = computeAttribution(
      {
        positions: [
          position({
            id: "us",
            name: "Vanguard Total World",
            symbol: "US:VT",
            asset_class: "internacional",
            currency: "USD",
            quantity: 1_000,
            unit_price: 275, // 250 → 275 = +10% em USD; USD/BRL 5,00 → 5,50 = +10%
            cost_basis: 250_000,
          }),
        ],
        quotes: [
          { symbol: "US:VT", asOf: "2026-01-02", price: 250 },
          { symbol: "US:VT", asOf: "2026-10-30", price: 275 },
          { symbol: "USD/BRL", asOf: "2026-01-02", price: 5 },
          { symbol: "USD/BRL", asOf: "2026-10-30", price: 5.5 },
        ],
        periodStart: "2026-01-02",
        periodEnd: "2026-10-30",
      },
      TODAY,
    );
    const row = result.positions[0];
    expect(row.returnPct).toBeCloseTo(10, 6);
    expect(row.fxReturnPct).toBeCloseTo(10, 6);
    // (1,10)/(1,10) − 1 = 0% de retorno local
    expect(row.localReturnPct).toBeCloseTo(0, 6);

    const breakdown = currencyBreakdown(result);
    expect(breakdown[0].currency).toBe("USD");
    expect(breakdown[0].fxReturnPct).toBeCloseTo(10, 6);
    expect(breakdown[0].localReturnPct).toBeCloseTo(0, 6);
  });

  test("moeda sem série de câmbio não inventa decomposição", () => {
    const result = computeAttribution(
      {
        positions: [position({ currency: "EUR", symbol: "US:VT", quantity: 100, unit_price: 100 })],
        quotes: [{ symbol: "US:VT", asOf: "2026-01-02", price: 90 }, { symbol: "US:VT", asOf: "2026-10-30", price: 100 }],
        periodStart: "2026-01-02",
        periodEnd: "2026-10-30",
      },
      TODAY,
    );
    expect(result.positions[0].fxReturnPct).toBeUndefined();
    expect(currencyBreakdown(result)[0].fxReturnPct).toBeNull();
  });

  test("caixa pesado rendendo menos que a média gera arrasto", () => {
    const result = computeAttribution(
      {
        positions: [
          position({ id: "rv", quantity: 10_000, unit_price: 55 }),
          position({
            id: "cx",
            name: "Caixa",
            symbol: null,
            asset_class: "caixa",
            quantity: 900_000,
            unit_price: 1,
            cost_basis: 900_000,
          }),
        ],
        quotes,
        periodStart: "2026-01-02",
        periodEnd: "2026-10-30",
      },
      TODAY,
    );
    expect(result.cashDrag).toBeLessThan(0);
    expect(result.warnings.join(" ")).toContain("arrasto");
  });
});

describe("bordas", () => {
  test("carteira vazia não quebra", () => {
    const result = computeAttribution({ positions: [] }, TODAY);
    expect(result.positions).toHaveLength(0);
    expect(result.totals.value).toBe(0);
    expect(result.totals.returnPct).toBe(0);
    expect(result.totals.coverage).toBe(0);
    expect(result.cashDrag).toBe(0);
  });

  test("posição com quantidade zero é ignorada", () => {
    const result = computeAttribution({ positions: [position({ quantity: 0 })], quotes }, TODAY);
    expect(result.positions).toHaveLength(0);
  });

  test("CNPJ de fundo tem precedência sobre o rótulo do símbolo", () => {
    const result = computeAttribution(
      {
        positions: [
          position({
            symbol: "FIM-MULTI",
            instrument_id: "00.017.024/0001-53",
            quantity: 1_000,
            unit_price: 50,
          }),
        ],
        quotes: [
          { symbol: "FUND:00017024000153", asOf: "2026-01-02", price: 40 },
          { symbol: "FUND:00017024000153", asOf: "2026-10-30", price: 50 },
        ],
        periodStart: "2026-01-02",
        periodEnd: "2026-10-30",
      },
      TODAY,
    );
    expect(result.positions[0].source).toBe("cotacao");
    expect(result.positions[0].returnPct).toBeCloseTo(25, 6);
  });
});
