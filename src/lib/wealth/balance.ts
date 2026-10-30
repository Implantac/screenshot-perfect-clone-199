/**
 * Balanço patrimonial e metas.
 *
 * A regra que organiza tudo: **patrimônio líquido = ativo − passivo**. Sem o
 * passivo, a alocação esconde metade da verdade — uma carteira de R$ 50 milhões
 * com R$ 40 milhões de dívida não é uma carteira de R$ 50 milhões.
 *
 * Segunda regra: **serviço da dívida é derivado, saldo devedor é informado.**
 * O banco pode repactuar; o saldo do contrato é a verdade. A prestação, porém,
 * sai de saldo/taxa/prazo pela tabela do contrato (Price, SAC ou bullet).
 */

export type Liability = {
  id: string;
  entity_id?: string;
  name: string;
  kind: string;
  creditor?: string | null;
  principal?: number | string | null;
  outstanding: number | string;
  currency?: string | null;
  rate_annual?: number | string | null;
  amortization?: string | null;
  term_months?: number | string | null;
  start_date?: string | null;
  due_date?: string | null;
  collateral?: string | null;
  is_offshore?: boolean | null;
};

export type LiabilitySummary = {
  liability: Liability;
  outstanding: number;
  /** Prestação mensal estimada (Price/SAC) ou juros mensais (bullet). */
  monthlyPayment: number;
  /** Juros do próximo mês, no regime informado. */
  monthlyInterest: number;
  /** Custo anual da dívida em R$. */
  annualCost: number;
  /** % do saldo devedor que vence em até 12 meses (amortização + juros). */
  dueIn12Months: number;
  isSecured: boolean;
};

export type BalanceSheet = {
  liabilities: LiabilitySummary[];
  assets: {
    /** Posições financeiras (D+0 a longo prazo). */
    financial: number;
    /** Ativos registrais (imóveis, veículos) quando informados. */
    registered: number;
    total: number;
  };
  totals: {
    debt: number;
    /** Juros anuais somados de todas as dívidas. */
    annualCost: number;
    /** Comprometimento mensal com serviço da dívida. */
    monthlyService: number;
    /** Dívida que vence em 12 meses. */
    dueIn12Months: number;
    /** taxa média ponderada pelo saldo devedor (% a.a.). */
    weightedRate: number;
    /** dívida / ativo total (%). */
    leverage: number;
    /** ativo − dívida. */
    netWorth: number;
    /** dívida / patrimônio líquido (%). */
    debtToEquity: number;
    securedDebt: number;
    offshoreDebt: number;
  };
  warnings: string[];
};

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Prestação mensal.
 *
 * - **Price**: parcela constante — `PV·i / (1 − (1+i)^−n)`.
 * - **SAC**: amortização constante; a primeira parcela é a maior — `PV/n + PV·i`.
 * - **Bullet**: paga só juros e o principal no fim — `PV·i`.
 *
 * Sem prazo informado, assume juros apenas (conservador: não inventa amortização).
 */
export function monthlyPayment(
  outstanding: number,
  rateAnnual: number,
  months: number | string | null | undefined,
  amortization = "price",
): number {
  if (!(outstanding > 0)) return 0;
  const rate = rateAnnual / 100 / 12;
  const term = Math.round(num(months));

  if (amortization === "bullet" || !(term > 0)) return outstanding * rate;
  if (rate === 0) return outstanding / term;
  if (amortization === "sac") return outstanding / term + outstanding * rate;

  // Price
  return (outstanding * rate) / (1 - Math.pow(1 + rate, -term));
}

/** Juros do próximo mês. */
export function monthlyInterest(outstanding: number, rateAnnual: number): number {
  return outstanding * (rateAnnual / 100 / 12);
}

export function summarizeLiability(liability: Liability): LiabilitySummary {
  const outstanding = num(liability.outstanding);
  const rate = num(liability.rate_annual);
  const months = liability.term_months;
  const payment = monthlyPayment(outstanding, rate, months, liability.amortization ?? "price");
  const interest = monthlyInterest(outstanding, rate);

  return {
    liability,
    outstanding,
    monthlyPayment: round(payment),
    monthlyInterest: round(interest),
    annualCost: round(interest * 12),
    // 12 parcelas (ou 12 meses de juros, no bullet).
    dueIn12Months: round(payment * 12),
    isSecured: Boolean(liability.collateral && liability.collateral.trim().length > 0),
  };
}

/**
 * Balanço completo.
 *
 * `financialAssets` aceita posições com `quantity`/`unit_price` (mesmo formato da
 * custódia); `registeredAssets` aceita `current_value` dos ativos registrais.
 */
export function buildBalanceSheet(input: {
  positions?: { quantity?: number | string | null; unit_price?: number | string | null }[];
  registeredAssets?: { current_value?: number | string | null }[];
  liabilities: Liability[];
}): BalanceSheet {
  const financial = (input.positions ?? []).reduce(
    (total, position) => total + num(position.quantity) * num(position.unit_price),
    0,
  );
  const registered = (input.registeredAssets ?? []).reduce(
    (total, asset) => total + num(asset.current_value),
    0,
  );
  const assetTotal = financial + registered;

  const summaries = input.liabilities
    .map(summarizeLiability)
    .sort((a, b) => b.outstanding - a.outstanding);

  const debt = summaries.reduce((total, item) => total + item.outstanding, 0);
  const annualCost = summaries.reduce((total, item) => total + item.annualCost, 0);
  const monthlyService = summaries.reduce((total, item) => total + item.monthlyPayment, 0);
  const dueIn12Months = summaries.reduce((total, item) => total + item.dueIn12Months, 0);
  const weightedRate = debt > 0
    ? summaries.reduce((total, item) => total + item.outstanding * num(item.liability.rate_annual), 0) / debt
    : 0;
  const netWorth = assetTotal - debt;

  const warnings: string[] = [];
  if (debt > 0 && assetTotal > 0) {
    const leverage = (debt / assetTotal) * 100;
    if (leverage > 50) {
      warnings.push(
        `Alavancagem de ${leverage.toFixed(1).replace(".", ",")}% do ativo: mais da metade do patrimônio está comprometida.`,
      );
    }
  }
  if (netWorth < 0) {
    warnings.push("Patrimônio líquido negativo: o passivo supera o ativo.");
  }
  const expensive = summaries.filter((item) => num(item.liability.rate_annual) >= 12);
  if (expensive.length > 0) {
    warnings.push(
      `${expensive.length} dívida(s) com custo acima de 12% a.a. — candidatas naturais a quitação antecipada.`,
    );
  }
  const unsecured = summaries.filter((item) => !item.isSecured && item.outstanding > 0);
  if (unsecured.length > 0) {
    warnings.push(`${unsecured.length} dívida(s) sem garantia informada.`);
  }

  return {
    liabilities: summaries,
    assets: { financial: round(financial), registered: round(registered), total: round(assetTotal) },
    totals: {
      debt: round(debt),
      annualCost: round(annualCost),
      monthlyService: round(monthlyService),
      dueIn12Months: round(dueIn12Months),
      weightedRate: round(weightedRate * 100) / 100,
      leverage: assetTotal > 0 ? round((debt / assetTotal) * 100) : 0,
      netWorth: round(netWorth),
      debtToEquity: netWorth > 0 ? round((debt / netWorth) * 100) : 0,
      securedDebt: round(summaries.filter((item) => item.isSecured).reduce((t, i) => t + i.outstanding, 0)),
      offshoreDebt: round(
        summaries.filter((item) => item.liability.is_offshore).reduce((t, i) => t + i.outstanding, 0),
      ),
    },
    warnings,
  };
}

// ------------------------------------------------------------------- metas

export type Goal = {
  id: string;
  entity_id?: string;
  name: string;
  kind: string;
  target_amount: number | string;
  allocated: number | string;
  target_date: string;
  priority: number | string;
  expected_return: number | string;
  is_active?: boolean | null;
};

export type GoalProgress = {
  goal: Goal;
  target: number;
  allocated: number;
  /** % do alvo já separado. */
  progressPct: number;
  /** Meses até o prazo (0 = hoje/passado). */
  monthsLeft: number;
  /** Falta em R$ sem contar rendimento. */
  missing: number;
  /** Aporte mensal necessário para chegar no prazo, com o retorno esperado. */
  requiredMonthly: number;
  /** O que acontece se continuar no ritmo atual (nenhum aporte novo). */
  projectedAtDeadline: number;
  status: "concluida" | "no_prazo" | "atencao" | "em_risco" | "vencida";
};

/** Meses inteiros entre hoje e a data-alvo (arredonda para cima). */
export function monthsUntil(date: string, today = new Date()): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  const now = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.ceil((target - now) / (86_400_000 * 30.4375)));
}

/**
 * Aporte mensal necessário.
 *
 * Resolve para PMT a equação de valor futuro: o que já está alocado cresce a
 * `r` por `n` meses, e os aportes formam uma anuidade. Com `r = 0` vira divisão
 * simples. Se o que já está alocado já atinge o alvo no prazo, o aporte é zero.
 */
export function requiredMonthlyContribution(
  target: number,
  allocated: number,
  annualReturnPct: number,
  months: number,
): number {
  if (months <= 0) return Math.max(0, target - allocated);
  const rate = Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
  const growth = Math.pow(1 + rate, months);
  const futureOfAllocated = allocated * growth;
  if (futureOfAllocated >= target) return 0;
  if (rate === 0) return (target - allocated) / months;
  return ((target - futureOfAllocated) * rate) / (growth - 1);
}

export function evaluateGoal(goal: Goal, today = new Date()): GoalProgress {
  const target = num(goal.target_amount);
  const allocated = num(goal.allocated);
  const monthsLeft = monthsUntil(goal.target_date, today);
  const rate = num(goal.expected_return);
  const growth = Math.pow(1 + Math.pow(1 + rate / 100, 1 / 12) - 1, Math.max(0, monthsLeft));
  const projectedAtDeadline = allocated * growth;
  const progressPct = target > 0 ? (allocated / target) * 100 : 0;
  const requiredMonthly = requiredMonthlyContribution(target, allocated, rate, monthsLeft);

  const past = Date.parse(`${goal.target_date}T00:00:00Z`) <
    Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);

  const status: GoalProgress["status"] =
    allocated >= target
      ? "concluida"
      : past
        ? "vencida"
        : progressPct >= 100
          ? "concluida"
          : projectedAtDeadline >= target
            ? "no_prazo"
            : progressPct >= 60
              ? "atencao"
              : "em_risco";

  return {
    goal,
    target,
    allocated,
    progressPct: round(progressPct),
    monthsLeft,
    missing: round(Math.max(0, target - allocated)),
    requiredMonthly: round(Math.max(0, requiredMonthly)),
    projectedAtDeadline: round(projectedAtDeadline),
    status,
  };
}

export function evaluateGoals(goals: Goal[], today = new Date()): {
  goals: GoalProgress[];
  totals: {
    target: number;
    allocated: number;
    missing: number;
    requiredMonthly: number;
    /** Aporte necessário por mês, somando todas as metas ativas. */
    monthlyAcrossGoals: number;
  };
} {
  const list = goals
    .filter((goal) => goal.is_active !== false)
    .map((goal) => evaluateGoal(goal, today))
    .sort((a, b) => Number(a.goal.priority) - Number(b.goal.priority) || b.target - a.target);

  const sums = list.reduce(
    (acc, item) => ({
      target: acc.target + item.target,
      allocated: acc.allocated + item.allocated,
      missing: acc.missing + item.missing,
      requiredMonthly: acc.requiredMonthly + item.requiredMonthly,
    }),
    { target: 0, allocated: 0, missing: 0, requiredMonthly: 0 },
  );

  return {
    goals: list,
    totals: {
      target: round(sums.target),
      allocated: round(sums.allocated),
      missing: round(sums.missing),
      requiredMonthly: round(sums.requiredMonthly),
      monthlyAcrossGoals: round(sums.requiredMonthly),
    },
  };
}

/**
 * Custo de oportunidade de quitar dívida em vez de investir.
 * Positivo = quitar rende mais que investir (diferença de taxa sobre o saldo).
 */
export function prepaymentAdvantage(
  outstanding: number,
  debtRateAnnual: number,
  portfolioReturnAnnual: number,
): number {
  return round((num(outstanding) * (num(debtRateAnnual) - num(portfolioReturnAnnual))) / 100);
}
