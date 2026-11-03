import { describe, expect, test } from "bun:test";
import {
  DEFAULT_POLICY,
  buildMonthlyReport,
  formatMonthlyReportText,
  type MonthlyReportInput,
} from "@/lib/reports/monthly";
import { brlCompact, competenciaBounds, competenciaLabel, signedBrl, signedPct } from "@/lib/reports/format";

const POSITIONS = [
  {
    id: "p1",
    name: "Tesouro IPCA+ 2035",
    symbol: null,
    asset_class: "renda_fixa",
    currency: "BRL",
    quantity: 1_500,
    unit_price: 3_180,
    cost_basis: 4_500_000,
    custodian: "XP Private",
  },
  {
    id: "p2",
    name: "Petrobras PN",
    symbol: "PETR4",
    asset_class: "renda_variavel",
    currency: "BRL",
    quantity: 30_000,
    unit_price: 55,
    cost_basis: 1_020_000,
    custodian: "BTG Core",
  },
  {
    id: "p3",
    name: "CSHG Logística",
    symbol: "HGLG11",
    asset_class: "fundos",
    currency: "BRL",
    quantity: 10_000,
    unit_price: 148.8,
    cost_basis: 1_600_000,
    custodian: "XP Private",
  },
  {
    id: "p4",
    name: "Caixa holding",
    symbol: null,
    asset_class: "caixa",
    currency: "BRL",
    quantity: 1_200_000,
    unit_price: 1,
    cost_basis: 1_200_000,
    custodian: "XP Private",
  },
];

const QUOTES = [
  { symbol: "PETR4", asOf: "2026-10-01", price: 52 },
  { symbol: "PETR4", asOf: "2026-10-31", price: 55 },
  { symbol: "HGLG11", asOf: "2026-10-01", price: 156 },
  { symbol: "HGLG11", asOf: "2026-10-31", price: 148.8 },
  { symbol: "PETR4", asOf: "2026-01-02", price: 50 },
  { symbol: "HGLG11", asOf: "2026-01-02", price: 160 },
];

const BASE: MonthlyReportInput = {
  competencia: "2026-10",
  issuedAt: "2026-11-01",
  clientName: "Família Almeida",
  entityName: "Holding Almeida",
  positions: POSITIONS,
  quotes: QUOTES,
  snapshots: [
    { as_of: "2026-09-30", market_value: 7_400_000 },
    { as_of: "2026-10-15", market_value: 7_480_000, net_flow: 60_000 },
    { as_of: "2026-10-31", market_value: 7_536_400, net_flow: 20_000 },
  ],
  liabilities: [
    {
      id: "l1",
      name: "CCB rural",
      kind: "rural",
      outstanding: 4_000_000,
      rate_annual: 8.5,
      amortization: "price",
      term_months: 60,
      due_date: "2031-10-31",
      collateral: "Fazenda",
    },
    {
      id: "l2",
      name: "Nota comercial",
      kind: "comercial",
      outstanding: 2_400_000,
      rate_annual: 14,
      amortization: "bullet",
      term_months: 24,
      due_date: "2028-10-31",
    },
  ],
  registeredAssets: [{ current_value: 60_400_000 }],
  goals: [
    {
      id: "g1",
      name: "Reserva de liquidez",
      kind: "liquidez",
      target_amount: 3_000_000,
      allocated: 1_200_000,
      target_date: "2028-12-31",
      priority: 1,
      expected_return: 10,
    },
    {
      id: "g2",
      name: "Sucessão e impostos",
      kind: "sucessao",
      target_amount: 12_000_000,
      allocated: 2_000_000,
      target_date: "2027-06-30",
      priority: 2,
      expected_return: 8,
    },
  ],
  today: "2026-10-31",
};

describe("competência e formatação", () => {
  test("rótulo e limites do mês", () => {
    expect(competenciaLabel("2026-10")).toBe("Outubro de 2026");
    expect(competenciaBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(competenciaBounds("2028-02").to).toBe("2028-02-29");
    expect(competenciaBounds("2026-12").to).toBe("2026-12-31");
  });

  test("valores compactos e assinados em pt-BR", () => {
    expect(brlCompact(57_536_400)).toBe("R$ 57,5 mi");
    expect(brlCompact(128_989)).toBe("R$ 129 mil");
    expect(signedPct(2.345)).toBe("+2,35%");
    expect(signedPct(-1.2)).toBe("-1,20%");
    expect(signedBrl(-4_200)).toBe("-R$ 4.200");
    expect(signedBrl(0)).toBe("+R$ 0");
  });
});

describe("relatório mensal", () => {
  test("metadados vêm do input, com fallback explícito", () => {
    const report = buildMonthlyReport(BASE);
    expect(report.meta.label).toBe("Outubro de 2026");
    expect(report.meta.periodFrom).toBe("2026-10-01");
    expect(report.meta.client).toBe("Família Almeida");

    const semNome = buildMonthlyReport({ ...BASE, clientName: null, entityName: "  " });
    expect(semNome.meta.client).toBe("Cliente");
    expect(semNome.meta.entity).toBe("Consolidado do grupo familiar");
  });

  test("patrimônio líquido, alavancagem e serviço da dívida", () => {
    const report = buildMonthlyReport(BASE);
    // 4.770.000 + 1.650.000 + 1.488.000 + 1.200.000
    expect(report.summary.financial).toBe(9_108_000);
    expect(report.summary.registered).toBe(60_400_000);
    expect(report.summary.debt).toBe(6_400_000);
    expect(report.summary.netWorth).toBe(9_108_000 + 60_400_000 - 6_400_000);
    expect(report.summary.leverage).toBeCloseTo((6_400_000 / 69_508_000) * 100, 1);
    expect(report.summary.monthlyService).toBeGreaterThan(0);
  });

  test("evolução separa aporte de retorno de mercado", () => {
    const { evolution } = buildMonthlyReport(BASE);
    expect(evolution.previousDate).toBe("2026-09-30");
    expect(evolution.previousValue).toBe(7_400_000);
    expect(evolution.currentValue).toBe(7_536_400);
    expect(evolution.change).toBe(136_400);
    expect(evolution.netFlow).toBe(80_000);
    // o que sobrou da variação é retorno, não aporte
    expect(evolution.marketGain).toBe(56_400);
    expect(evolution.changePct).toBeCloseTo((136_400 / 7_400_000) * 100, 2);
  });

  test("sem fechamento anterior a série começa agora, sem inventar variação", () => {
    const { evolution } = buildMonthlyReport({ ...BASE, snapshots: [] });
    expect(evolution.previousValue).toBeNull();
    expect(evolution.previousDate).toBeNull();
    expect(evolution.change).toBe(0);
    expect(evolution.changePct).toBeNull();
    // sem snapshot, o valor corrente vem da própria carteira
    expect(evolution.currentValue).toBe(9_108_000);
  });

  test("retorno do mês usa o preço de fechamento do mês, não o acumulado", () => {
    const report = buildMonthlyReport(BASE);
    // PETR4 52 → 55 (+5,77%) com peso ~21,9% ⇒ contribuição ~1,26 p.p.
    const petr = report.attribution.month.positions.find((row) => row.name === "Petrobras PN")!;
    expect(petr.source).toBe("cotacao");
    expect(petr.returnPct).toBeCloseTo((55 / 52 - 1) * 100, 2);
    // no ano, a base é 02/01 (50) ⇒ retorno maior
    const petrYtd = report.attribution.ytd.positions.find((row) => row.name === "Petrobras PN")!;
    expect(petrYtd.returnPct).toBeCloseTo(10, 2);
    expect(report.summary.ytdReturnPct).not.toBe(report.summary.monthReturnPct);
  });

  test("janelas de atribuição encolhem até a primeira cotação e são declaradas", () => {
    const report = buildMonthlyReport(BASE);
    expect(report.attribution.windows.monthFrom).toBe("2026-10-01");
    expect(report.attribution.windows.ytdFrom).toBe("2026-01-02");

    const semSerieNoAno = buildMonthlyReport({
      ...BASE,
      quotes: QUOTES.filter((quote) => quote.asOf >= "2026-10-01"),
    });
    // sem cotação em janeiro, a janela do ano não finge medir 10 meses
    expect(semSerieNoAno.attribution.windows.ytdFrom).toBe("2026-10-01");
  });

  test("a soma das contribuições por classe fecha com o retorno do mês", () => {
    const report = buildMonthlyReport(BASE);
    const soma = report.attribution.month.byClass.reduce((total, bucket) => total + bucket.contribution, 0);
    expect(soma).toBeCloseTo(report.summary.monthReturnPct, 6);
    expect(report.summary.monthGain).toBeCloseTo(report.attribution.month.totals.gain, 2);
  });

  test("classes cruzam política-alvo com retorno da atribuição", () => {
    const report = buildMonthlyReport(BASE);
    expect(report.classes.length).toBe(DEFAULT_POLICY.length);
    const rendaFixa = report.classes.find((row) => row.key === "renda_fixa")!;
    expect(rendaFixa.target).toBe(30);
    expect(rendaFixa.drift).toBeCloseTo(rendaFixa.actual - 30, 2);
    // sem série de cotação, retorno vem do custo (Tesouro IPCA+ teve ágio sobre o custo)
    expect(rendaFixa.returnPct).toBeGreaterThan(0);
    expect(report.classes.every((row) => Number.isFinite(row.contribution))).toBe(true);
  });

  test("alavancagem alta e dívida cara viram pendência ordenada por severidade", () => {
    const report = buildMonthlyReport({
      ...BASE,
      liabilities: [
        { id: "l3", name: "Capital de giro", kind: "giro", outstanding: 40_000_000, rate_annual: 18 },
      ],
    });
    const severities = report.pendencies.map((item) => item.severity);
    const order = { alta: 0, media: 1, baixa: 2 } as const;
    const sorted = [...severities].sort((a, b) => order[a] - order[b]);
    expect(severities).toEqual(sorted);
    expect(report.pendencies.some((item) => item.area === "Dívida")).toBe(true);
    expect(report.pendencies.some((item) => item.area === "Dados")).toBe(true);
  });

  test("meta vencida e meta em risco aparecem como pendência alta", () => {
    const report = buildMonthlyReport(BASE);
    const metas = report.pendencies.filter((item) => item.area === "Metas");
    expect(metas.length).toBeGreaterThan(0);
    expect(metas.every((item) => item.severity === "alta" || item.severity === "media")).toBe(true);
  });

  test("pendências são limitadas a oito e nunca vazias de conteúdo", () => {
    const report = buildMonthlyReport({
      ...BASE,
      quotes: [],
      liabilities: Array.from({ length: 12 }, (_, index) => ({
        id: `lx${index}`,
        name: `Operação ${index}`,
        kind: "giro",
        outstanding: 1_000_000,
        rate_annual: 15,
      })),
    });
    expect(report.pendencies.length).toBeLessThanOrEqual(8);
    expect(report.pendencies.every((item) => item.text.length > 20)).toBe(true);
  });

  test("manchete e narrativa citam os números do mês", () => {
    const report = buildMonthlyReport(BASE);
    expect(report.narrative.headline).toContain("Patrimônio líquido");
    expect(report.narrative.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(report.narrative.paragraphs.join(" ")).toContain("aportes líquidos");
    expect(report.narrative.nextSteps.length).toBeGreaterThan(0);
    expect(report.narrative.nextSteps.length).toBeLessThanOrEqual(4);
  });

  test("carteira vazia degrada sem quebrar", () => {
    const report = buildMonthlyReport({
      competencia: "2026-10",
      positions: [],
      issuedAt: "2026-11-01",
    });
    expect(report.summary.netWorth).toBe(0);
    expect(report.summary.coverage).toBe(0);
    expect(report.classes.length).toBe(DEFAULT_POLICY.length);
    expect(report.narrative.headline.length).toBeGreaterThan(0);
    expect(report.pendencies.some((item) => item.area === "Dados")).toBe(true);
    const text = formatMonthlyReportText(report);
    expect(text).toContain("PENDÊNCIAS");
    expect(text).toContain("Dados");
    // sem carteira, não se acusa desvio de política
    expect(report.pendencies.some((item) => item.area === "Política")).toBe(false);
  });

  test("exportação texto traz as seções do documento", () => {
    const text = formatMonthlyReportText(buildMonthlyReport(BASE));
    expect(text).toContain("RELATÓRIO DE OUTUBRO DE 2026");
    expect(text).toContain("RESUMO");
    expect(text).toContain("ALOCAÇÃO VS POLÍTICA");
    expect(text).toContain("PENDÊNCIAS");
    expect(text).toContain("PRÓXIMOS PASSOS");
    expect(text).toContain("Família Almeida");
  });

  test("política customizada muda o desvio e a pendência", () => {
    const report = buildMonthlyReport({
      ...BASE,
      policy: [
        { asset_class: "renda_fixa", target: 20 },
        { asset_class: "caixa", target: 5 },
        { asset_class: "renda_variavel", target: 20 },
        { asset_class: "fundos", target: 10 },
      ],
      tolerance: 2,
    });
    const rendaFixa = report.classes.find((row) => row.key === "renda_fixa")!;
    expect(rendaFixa.target).toBe(20);
    expect(report.classes.every((row) => row.breach === Math.abs(row.drift) > 2)).toBe(true);
  });
});
