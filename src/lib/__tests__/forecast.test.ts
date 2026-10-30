import { describe, expect, test } from "bun:test";
import {
  detectRecurringFlows,
  flowDirection,
  liquidBalance,
  normalizeKey,
  projectCashFlow,
  type ForecastFlow,
} from "@/lib/forecast";

const flow = (date: string, amount: number, kind: string, description: string): ForecastFlow => ({
  date,
  amount,
  kind,
  description,
});

const MONTHLY_OUT = [
  flow("2026-06-05", 42_000, "resgate", "Folha de pagamento"),
  flow("2026-07-05", 43_000, "resgate", "Folha de pagamento"),
  flow("2026-08-05", 41_500, "resgate", "Folha de pagamento"),
  flow("2026-09-05", 44_000, "resgate", "Folha de pagamento"),
];

const MONTHLY_IN = [
  flow("2026-06-10", 185_000, "provento", "Arrendamento Fazenda Boa Vista"),
  flow("2026-07-10", 185_000, "provento", "Arrendamento Fazenda Boa Vista"),
  flow("2026-08-10", 185_000, "provento", "Arrendamento Fazenda Boa Vista"),
];

describe("detecção de recorrência", () => {
  test("reconhece fluxo mensal e usa o valor mediano", () => {
    const recurring = detectRecurringFlows(MONTHLY_OUT);
    expect(recurring).toHaveLength(1);
    expect(recurring[0].occurrences).toBe(4);
    expect(recurring[0].direction).toBe("out");
    expect(recurring[0].monthlyAmount).toBe(42_500); // mediana de 41,5k | 42k | 43k | 44k
    expect(recurring[0].regularity).toBe(1);
  });

  test("duas ocorrências não bastam (evita inventar recorrência)", () => {
    expect(detectRecurringFlows(MONTHLY_IN.slice(0, 2))).toHaveLength(0);
  });

  test("fluxo esporádico não é projetado", () => {
    const sporadic = [
      flow("2026-01-15", 500_000, "aporte", "Venda de soja"),
      flow("2026-05-20", 320_000, "aporte", "Venda de soja"),
      flow("2026-09-28", 450_000, "aporte", "Venda de soja"),
    ];
    expect(detectRecurringFlows(sporadic)).toHaveLength(0);
  });

  test("numeração na descrição não quebra o agrupamento", () => {
    const withNumbers = [
      flow("2026-06-05", 1_000, "taxa", "Tarifa pacote 001"),
      flow("2026-07-05", 1_000, "taxa", "Tarifa pacote 002"),
      flow("2026-08-05", 1_000, "taxa", "Tarifa pacote 003"),
    ];
    expect(detectRecurringFlows(withNumbers)).toHaveLength(1);
  });

  test("entrada e saída com mesmo rótulo são grupos distintos", () => {
    const mixed = [
      flow("2026-06-05", 1_000, "resgate", "Repasse"),
      flow("2026-07-05", 1_000, "resgate", "Repasse"),
      flow("2026-08-05", 1_000, "resgate", "Repasse"),
      flow("2026-06-06", 900, "provento", "Repasse"),
      flow("2026-07-06", 900, "provento", "Repasse"),
      flow("2026-08-06", 900, "provento", "Repasse"),
    ];
    const recurring = detectRecurringFlows(mixed);
    expect(recurring).toHaveLength(2);
    expect(recurring.map((item) => item.direction).sort()).toEqual(["in", "out"]);
  });

  test("normalização e direção", () => {
    expect(normalizeKey("Arrendamento  Fazenda nº 12/2026")).toBe("arrendamento fazenda n #");
    expect(flowDirection("aporte")).toBe("in");
    expect(flowDirection("provento")).toBe("in");
    expect(flowDirection("imposto")).toBe("out");
  });
});

describe("saldo líquido", () => {
  test("só D+0 e D+1 entram no caixa por padrão", () => {
    const positions = [
      { asset_class: "caixa", liquidity: "d0", quantity: 100_000, unit_price: 1 },
      { asset_class: "renda_fixa", liquidity: "d1", quantity: 1_000, unit_price: 320 },
      { asset_class: "fundos", liquidity: "d30", quantity: 5_000, unit_price: 200 },
      { asset_class: "imoveis", liquidity: "iliquido", quantity: 1, unit_price: 48_000_000 },
    ];
    expect(liquidBalance(positions)).toBe(420_000);
    expect(liquidBalance(positions, true)).toBe(1_420_000);
  });
});

describe("projeção", () => {
  const positions = [
    { asset_class: "caixa", liquidity: "d0", quantity: 2_000_000, unit_price: 1 },
  ];

  test("sem fluxos e sem juros o saldo fica parado", () => {
    const result = projectCashFlow({ positions, flows: [] }, { months: 12, annualYield: 0 });
    expect(result.series).toHaveLength(12);
    expect(result.series[11].closingBalance).toBe(2_000_000);
    expect(result.stats.totalYield).toBe(0);
    expect(result.alert).toBe("ok");
  });

  test("juros compostos sobre o saldo médio, mês a mês", () => {
    const result = projectCashFlow({ positions, flows: [] }, { months: 12, annualYield: 12 });
    const rate = Math.pow(1.12, 1 / 12) - 1;
    expect(result.series[0].yield).toBeCloseTo(2_000_000 * rate, 0);
    expect(result.stats.endingLiquid).toBeGreaterThan(2_150_000);
    expect(result.stats.endingLiquid).toBeLessThan(2_300_000);
  });

  test("recorrências entram como entrada e saída mês a mês", () => {
    const result = projectCashFlow(
      { positions, flows: [...MONTHLY_IN, ...MONTHLY_OUT] },
      { months: 6, annualYield: 0 },
    );
    expect(result.recurring).toHaveLength(2);
    expect(result.series[0].inflow).toBeCloseTo(185_000, 2);
    expect(result.series[0].outflow).toBeCloseTo(42_500, 2);
    expect(result.stats.netMonthlyAverage).toBeCloseTo(142_500, 2);
    expect(result.stats.endingLiquid).toBeCloseTo(2_000_000 + 142_500 * 6, 2);
  });

  test("queima de caixa vira alerta crítico com mês do primeiro negativo", () => {
    const heavyOut = [
      flow("2026-06-05", 900_000, "resgate", "Distribuição aos sócios"),
      flow("2026-07-05", 900_000, "resgate", "Distribuição aos sócios"),
      flow("2026-08-05", 900_000, "resgate", "Distribuição aos sócios"),
    ];
    const result = projectCashFlow(
      { positions, flows: heavyOut },
      { months: 12, annualYield: 0 },
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(result.alert).toBe("critico");
    expect(result.stats.monthsNegative).toBeGreaterThan(0);
    // 2,0M − 900k em out, − 900k em nov, negativo em dez
    expect(result.stats.firstNegativeMonth).toBe("2026-12");
    expect(result.stats.runwayMonths).toBe(2);
    expect(result.stats.minLiquid).toBeLessThan(0);
  });

  test("horizonte respeita o limite de 1 a 60 meses", () => {
    expect(projectCashFlow({ positions, flows: [] }, { months: 120, annualYield: 0 }).series).toHaveLength(60);
    expect(projectCashFlow({ positions, flows: [] }, { months: 0, annualYield: 0 }).series).toHaveLength(1);
  });

  test("lançamento avulso agendado entra no mês certo", () => {
    const result = projectCashFlow(
      {
        positions,
        flows: [],
        scheduled: [
          { date: "2026-12-20", amount: 380_000, direction: "out", label: "ITCMD" },
          { date: "2026-12-28", amount: 100_000, direction: "in", label: "Venda de bezerros" },
        ],
      },
      { months: 4, annualYield: 0 },
      new Date("2026-10-01T00:00:00Z"),
    );
    const december = result.series.find((month) => month.month === "2026-12")!;
    expect(december.outflow).toBeCloseTo(380_000, 2);
    expect(december.inflow).toBeCloseTo(100_000, 2);
    expect(result.series[0].outflow).toBe(0);
  });

  test("reajuste pela inflação acelera a saída recorrente", () => {
    const base = projectCashFlow(
      { positions, flows: MONTHLY_OUT },
      { months: 12, annualYield: 0 },
      new Date("2026-10-01T00:00:00Z"),
    );
    const adjusted = projectCashFlow(
      { positions, flows: MONTHLY_OUT },
      { months: 12, annualYield: 0, inflation: 12, adjustRecurringToInflation: true },
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(adjusted.stats.totalOut).toBeGreaterThan(base.stats.totalOut);
  });

  test("patrimônio ilíquido não paga conta", () => {
    const realEstate = [
      { asset_class: "imoveis", liquidity: "iliquido", quantity: 1, unit_price: 48_000_000 },
    ];
    const result = projectCashFlow({ positions: realEstate, flows: MONTHLY_OUT }, { months: 12, annualYield: 0 });
    expect(result.stats.startingLiquid).toBe(0);
    expect(result.alert).toBe("critico");
  });
});
