import { describe, expect, test } from "bun:test";
import {
  buildBalanceSheet,
  evaluateGoal,
  evaluateGoals,
  monthsUntil,
  monthlyInterest,
  monthlyPayment,
  prepaymentAdvantage,
  requiredMonthlyContribution,
  summarizeLiability,
  type Goal,
  type Liability,
} from "@/lib/wealth/balance";

const TODAY = new Date("2026-10-30T00:00:00Z");

const liability = (over: Partial<Liability> = {}): Liability => ({
  id: "l1",
  name: "Financiamento Fazenda Boa Vista",
  kind: "credito_rural",
  outstanding: 8_000_000,
  principal: 10_000_000,
  rate_annual: 8.5,
  amortization: "price",
  term_months: 120,
  collateral: "Hipoteca da Fazenda Boa Vista",
  ...over,
});

describe("prestação e custo da dívida", () => {
  test("Price: parcela constante confere com a fórmula", () => {
    const payment = monthlyPayment(8_000_000, 8.5, 120, "price");
    const rate = 0.085 / 12;
    const expected = (8_000_000 * rate) / (1 - Math.pow(1 + rate, -120));
    expect(payment).toBeCloseTo(expected, 2);
    // ~R$ 99,2 mil/mês para 8M a 8,5% em 10 anos
    expect(payment).toBeGreaterThan(95_000);
    expect(payment).toBeLessThan(103_000);
  });

  test("SAC: primeira parcela é maior que a do Price", () => {
    const sac = monthlyPayment(8_000_000, 8.5, 120, "sac");
    const price = monthlyPayment(8_000_000, 8.5, 120, "price");
    expect(sac).toBeCloseTo(8_000_000 / 120 + 8_000_000 * (0.085 / 12), 2);
    expect(sac).toBeGreaterThan(price);
  });

  test("bullet paga só juros e sem prazo também", () => {
    expect(monthlyPayment(8_000_000, 8.5, 60, "bullet")).toBeCloseTo(monthlyInterest(8_000_000, 8.5), 2);
    expect(monthlyPayment(1_000_000, 12, null, "price")).toBeCloseTo(10_000, 2);
  });

  test("taxa zero divide o saldo pelo prazo", () => {
    expect(monthlyPayment(1_200_000, 0, 24, "price")).toBeCloseTo(50_000, 2);
  });

  test("saldo zero não gera prestação", () => {
    expect(monthlyPayment(0, 10, 12, "price")).toBe(0);
  });

  test("resumo: juros do mês, custo anual e vencimento em 12 meses", () => {
    const summary = summarizeLiability(liability());
    expect(summary.outstanding).toBe(8_000_000);
    expect(summary.monthlyInterest).toBeCloseTo(56_666.67, 1);
    expect(summary.annualCost).toBeCloseTo(680_000, 0);
    // 12 parcelas, com arredondamento em centavos na saída
    expect(summary.dueIn12Months).toBeCloseTo(summary.monthlyPayment * 12, 0);
    expect(summary.isSecured).toBe(true);
  });

  test("dívida sem garantia informada é sinalizada", () => {
    expect(summarizeLiability(liability({ collateral: "  " })).isSecured).toBe(false);
    expect(summarizeLiability(liability({ collateral: null })).isSecured).toBe(false);
  });
});

describe("balanço patrimonial", () => {
  const positions = [
    { quantity: 1_200_000, unit_price: 1 },
    { quantity: 1_500, unit_price: 3_180 },
    { quantity: 40_000, unit_price: 39.16 },
  ];
  const registeredAssets = [{ current_value: 48_000_000 }, { current_value: 12_400_000 }];

  test("patrimônio líquido = ativo − passivo", () => {
    const sheet = buildBalanceSheet({
      positions,
      registeredAssets,
      liabilities: [liability(), liability({ id: "l2", outstanding: 2_000_000, rate_annual: 14.9, kind: "cartao", collateral: null, amortization: "bullet", term_months: null })],
    });
    expect(sheet.assets.financial).toBeCloseTo(1_200_000 + 4_770_000 + 1_566_400, 2);
    expect(sheet.assets.registered).toBe(60_400_000);
    expect(sheet.assets.total).toBeCloseTo(67_936_400, 2);
    expect(sheet.totals.debt).toBe(10_000_000);
    expect(sheet.totals.netWorth).toBeCloseTo(sheet.assets.total - 10_000_000, 2);
  });

  test("taxa média ponderada pelo saldo devedor", () => {
    const sheet = buildBalanceSheet({
      liabilities: [
        liability({ outstanding: 8_000_000, rate_annual: 8.5 }),
        liability({ id: "l2", outstanding: 2_000_000, rate_annual: 16.5 }),
      ],
    });
    // (8M·8,5 + 2M·16,5) / 10M = 10,1
    expect(sheet.totals.weightedRate).toBeCloseTo(10.1, 4);
  });

  test("alavancagem e dívida/patrimônio", () => {
    const sheet = buildBalanceSheet({
      positions: [{ quantity: 10_000_000, unit_price: 1 }],
      liabilities: [liability({ outstanding: 4_000_000 })],
    });
    expect(sheet.totals.leverage).toBeCloseTo(40, 2);
    expect(sheet.totals.debtToEquity).toBeCloseTo((4 / 6) * 100, 2);
  });

  test("avisos: alavancagem alta, juro caro e dívida sem garantia", () => {
    const sheet = buildBalanceSheet({
      positions: [{ quantity: 1_000_000, unit_price: 1 }],
      liabilities: [
        liability({ outstanding: 700_000, rate_annual: 15, collateral: null }),
      ],
    });
    expect(sheet.warnings.join(" ")).toContain("Alavancagem");
    expect(sheet.warnings.join(" ")).toContain("12% a.a.");
    expect(sheet.warnings.join(" ")).toContain("sem garantia");
  });

  test("passivo maior que ativo gera patrimônio negativo", () => {
    const sheet = buildBalanceSheet({
      positions: [{ quantity: 100_000, unit_price: 1 }],
      liabilities: [liability({ outstanding: 500_000 })],
    });
    expect(sheet.totals.netWorth).toBeLessThan(0);
    expect(sheet.warnings.join(" ")).toContain("Patrimônio líquido negativo");
  });

  test("sem dívida não divide por zero e não alarma", () => {
    const sheet = buildBalanceSheet({ positions: [{ quantity: 100, unit_price: 10 }], liabilities: [] });
    expect(sheet.totals.debt).toBe(0);
    expect(sheet.totals.netWorth).toBe(1000);
    expect(sheet.totals.weightedRate).toBe(0);
    expect(sheet.warnings).toHaveLength(0);
  });

  test("dívida offshore é separada", () => {
    const sheet = buildBalanceSheet({
      liabilities: [liability({ is_offshore: true, outstanding: 1_000_000, currency: "USD" })],
    });
    expect(sheet.totals.offshoreDebt).toBe(1_000_000);
  });
});

describe("metas", () => {
  const goal = (over: Partial<Goal> = {}): Goal => ({
    id: "g1",
    name: "Reserva de oportunidade",
    kind: "reserva_oportunidade",
    target_amount: 5_000_000,
    allocated: 1_000_000,
    target_date: "2028-10-30",
    priority: 1,
    expected_return: 8,
    is_active: true,
    ...over,
  });

  test("meses até o prazo, com arredondamento para cima", () => {
    expect(monthsUntil("2027-10-30", TODAY)).toBe(12);
    expect(monthsUntil("2026-11-15", TODAY)).toBe(1);
    expect(monthsUntil("2026-01-01", TODAY)).toBe(0);
  });

  test("aporte mensal necessário com juros compostos", () => {
    const monthly = requiredMonthlyContribution(5_000_000, 1_000_000, 8, 24);
    const rate = Math.pow(1.08, 1 / 12) - 1;
    const growth = Math.pow(1 + rate, 24);
    const expected = ((5_000_000 - 1_000_000 * growth) * rate) / (growth - 1);
    expect(monthly).toBeCloseTo(expected, 2);
    // 4M restantes em 24 meses com 8% a.a. → ~R$ 154 mil/mês
    expect(monthly).toBeGreaterThan(145_000);
    expect(monthly).toBeLessThan(165_000);
  });

  test("sem retorno, é divisão simples", () => {
    expect(requiredMonthlyContribution(5_000_000, 1_000_000, 0, 20)).toBeCloseTo(200_000, 2);
  });

  test("alvo já alcançado não exige aporte", () => {
    expect(requiredMonthlyContribution(1_000_000, 1_200_000, 8, 12)).toBe(0);
    expect(requiredMonthlyContribution(3_000_000, 1_000_000, 8, 0)).toBeCloseTo(2_000_000, 2);
  });

  test("prazo vencido marca status vencida", () => {
    const progress = evaluateGoal(goal({ target_date: "2026-01-01" }), TODAY);
    expect(progress.status).toBe("vencida");
    expect(progress.monthsLeft).toBe(0);
  });

  test("meta atingida marca concluída", () => {
    expect(evaluateGoal(goal({ allocated: 5_000_000 }), TODAY).status).toBe("concluida");
  });

  test("projeção no prazo decide entre no_prazo e atenção", () => {
    // 1M a 8% em 24 meses chega a ~1,17M de 5M → em risco
    expect(evaluateGoal(goal(), TODAY).status).toBe("em_risco");
    // 4,6M cresce até passar de 5M
    expect(evaluateGoal(goal({ allocated: 4_600_000 }), TODAY).status).toBe("no_prazo");
  });

  test("progresso percentual e falta", () => {
    const progress = evaluateGoal(goal({ allocated: 3_200_000 }), TODAY);
    expect(progress.progressPct).toBeCloseTo(64, 2);
    expect(progress.missing).toBeCloseTo(1_800_000, 2);
    expect(progress.status).toBe("atencao");
  });

  test("somatório das metas ignora inativas e ordena por prioridade", () => {
    const result = evaluateGoals(
      [
        goal({ id: "g1", priority: 2, target_amount: 5_000_000, allocated: 1_000_000 }),
        goal({ id: "g2", priority: 1, target_amount: 2_000_000, allocated: 500_000 }),
        goal({ id: "g3", priority: 1, target_amount: 9_000_000, allocated: 0, is_active: false }),
      ],
      TODAY,
    );
    expect(result.goals).toHaveLength(2);
    expect(result.goals[0].goal.id).toBe("g2");
    expect(result.totals.target).toBe(7_000_000);
    expect(result.totals.allocated).toBe(1_500_000);
    expect(result.totals.missing).toBe(5_500_000);
    expect(result.totals.requiredMonthly).toBeGreaterThan(0);
  });

  test("vantagem de quitar dívida em vez de investir", () => {
    // dívida a 14,9% contra carteira a 8% sobre 1M
    expect(prepaymentAdvantage(1_000_000, 14.9, 8)).toBeCloseTo(69_000, 2);
    // dívida barata: investir ganha
    expect(prepaymentAdvantage(1_000_000, 6, 9)).toBeLessThan(0);
  });
});
