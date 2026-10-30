/**
 * Testes do núcleo de riqueza: performance, alocação, sucessório e qualidade.
 * Todos os números esperados foram calculados à mão nos comentários.
 */
import { describe, expect, test } from "bun:test";
import {
  benchmarkReturn,
  computeMaxDrawdown,
  computeTwr,
  computeVolatility,
  computeXirr,
  indexSeries,
  summarizePerformance,
} from "@/lib/wealth/performance";
import {
  allocationByClass,
  concentrationIndex,
  computeDrift,
  positionValue,
  summarizeAllocation,
} from "@/lib/wealth/allocation";
import {
  compareScenarios,
  computeItcmd,
  estateFraction,
  ITCMD_TABLE,
  simulateSuccession,
  successionInsights,
} from "@/lib/wealth/succession";
import { buildQualityReport } from "@/lib/wealth/quality";

// ------------------------------------------------------------------ TWR

describe("TWR (time-weighted return)", () => {
  test("crescimento de 10% sem fluxo vira 10%", () => {
    const result = computeTwr([
      { as_of: "2026-01-31", market_value: 100_000 },
      { as_of: "2026-02-28", market_value: 110_000 },
    ]);
    expect(result.cumulative).toBeCloseTo(10, 6);
    expect(result.periods).toBe(1);
  });

  test("aporte não é confundido com retorno (o erro clássico do setor)", () => {
    // 100k → 160k com aporte de 50k ⇒ retorno real 10%, não 60%.
    const result = computeTwr([
      { as_of: "2026-01-31", market_value: 100_000 },
      { as_of: "2026-02-28", market_value: 160_000, net_flow: 50_000 },
    ]);
    expect(result.cumulative).toBeCloseTo(10, 6);
  });

  test("resgate também é neutralizado", () => {
    // 100k → 88k com resgate de 22k ⇒ 10% de alta.
    const result = computeTwr([
      { as_of: "2026-01-31", market_value: 100_000 },
      { as_of: "2026-02-28", market_value: 88_000, net_flow: -22_000 },
    ]);
    expect(result.cumulative).toBeCloseTo(10, 6);
  });

  test("encadeia múltiplos sub-períodos geometricamente", () => {
    // +10%, -10%, +10% ⇒ 1.1*0.9*1.1 = 1.089 ⇒ 8.9% (não 10%).
    const result = computeTwr([
      { as_of: "2026-01-31", market_value: 100 },
      { as_of: "2026-02-28", market_value: 110 },
      { as_of: "2026-03-31", market_value: 99 },
      { as_of: "2026-04-30", market_value: 108.9 },
    ]);
    expect(result.cumulative).toBeCloseTo(8.9, 6);
  });

  test("primeira posição sem histórico (base zero) não estoura", () => {
    const result = computeTwr([
      { as_of: "2026-01-31", market_value: 0 },
      { as_of: "2026-02-28", market_value: 100_000, net_flow: 100_000 },
    ]);
    expect(Number.isFinite(result.cumulative)).toBe(true);
    expect(result.cumulative).toBeCloseTo(0, 6);
  });

  test("anualiza só acima de 365 dias e informa o período", () => {
    const short = computeTwr([
      { as_of: "2026-01-31", market_value: 100 },
      { as_of: "2026-03-31", market_value: 110 },
    ]);
    expect(short.annualized).toBeNull();

    const long = computeTwr([
      { as_of: "2025-01-31", market_value: 100 },
      { as_of: "2026-01-31", market_value: 110 },
    ]);
    expect(long.annualized).toBeCloseTo(10, 1);
    expect(long.spanDays).toBe(365);
  });
});

describe("MWR / XIRR", () => {
  test("aporte único por 1 ano com 10% de ganho rende 10% a.a.", () => {
    const irr = computeXirr([{ flow_date: "2025-01-31", amount: 100_000, kind: "aporte" }], 110_000, "2026-01-31");
    expect(irr).toBeCloseTo(10, 1);
  });

  test("dois aportes e resgate final: IRR entre as taxas dos fluxos", () => {
    const irr = computeXirr(
      [
        { flow_date: "2025-01-01", amount: 100_000, kind: "aporte" },
        { flow_date: "2025-07-01", amount: 100_000, kind: "aporte" },
      ],
      221_000,
      "2026-01-01",
    );
    expect(irr).not.toBeNull();
    expect(irr!).toBeGreaterThan(5);
    expect(irr!).toBeLessThan(15);
  });

  test("sem fluxo de saída (só aportes) retorna null em vez de inventar taxa", () => {
    expect(computeXirr([{ flow_date: "2025-01-01", amount: 100_000, kind: "aporte" }], 0, "2026-01-01")).toBeNull();
  });
});

describe("drawdown, volatilidade e benchmark", () => {
  test("drawdown máximo do pico ao vale", () => {
    const result = computeMaxDrawdown([
      { as_of: "2026-01-31", market_value: 100 },
      { as_of: "2026-02-28", market_value: 120 },
      { as_of: "2026-03-31", market_value: 90 },
      { as_of: "2026-04-30", market_value: 130 },
    ]);
    expect(result.maxDrawdown).toBeCloseTo(-25, 4); // 120 → 90
    expect(result.troughDate).toBe("2026-03-31");
  });

  test("série estritamente crescente não tem drawdown", () => {
    const result = computeMaxDrawdown([
      { as_of: "2026-01-31", market_value: 100 },
      { as_of: "2026-02-28", market_value: 110 },
    ]);
    expect(result.maxDrawdown).toBe(0);
  });

  test("volatilidade precisa de ao menos 3 pontos", () => {
    expect(computeVolatility([{ as_of: "2026-01-31", market_value: 100 }])).toBeNull();
  });

  test("benchmark: CDI de 10% em 365 dias ≈ 10%", () => {
    expect(benchmarkReturn(10, 365)).toBeCloseTo(10, 0);
    expect(benchmarkReturn(10, 0)).toBe(0);
  });

  test("indexSeries começa em 100", () => {
    const series = indexSeries([
      { as_of: "2026-01-31", market_value: 100 },
      { as_of: "2026-02-28", market_value: 110 },
    ]);
    expect(series[0].value).toBe(100);
    expect(series[1].value).toBeCloseTo(110, 4);
  });

  test("resumo junta TWR, MWR, benchmark e ganho não realizado", () => {
    const summary = summarizePerformance(
      [
        { as_of: "2025-01-31", market_value: 100_000, cost_basis: 100_000 },
        { as_of: "2026-01-31", market_value: 120_000, cost_basis: 100_000 },
      ],
      [{ flow_date: "2025-01-31", amount: 100_000, kind: "aporte" }],
    );
    expect(summary.twr.cumulative).toBeCloseTo(20, 4);
    expect(summary.benchmark.name).toBe("CDI");
    expect(summary.benchmark.excess).toBeCloseTo(20 - benchmarkReturn(summary.benchmark.annualRate, summary.twr.spanDays), 2);
  });
});

// -------------------------------------------------------------- alocação

const POSITIONS = [
  { asset_class: "renda_fixa", liquidity: "d1", name: "CDB XP", quantity: 1000, unit_price: 100, currency: "BRL" },
  { asset_class: "renda_variavel", liquidity: "d1", name: "PETR4", quantity: 1000, unit_price: 50, currency: "BRL" },
  { asset_class: "imoveis", liquidity: "iliquido", name: "Galpão", quantity: 1, unit_price: 50_000, currency: "BRL" },
];

describe("alocação", () => {
  test("valor da posição tolera numeric como string", () => {
    expect(positionValue({ asset_class: "caixa", name: "X", quantity: "10", unit_price: "2.5" })).toBe(25);
  });

  test("soma por classe e percentual fecham 100%", () => {
    const buckets = allocationByClass(POSITIONS);
    const total = buckets.reduce((s, b) => s + b.percentage, 0);
    expect(total).toBeCloseTo(100, 2);
    expect(buckets[0].key).toBe("renda_fixa"); // 100k de 200k
  });

  test("concentração: carteira de um item só = 1", () => {
    expect(concentrationIndex([{ asset_class: "caixa", name: "X", quantity: 1, unit_price: 100 }])).toBe(1);
  });

  test("concentração cai quando a carteira pulveriza", () => {
    const spread = [
      { asset_class: "caixa", name: "A", quantity: 1, unit_price: 100 },
      { asset_class: "caixa", name: "B", quantity: 1, unit_price: 100 },
      { asset_class: "caixa", name: "C", quantity: 1, unit_price: 100 },
    ];
    expect(concentrationIndex(spread)).toBeCloseTo(0, 4);
  });

  test("liquidez separa D+0/D+1 do ilíquido", () => {
    const summary = summarizeAllocation(POSITIONS);
    expect(summary.liquidPercentage).toBeCloseTo(75, 2); // 150k de 200k
    expect(summary.byLiquidity.find((b) => b.key === "iliquido")?.percentage).toBeCloseTo(25, 2);
  });

  test("drift aponta a ação correta e marca rompimento de banda", () => {
    const rows = computeDrift(POSITIONS, [
      { asset_class: "renda_fixa", target: 20 },
      { asset_class: "renda_variavel", target: 60 },
      { asset_class: "imoveis", target: 20 },
    ]);
    const rendaFixa = rows.find((r) => r.key === "renda_fixa")!;
    expect(rendaFixa.actual).toBeCloseTo(50, 2);
    expect(rendaFixa.action).toBe("reduzir");
    expect(rendaFixa.breach).toBe(true); // 30 p.p. acima
  });

  test("offshore é medido separadamente", () => {
    const summary = summarizeAllocation([
      { asset_class: "internacional", name: "ETF", quantity: 1, unit_price: 100, is_offshore: true },
      { asset_class: "caixa", name: "CDB", quantity: 1, unit_price: 300 },
    ]);
    expect(summary.offshorePercentage).toBeCloseTo(25, 2);
  });
});

// ------------------------------------------------------------ sucessório

describe("ITCMD", () => {
  test("Paraná: alíquota progressiva por faixa", () => {
    // 300k no PR: 150k*2% = 3.000 + 150k*4% = 6.000 → 9.000 (3% efetivo)
    const result = computeItcmd(300_000, "PR");
    expect(result.tax).toBeCloseTo(9_000, 2);
    expect(result.effectiveRate).toBeCloseTo(3, 4);
  });

  test("São Paulo: alíquota única de 4%", () => {
    expect(computeItcmd(10_000_000, "SP").tax).toBeCloseTo(400_000, 2);
  });

  test("RS: faixa de isenção até 400k", () => {
    expect(computeItcmd(400_000, "RS").tax).toBe(0);
    expect(computeItcmd(500_000, "RS").tax).toBeCloseTo(6_000, 2); // 100k * 6%
  });

  test("UF desconhecida cai no default em vez de quebrar", () => {
    expect(computeItcmd(300_000, "XX").tax).toBeCloseTo(computeItcmd(300_000, "PR").tax, 2);
  });

  test("base zero não gera imposto", () => {
    expect(computeItcmd(0, "PR").tax).toBe(0);
  });

  test("toda UF da tabela tem faixas válidas e termina em faixa aberta", () => {
    for (const [, table] of Object.entries(ITCMD_TABLE)) {
      expect(table.brackets.length).toBeGreaterThan(0);
      expect(table.brackets[table.brackets.length - 1].upTo).toBeNull();
    }
  });
});

describe("sucessão", () => {
  test("meação: comunhão parcial sai 50%, separação total não protege", () => {
    expect(estateFraction("comunhao_parcial")).toBe(0.5);
    expect(estateFraction("separacao_total")).toBe(1);
  });

  test("simulação completa com inventário e honorários", () => {
    // 10M, comunhão parcial, PR: espólio 5M → ITCMD 150+150+300+4.4M*8%
    const result = simulateSuccession({
      patrimony: 10_000_000,
      regime: "comunhao_parcial",
      state: "PR",
      heirs: 3,
    });
    expect(result.meacao).toBe(5_000_000);
    expect(result.estate).toBe(5_000_000);
    expect(result.inventoryCost).toBe(400_000); // 8%
    expect(result.legalFees).toBe(300_000); // 6%
    expect(result.totalCost).toBeGreaterThan(1_000_000);
    expect(result.perHeir).toBeCloseTo((10_000_000 - result.totalCost) / 3, 2);
    expect(result.legitima).toBe(2_500_000);
    expect(result.availablePortion).toBe(2_500_000);
  });

  test("doação em vida elimina o custo de inventário", () => {
    const base = simulateSuccession({ patrimony: 10_000_000, regime: "comunhao_parcial", state: "PR", heirs: 2 });
    const donated = simulateSuccession({
      patrimony: 10_000_000,
      regime: "comunhao_parcial",
      state: "PR",
      heirs: 2,
      donateInLife: true,
    });
    expect(donated.inventoryCost).toBe(0);
    expect(donated.totalCost).toBeLessThan(base.totalCost);
  });

  test("comparação de cenários ordena do mais caro ao mais barato", () => {
    const scenarios = compareScenarios({ patrimony: 10_000_000, regime: "comunhao_parcial", state: "PR", heirs: 2 });
    expect(scenarios).toHaveLength(3);
    const base = scenarios[0];
    const holding = scenarios.find((s) => s.label === "Holding familiar")!;
    expect(holding.deltaVsBase).toBeGreaterThan(0); // economia positiva
    expect(base.deltaVsBase).toBe(0);
  });

  test("insights apontam separação total e custo alto", () => {
    const result = simulateSuccession({
      patrimony: 50_000_000,
      regime: "separacao_total",
      state: "SP",
      heirs: 1,
    });
    const notes = successionInsights(result, 1);
    expect(notes.some((n) => /separação total/i.test(n))).toBe(true);
  });
});

// -------------------------------------------------------------- qualidade

describe("qualidade de dados", () => {
  const today = new Date();
  const iso = (offsetDays: number) =>
    new Date(today.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);

  test("tenant vazio tem score máximo e nenhum achado", () => {
    const report = buildQualityReport({});
    expect(report.score).toBe(100);
    expect(report.grade).toBe("A");
    expect(report.findings).toHaveLength(0);
  });

  test("posição sem preço derruba 25 pontos e vira achado crítico", () => {
    const report = buildQualityReport({
      // account_id presente para isolar o achado de precificação do de cadastro.
      positions: [{ name: "Fundo X", account_id: "acc-1", quantity: 10, unit_price: 0, as_of: iso(-1) }],
    });
    expect(report.score).toBe(75);
    expect(report.findings[0]).toMatchObject({ id: "unpriced", severity: "critical" });
  });

  test("documento vencido é crítico e entra no relatório", () => {
    const report = buildQualityReport({
      documents: [{ title: "Matrícula 1", expiry_date: iso(-10), status: "regular" }],
    });
    expect(report.findings.some((f) => f.id === "docs-expired")).toBe(true);
    expect(report.grade).not.toBe("A");
  });

  test("ativo sem matrícula ou localização é sinalizado", () => {
    const report = buildQualityReport({ assets: [{ name: "Fazenda", value: 1_000_000 }] });
    expect(report.findings.some((f) => f.id === "assets-registry")).toBe(true);
  });

  test("posição antiga (> 30 dias) é marcada como preço velho", () => {
    const report = buildQualityReport({
      positions: [{ name: "PETR4", quantity: 100, unit_price: 40, as_of: iso(-45) }],
    });
    expect(report.findings.some((f) => f.id === "stale")).toBe(true);
  });

  test("duplicidade de nome é detectada", () => {
    const report = buildQualityReport({
      positions: [
        { name: "CDB XP", quantity: 1, unit_price: 100, as_of: iso(0) },
        { name: "cdb xp", quantity: 1, unit_price: 100, as_of: iso(0) },
      ],
    });
    expect(report.findings.some((f) => f.id === "duplicates")).toBe(true);
  });

  test("score nunca fica negativo mesmo com tudo errado", () => {
    const report = buildQualityReport({
      positions: [
        { name: "A", quantity: 0, unit_price: 0, as_of: iso(-90) },
        { name: "A", quantity: 0, unit_price: 0, as_of: iso(-90) },
      ],
      documents: [{ title: "D1", expiry_date: iso(-5) }, { title: "D2", expiry_date: iso(-1) }],
      assets: [{ name: "X", value: 1 }],
    });
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThan(40);
    expect(report.grade).toBe("E");
  });
});
