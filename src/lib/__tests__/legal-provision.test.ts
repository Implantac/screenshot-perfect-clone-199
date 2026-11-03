import { describe, expect, it } from "bun:test";
import {
  DEFAULT_LEGAL_ASSUMPTIONS,
  assessCase,
  buildProvisionReport,
  classifyBand,
  computeRollforward,
  monthsUntil,
  presentValueFactor,
  resolveProbability,
  type LegalCaseLike,
  type ProvisionEntryLike,
} from "@/lib/legal/provision";

const TODAY = "2026-11-03";

function makeCase(overrides: Partial<LegalCaseLike> = {}): LegalCaseLike {
  return {
    id: "caso-1",
    case_number: "5001234-56.2024.8.16.0001",
    title: "Ação de retificação de área",
    type: "imobiliario",
    status: "em_andamento",
    risk_level: "high",
    value_at_stake: 1_000_000,
    polarity: "passivo",
    probability: 0.6,
    phase: "instrucao",
    expected_settlement: "2028-11-03",
    ...overrides,
  };
}

const inDays = (days: number) =>
  new Date(Date.parse(TODAY) + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

describe("probabilidade de perda", () => {
  it("usa o percentual informado pelo jurídico quando existe", () => {
    const resolved = resolveProbability(makeCase({ probability: 0.72 }));
    expect(resolved.probability).toBe(0.72);
    expect(resolved.source).toBe("informada");
  });

  it("limita o percentual informado a 98% — processo nenhum é certeza", () => {
    expect(resolveProbability(makeCase({ probability: 1 })).probability).toBe(0.98);
  });

  it("processo encerrado tem probabilidade zero", () => {
    const resolved = resolveProbability(makeCase({ status: "encerrado", probability: 0.9 }));
    expect(resolved.probability).toBe(0);
    expect(classifyBand(resolved.probability)).toBe("remota");
  });

  it("sem número informado, estima por risco e fase", () => {
    const resolved = resolveProbability(
      makeCase({ probability: null, risk_level: "critical", phase: "instrucao" }),
    );
    expect(resolved.probability).toBe(0.75);
    expect(resolved.source).toBe("premissa");
  });

  it("sentença soma 10 p.p. à estimativa; conhecimento subtrai 5 p.p.", () => {
    expect(resolveProbability(makeCase({ probability: null, risk_level: "high", phase: "sentenca" })).probability).toBeCloseTo(0.7, 5);
    expect(resolveProbability(makeCase({ probability: null, risk_level: "high", phase: "conhecimento" })).probability).toBeCloseTo(0.55, 5);
  });

  it("a estimativa nunca passa de 98% nem cai abaixo de 2%", () => {
    expect(resolveProbability(makeCase({ probability: null, risk_level: "critical", phase: "execucao" })).probability).toBeLessThanOrEqual(0.98);
    expect(resolveProbability(makeCase({ probability: null, risk_level: "low", phase: "conhecimento" })).probability).toBeGreaterThanOrEqual(0.02);
  });
});

describe("faixas contábeis", () => {
  it("50% já é provável — o corte do CPC 25 é 'mais provável que não'", () => {
    expect(classifyBand(0.5)).toBe("provavel");
    expect(classifyBand(0.499)).toBe("possivel");
  });

  it("10% ainda é possível; abaixo disso é remota", () => {
    expect(classifyBand(0.11)).toBe("possivel");
    expect(classifyBand(0.1)).toBe("remota");
    expect(classifyBand(0.01)).toBe("remota");
  });
});

describe("valor presente", () => {
  it("desembolso dentro de 12 meses não desconta", () => {
    expect(presentValueFactor(6)).toBe(1);
    expect(presentValueFactor(12)).toBe(1);
  });

  it("dois anos desconta pela taxa declarada de 10% a.a.", () => {
    expect(presentValueFactor(24)).toBeCloseTo(1 / 1.1 ** 2, 6);
  });

  it("prazo em dias vira fração de mês", () => {
    expect(monthsUntil(inDays(365), TODAY)).toBeCloseTo(11.99, 1);
    expect(monthsUntil("2028-11-03", TODAY)).toBeCloseTo(24, 0);
    expect(monthsUntil(null, TODAY)).toBeNull();
  });
});

describe("avaliação de um processo", () => {
  it("provável passivo reconhece provisão igual ao valor esperado descontado", () => {
    const assessed = assessCase(makeCase({ probability: 0.6, value_at_stake: 1_000_000 }), {
      today: TODAY,
    });
    expect(assessed.band).toBe("provavel");
    expect(assessed.expectedValue).toBe(600_000);
    expect(assessed.provision).toBeCloseTo(600_000 * presentValueFactor(assessed.settlementMonths), 2);
    expect(assessed.disclosed).toBe(0);
  });

  it("possível não reconhece nada e entra em nota", () => {
    const assessed = assessCase(makeCase({ probability: 0.3 }), { today: TODAY });
    expect(assessed.band).toBe("possivel");
    expect(assessed.provision).toBe(0);
    expect(assessed.disclosed).toBeGreaterThan(0);
  });

  it("remota não reconhece nem divulga", () => {
    const assessed = assessCase(makeCase({ probability: 0.05 }), { today: TODAY });
    expect(assessed.band).toBe("remota");
    expect(assessed.provision).toBe(0);
    expect(assessed.disclosed).toBe(0);
  });

  it("causa ativa nunca vira ativo: só recuperação esperada divulgada", () => {
    const assessed = assessCase(makeCase({ polarity: "ativo", probability: 0.8 }), { today: TODAY });
    expect(assessed.provision).toBe(0);
    expect(assessed.disclosed).toBe(0);
    expect(assessed.expectedRecovery).toBeGreaterThan(0);
    expect(assessed.warnings.some((warning) => warning.includes("vedado"))).toBe(true);
  });

  it("sem data de desembolso assume o prazo padrão e avisa", () => {
    const assessed = assessCase(makeCase({ expected_settlement: null }), { today: TODAY });
    expect(assessed.settlementEstimated).toBe(true);
    expect(assessed.settlementMonths).toBe(DEFAULT_LEGAL_ASSUMPTIONS.defaultSettlementMonths);
    expect(assessed.warnings.some((warning) => warning.includes("Sem data prevista"))).toBe(true);
  });

  it("processo sem valor não entra no cálculo, mas continua listado", () => {
    const assessed = assessCase(makeCase({ value_at_stake: null }), { today: TODAY });
    expect(assessed.valueAtStake).toBe(0);
    expect(assessed.provision).toBe(0);
    expect(assessed.warnings.length).toBeGreaterThan(0);
  });

  it("taxa de desconto é premissa substituível", () => {
    const base = assessCase(makeCase(), { today: TODAY });
    const harsher = assessCase(makeCase(), {
      today: TODAY,
      assumptions: { ...DEFAULT_LEGAL_ASSUMPTIONS, discountRateAnnual: 0.2 },
    });
    expect(harsher.provision).toBeLessThan(base.provision);
  });
});

describe("rollforward da provisão", () => {
  const entries: ProvisionEntryLike[] = [
    { case_id: "caso-1", kind: "constituicao", amount: 400_000, occurred_on: "2025-12-20" },
    { case_id: "caso-1", kind: "atualizacao", amount: 40_000, occurred_on: "2026-06-30" },
    { case_id: "caso-2", kind: "constituicao", amount: 100_000, occurred_on: "2026-02-10" },
    { case_id: "caso-2", kind: "reversao", amount: 30_000, occurred_on: "2026-08-01" },
    { case_id: "caso-3", kind: "baixa", amount: 20_000, occurred_on: "2026-09-15" },
    { case_id: "caso-1", kind: "constituicao", amount: 999_000, occurred_on: "2027-03-01" },
  ];

  it("separa saldo inicial, movimentos e baixas do período", () => {
    const rollforward = computeRollforward(entries, "2026-01-01", "2026-12-31");
    expect(rollforward.opening).toBe(400_000);
    expect(rollforward.additions).toBe(100_000);
    expect(rollforward.monetaryUpdate).toBe(40_000);
    expect(rollforward.reversals).toBe(30_000);
    expect(rollforward.settlements).toBe(20_000);
    expect(rollforward.closing).toBe(490_000);
    // o lançamento de 2025 virou saldo inicial, não movimento do período
    expect(rollforward.entries).toBe(4);
  });

  it("ignora lançamentos fora do período", () => {
    const rollforward = computeRollforward(entries, "2026-01-01", "2026-12-31");
    expect(rollforward.closing).toBeLessThan(1_000_000);
  });
});

describe("relatório de contingências", () => {
  const cases: LegalCaseLike[] = [
    makeCase({
      id: "grande",
      title: "Execução fiscal de IPTU",
      type: "tributario",
      value_at_stake: 4_000_000,
      probability: 0.7,
      expected_settlement: inDays(180),
    }),
    makeCase({
      id: "trabalhista",
      title: "Reclamação trabalhista",
      type: "trabalhista",
      value_at_stake: 800_000,
      probability: 0.55,
      expected_settlement: inDays(400),
    }),
    makeCase({
      id: "possivel",
      title: "Ação ambiental",
      type: "ambiental",
      risk_level: "medium",
      value_at_stake: 1_000_000,
      probability: 0.25,
      expected_settlement: inDays(500),
    }),
    makeCase({
      id: "remota",
      title: "Cobrança indevida",
      type: "civel",
      risk_level: "low",
      value_at_stake: 200_000,
      probability: 0.05,
    }),
    makeCase({
      id: "ativo",
      title: "Repetição de indébito",
      type: "tributario",
      polarity: "ativo",
      value_at_stake: 500_000,
      probability: 0.8,
      expected_settlement: inDays(730),
    }),
  ];

  const report = buildProvisionReport({
    cases,
    entries: [{ case_id: "grande", kind: "constituicao", amount: 2_800_000, occurred_on: "2025-05-01" }],
    netWorth: 20_000_000,
    liquid: 3_000_000,
    today: TODAY,
    periodFrom: "2026-01-01",
    periodTo: "2026-12-31",
  });

  it("soma a provisão só dos prováveis passivos", () => {
    const expected = report.cases
      .filter((item) => item.polarity === "passivo" && item.band === "provavel")
      .reduce((sum, item) => sum + item.provision, 0);
    expect(report.totals.provision).toBeCloseTo(expected, 2);
    expect(report.totals.provision).toBeGreaterThan(3_000_000);
  });

  it("conta as faixas e as causas ativas separadamente", () => {
    expect(report.totals.probableCases).toBe(2);
    expect(report.totals.possibleCases).toBe(1);
    expect(report.totals.remoteCases).toBe(1);
    expect(report.totals.activeCases).toBe(1);
    expect(report.totals.expectedRecovery).toBeGreaterThan(0);
  });

  it("PL ajustado é o PL da wave 11 menos a provisão", () => {
    expect(report.equity.adjustedNetWorth).toBeCloseTo(20_000_000 - report.totals.provision, 2);
    expect(report.equity.provisionToEquity).toBeCloseTo((report.totals.provision / 20_000_000) * 100, 1);
  });

  it("pior caso soma provisão e possíveis, sem tocar nas remotas", () => {
    expect(report.equity.worstCaseNetWorth).toBeCloseTo(
      20_000_000 - report.totals.provision - report.totals.disclosed,
      2,
    );
    expect(report.equity.worstCaseDrop).toBeLessThan(0);
  });

  it("ordena os processos pelo impacto no balanço", () => {
    const provisions = report.cases.map((item) => item.provision);
    expect([...provisions].sort((a, b) => b - a)).toEqual(provisions);
  });

  it("quebra por tipo e os percentuais fecham em 100", () => {
    const share = report.byType.reduce((sum, row) => sum + row.shareOfProvision, 0);
    expect(share).toBeCloseTo(100, 0);
    expect(report.byType[0].type).toBe("tributario");
  });

  it("cobertura de liquidez é a provisão dividida pelo caixa disponível", () => {
    expect(report.liquidity.coverageMonths).toBeCloseTo((3_000_000 / report.totals.provision) * 12, 1);
  });

  it("sensibilidade mostra o efeito de 10 p.p. a mais de probabilidade", () => {
    const row = report.sensitivity.find((item) => item.id === "grande");
    expect(row).toBeDefined();
    expect(row!.provisionPlus10).toBeGreaterThan(row!.provisionNow);
    expect(row!.equityImpactPlus10).toBeLessThan(0);
  });

  it("avisa concentração em um único processo", () => {
    expect(report.warnings.some((warning) => warning.includes("concentra"))).toBe(true);
  });

  it("avisa quando a provisão passa de 15% do PL", () => {
    expect(report.warnings.some((warning) => warning.includes("% do PL"))).toBe(true);
  });

  it("avisa sobre recuperação esperada não reconhecida", () => {
    expect(report.warnings.some((warning) => warning.includes("recuperação esperada"))).toBe(true);
  });

  it("avisa quando o saldo escriturado não fecha com a provisão recalculada", () => {
    expect(report.warnings.some((warning) => warning.includes("difere da provisão recalculada"))).toBe(true);
  });

  it("carteira sem processos devolve balanço intacto e nenhum aviso de concentração", () => {
    const empty = buildProvisionReport({ cases: [], netWorth: 5_000_000, today: TODAY });
    expect(empty.totals.provision).toBe(0);
    expect(empty.equity.adjustedNetWorth).toBe(5_000_000);
    expect(empty.warnings.some((warning) => warning.includes("concentra"))).toBe(false);
    expect(empty.byType.length).toBe(0);
  });

  it("probabilidade estimada é contada para o pedido de dado ao jurídico", () => {
    const estimated = buildProvisionReport({
      cases: [makeCase({ probability: null, risk_level: "critical", phase: "instrucao" })],
      netWorth: 10_000_000,
      today: TODAY,
    });
    expect(estimated.totals.estimatedProbabilityCases).toBe(1);
    expect(estimated.warnings.some((warning) => warning.includes("estimada por risco e fase"))).toBe(true);
  });

  it("processo sem contingência não provisiona nem divulga, só avisa", () => {
    const neutral = assessCase(
      makeCase({ polarity: "neutro", value_at_stake: 68_500_000, probability: 0.9 }),
      { today: TODAY },
    );
    expect(neutral.provision).toBe(0);
    expect(neutral.disclosed).toBe(0);
    expect(neutral.expectedRecovery).toBe(0);
    expect(neutral.warnings.some((warning) => warning.includes("não provisionado"))).toBe(true);

    const reportNeutral = buildProvisionReport({
      cases: [makeCase({ polarity: "neutro", value_at_stake: 68_500_000 })],
      netWorth: 63_000_000,
      today: TODAY,
    });
    expect(reportNeutral.totals.provision).toBe(0);
    expect(reportNeutral.totals.neutralCases).toBe(1);
    expect(reportNeutral.equity.adjustedNetWorth).toBe(63_000_000);
  });

  it("avisa quando o processo encerrado ainda tem lançamento aberto", () => {
    const closed = buildProvisionReport({
      cases: [makeCase({ id: "x", status: "encerrado" })],
      entries: [{ case_id: "x", kind: "constituicao", amount: 100_000, occurred_on: "2025-01-10" }],
      netWorth: 10_000_000,
      today: TODAY,
    });
    expect(closed.warnings.some((warning) => warning.includes("baixa"))).toBe(true);
  });
});
