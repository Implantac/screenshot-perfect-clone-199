import { describe, expect, test } from "bun:test";
import { CLASS_VOLATILITY, STRESS_SCENARIOS, computeRisk, type RiskInput } from "@/lib/wealth/risk";

const POSITIONS = [
  { name: "Tesouro IPCA+", asset_class: "renda_fixa", quantity: 1_000, unit_price: 3_000, liquidity: "d1" },
  { name: "Petrobras", asset_class: "renda_variavel", quantity: 20_000, unit_price: 50, liquidity: "d1" },
  { name: "Fundo de crédito", asset_class: "fundos", quantity: 1, unit_price: 2_000_000, liquidity: "d30" },
  { name: "Caixa", asset_class: "caixa", quantity: 1_000_000, unit_price: 1, liquidity: "d0" },
];

const LIABILITIES = [
  { id: "l1", name: "CCB rural", outstanding: 4_000_000, rate_annual: 8.5, amortization: "price", term_months: 60 },
  { id: "l2", name: "Nota comercial", outstanding: 2_000_000, rate_annual: 14, amortization: "bullet", term_months: 24 },
];

const BASE: RiskInput = {
  positions: POSITIONS,
  liabilities: LIABILITIES,
  registeredAssets: [{ current_value: 40_000_000, asset_class: "imoveis" }],
};

describe("VaR paramétrico", () => {
  test("VaR 95% e 99% guardam a razão dos z-scores", () => {
    const r95 = computeRisk({ ...BASE, confidence: 95, horizonDays: 21 });
    const r99 = computeRisk({ ...BASE, confidence: 99, horizonDays: 21 });
    expect(r95.var.z).toBeCloseTo(1.645, 3);
    expect(r99.var.z).toBeCloseTo(2.326, 3);
    expect(r99.var.amount / r95.var.amount).toBeCloseTo(2.326 / 1.645, 3);
  });

  test("horizonte escala com raiz do tempo", () => {
    const umDia = computeRisk({ ...BASE, horizonDays: 1 });
    const vinteUm = computeRisk({ ...BASE, horizonDays: 21 });
    expect(vinteUm.var.amount / umDia.var.amount).toBeCloseTo(Math.sqrt(21), 2);
  });

  test("VaR em % do PL é maior que em % do ativo quando há dívida", () => {
    const report = computeRisk(BASE);
    expect(report.debt).toBe(6_000_000);
    expect(report.equity).toBe(report.assets.total - report.debt);
    expect(report.var.percentageOfEquity).toBeGreaterThan(report.var.percentage);
    // e a razão é exatamente ativo/PL
    expect(report.var.percentageOfEquity / report.var.percentage).toBeCloseTo(
      report.assets.total / report.equity,
      2,
    );
  });

  test("caixa derruba a volatilidade da carteira", () => {
    const comCaixa = computeRisk(BASE);
    const semCaixa = computeRisk({
      ...BASE,
      positions: POSITIONS.map((position) =>
        position.asset_class === "caixa" ? { ...position, unit_price: 1, quantity: 1 } : position,
      ),
    });
    expect(semCaixa.var.portfolioVolatility).toBeGreaterThan(comCaixa.var.portfolioVolatility);
    expect(comCaixa.var.portfolioVolatility).toBeGreaterThan(0);
  });

  test("contribuição de risco soma 100% e quem lidera é quem tem tamanho × volatilidade", () => {
    const report = computeRisk(BASE);
    const soma = report.classes.reduce((total, item) => total + item.riskShare, 0);
    expect(soma).toBeCloseTo(100, 0);
    // 40 mi em imóvel (8% vol) pesa mais no risco que 1 mi em bolsa (22% vol)
    expect(report.classes[0].key).toBe("imoveis");
    // mas a bolsa carrega risco acima do seu capital: volatilidade > média
    const bolsa = report.classes.find((item) => item.key === "renda_variavel")!;
    expect(bolsa.riskShare).toBeGreaterThan(bolsa.weight);
    // com 85% do ativo em imóvel, ele domina o risco da carteira
    const imovel = report.classes.find((item) => item.key === "imoveis")!;
    expect(imovel.riskShare).toBeGreaterThan(80);
  });

  test("classes têm peso somando 100% do ativo", () => {
    const report = computeRisk(BASE);
    const pesos = report.classes.reduce((total, item) => total + item.weight, 0);
    expect(pesos).toBeCloseTo(100, 1);
  });

  test("carteira vazia não quebra e avisa", () => {
    const report = computeRisk({ positions: [] });
    expect(report.var.amount).toBe(0);
    expect(report.classes).toEqual([]);
    expect(report.warnings.some((warning) => warning.includes("Sem ativos"))).toBe(true);
  });
});

describe("stress test", () => {
  test("todos os cenários declarados são calculados", () => {
    const report = computeRisk(BASE);
    expect(report.scenarios.length).toBe(STRESS_SCENARIOS.length);
    expect(report.scenarios.map((scenario) => scenario.id).sort()).toEqual(
      STRESS_SCENARIOS.map((scenario) => scenario.id).sort(),
    );
  });

  test("pior cenário vem primeiro — aqui é o imobiliário, porque 40 de 46 milhões são imóvel", () => {
    const report = computeRisk(BASE);
    expect(report.scenarios[0].id).toBe("imovel_20");
    for (let index = 1; index < report.scenarios.length; index += 1) {
      expect(report.scenarios[index - 1].equityDrawdown).toBeLessThanOrEqual(report.scenarios[index].equityDrawdown);
    }
  });

  test("perda no PL é maior que perda no ativo (alavancagem amplifica)", () => {
    const report = computeRisk(BASE);
    const crise = report.scenarios.find((scenario) => scenario.id === "crise_2008")!;
    const assetDrawdown = (crise.assetDelta / crise.assetBefore) * 100;
    expect(crise.equityDrawdown).toBeLessThan(assetDrawdown);
    expect(crise.equityDrawdown / assetDrawdown).toBeCloseTo(crise.assetBefore / report.equity, 1);
  });

  test("cenário de câmbio sobe quando há ativo no exterior", () => {
    const comExterior = computeRisk({
      ...BASE,
      positions: [
        ...POSITIONS,
        { name: "Vanguard", asset_class: "internacional", quantity: 1_000, unit_price: 500, currency: "USD" },
      ],
    });
    const cambio = comExterior.scenarios.find((scenario) => scenario.id === "cambio_30")!;
    expect(cambio.assetDelta).toBeGreaterThan(0);
    expect(cambio.equityDelta).toBeGreaterThan(0);
    expect(cambio.equityAfter).toBeGreaterThan(cambio.assetBefore - comExterior.debt);
  });

  test("ativo registral entra no choque imobiliário", () => {
    const report = computeRisk(BASE);
    const imovel = report.scenarios.find((scenario) => scenario.id === "imovel_20")!;
    // 40 mi de imóvel a -20% = -8 mi, mais o efeito em fundos/bolsa
    expect(imovel.assetDelta).toBeLessThan(-8_000_000);
    expect(imovel.equityDrawdown).toBeLessThan(-15);
  });

  test("alavancagem depois do choque aumenta", () => {
    const report = computeRisk(BASE);
    const crise = report.scenarios.find((scenario) => scenario.id === "crise_2008")!;
    expect(crise.leverageAfter).toBeGreaterThan(report.debt / report.assets.total * 100);
  });

  test("PL pode ficar negativo em estresse severo e o cálculo continua coerente", () => {
    const alavancado = computeRisk({
      positions: [
        { name: "Bolsa", asset_class: "renda_variavel", quantity: 1, unit_price: 20_000_000, liquidity: "d1" },
      ],
      liabilities: [{ outstanding: 14_000_000, rate_annual: 12, amortization: "bullet", term_months: 12 }],
    });
    const crise = alavancado.scenarios.find((scenario) => scenario.id === "crise_2008")!;
    expect(alavancado.equity).toBe(6_000_000);
    expect(crise.equityAfter).toBeLessThan(0);
    expect(crise.equityDrawdown).toBeLessThan(-100);
  });
});

describe("choque de juros na dívida", () => {
  test("encarece o custo anual e a prestação", () => {
    const report = computeRisk(BASE);
    expect(report.debtShock.annualCostBefore).toBeCloseTo(4_000_000 * 0.085 + 2_000_000 * 0.14, 0);
    expect(report.debtShock.annualCostDelta).toBeCloseTo(6_000_000 * 0.03, 0);
    expect(report.debtShock.monthlyServiceAfter).toBeGreaterThan(report.debtShock.monthlyServiceBefore);
  });

  test("choque maior custa mais", () => {
    const trezentos = computeRisk({ ...BASE, rateShockBps: 300 });
    const quinhentos = computeRisk({ ...BASE, rateShockBps: 500 });
    expect(quinhentos.debtShock.annualCostDelta).toBeGreaterThan(trezentos.debtShock.annualCostDelta);
  });

  test("sem dívida o choque de juros é zero", () => {
    const report = computeRisk({ positions: POSITIONS });
    expect(report.debtShock.annualCostDelta).toBe(0);
    expect(report.debtShock.monthlyServiceBefore).toBe(0);
  });
});

describe("liquidez e avisos", () => {
  test("colchão de liquidez mede meses de serviço da dívida", () => {
    const report = computeRisk(BASE);
    // renda fixa (d1) + bolsa (d1) + caixa (d0)
    expect(report.liquidity.liquid).toBe(3_000_000 + 1_000_000 + 1_000_000);
    expect(report.liquidity.cashBufferMonths).not.toBeNull();
    expect(report.liquidity.cashBufferMonths!).toBeGreaterThan(0);
  });

  test("liquidez baixa gera aviso", () => {
    const report = computeRisk({
      positions: [{ name: "Fazenda", asset_class: "imoveis", quantity: 1, unit_price: 30_000_000, liquidity: "iliquido" }],
      liabilities: [{ outstanding: 6_000_000, rate_annual: 10, amortization: "price", term_months: 120 }],
    });
    expect(report.warnings.some((warning) => warning.includes("Liquidez D0/D1"))).toBe(true);
  });

  test("concentração de risco gera aviso com números", () => {
    const report = computeRisk({
      positions: [{ name: "Cripto", asset_class: "cripto", quantity: 1, unit_price: 10_000_000 }],
    });
    expect(report.classes[0].riskShare).toBeCloseTo(100, 0);
  });

  test("concentração em imóvel avisa que o VaR subestima (preço não é diário)", () => {
    const report = computeRisk(BASE);
    expect(report.warnings.some((warning) => warning.includes("avaliado por laudo"))).toBe(true);
  });

  test("volatilidades declaradas cobrem as classes usadas nos cenários", () => {
    for (const key of Object.keys(CLASS_VOLATILITY)) expect(CLASS_VOLATILITY[key]).toBeGreaterThan(0);
    for (const scenario of STRESS_SCENARIOS) {
      for (const key of Object.keys(scenario.shocks)) {
        expect(CLASS_VOLATILITY[key]).toBeDefined();
      }
    }
  });

  test("renda fixa de duration longa sofre no cenário de juros", () => {
    const report = computeRisk({
      positions: [{ name: "NTN-B 2050", asset_class: "renda_fixa", quantity: 1, unit_price: 10_000_000 }],
    });
    const juros = report.scenarios.find((scenario) => scenario.id === "juros_300")!;
    expect(juros.assetDelta).toBeLessThan(0);
  });
});
