/**
 * Risco de mercado: VaR paramétrico e stress test.
 *
 * Duas escolhas que definem este módulo:
 *
 * 1. **O risco é medido no patrimônio líquido, não no ativo.** Com dívida, uma
 *    queda de 10% no ativo derruba 13% do PL se a alavancagem for de 30%. Mostrar
 *    só "a carteira cairia 10%" é a metade tranquilizadora da história.
 *
 * 2. **VaR não é previsão, é régua.** Ele responde "quanto eu perderia num dia
 *    ruim normal". O stress test responde a pergunta que o cliente realmente faz:
 *    "e se acontecer de novo o que aconteceu em 2008?" — com choques explícitos
 *    por classe, e não com uma distribuição suposta.
 *
 * As volatilidades e correlações são **premissas declaradas** (constantes no topo
 * do arquivo), não estimativas proprietárias. Quem discordar troca a tabela e o
 * número muda — o cálculo é auditável.
 */

import { positionValue, type PositionLike } from "./allocation";

export type RiskClass =
  | "caixa"
  | "renda_fixa"
  | "renda_variavel"
  | "fundos"
  | "imoveis"
  | "internacional"
  | "alternativos"
  | "cripto";

/** Volatilidade anualizada por classe (% a.a.). Premissa declarada. */
export const CLASS_VOLATILITY: Record<string, number> = {
  caixa: 0.5,
  renda_fixa: 4.0,
  renda_variavel: 22.0,
  fundos: 10.0,
  imoveis: 8.0,
  internacional: 16.0,
  alternativos: 12.0,
  cripto: 60.0,
};

const DEFAULT_VOLATILITY = 12;

/** Correlação entre classes (simétrica). Ausente = 0,25. */
const CORRELATION: [string, string, number][] = [
  ["renda_variavel", "internacional", 0.75],
  ["renda_variavel", "fundos", 0.6],
  ["renda_variavel", "alternativos", 0.45],
  ["renda_variavel", "cripto", 0.5],
  ["renda_variavel", "imoveis", 0.35],
  ["renda_variavel", "renda_fixa", 0.1],
  ["renda_fixa", "caixa", 0.4],
  ["renda_fixa", "imoveis", 0.2],
  ["renda_fixa", "internacional", 0.15],
  ["fundos", "internacional", 0.5],
  ["fundos", "imoveis", 0.4],
  ["fundos", "alternativos", 0.4],
  ["imoveis", "internacional", 0.2],
  ["alternativos", "internacional", 0.35],
  ["cripto", "internacional", 0.4],
];

const DEFAULT_CORRELATION = 0.25;
const CASH_CORRELATION = 0.05;

export type RiskInput = {
  positions: (PositionLike & { currency?: string | null })[];
  liabilities?: {
    id?: string;
    name?: string;
    outstanding: number | string;
    rate_annual?: number | string | null;
    amortization?: string | null;
    term_months?: number | string | null;
    is_offshore?: boolean | null;
    currency?: string | null;
  }[];
  /** Ativos registrais (imóveis, veículos) entram no PL e no estresse imobiliário. */
  registeredAssets?: { current_value?: number | string | null; asset_class?: string | null }[];
  confidence?: 95 | 99;
  horizonDays?: number;
  /** Choque de juros em pontos-base (padrão 300). */
  rateShockBps?: number;
  today?: Date;
};

export type ClassRisk = {
  key: string;
  label: string;
  value: number;
  weight: number;
  volatility: number;
  /** σ da posição, em R$ no horizonte escolhido. */
  standaloneRisk: number;
  /** % do risco total da carteira. */
  riskShare: number;
};

export type StressScenario = {
  id: string;
  label: string;
  rationale: string;
  /** Choque aplicado por classe (%). */
  shocks: Record<string, number>;
  assetBefore: number;
  assetDelta: number;
  assetAfter: number;
  /** Queda do patrimônio líquido em R$. */
  equityDelta: number;
  equityAfter: number;
  /** Queda do PL em % do PL original — a métrica que importa. */
  equityDrawdown: number;
  leverageAfter: number;
};

export type DebtShock = {
  rateShockBps: number;
  annualCostBefore: number;
  annualCostAfter: number;
  annualCostDelta: number;
  monthlyServiceBefore: number;
  monthlyServiceAfter: number;
  monthlyServiceDelta: number;
};

export type RiskReport = {
  assets: { financial: number; registered: number; total: number };
  equity: number;
  debt: number;
  var: {
    confidence: 95 | 99;
    horizonDays: number;
    z: number;
    /** σ anual da carteira (%). */
    portfolioVolatility: number;
    /** σ no horizonte, em R$. */
    horizonSigma: number;
    /** VaR em R$. */
    amount: number;
    /** VaR em % do ativo. */
    percentage: number;
    /** VaR em % do PL — a alavancagem amplifica. */
    percentageOfEquity: number;
  };
  classes: ClassRisk[];
  scenarios: StressScenario[];
  debtShock: DebtShock;
  liquidity: { liquid: number; cashBufferMonths: number | null };
  warnings: string[];
};

const CLASS_LABELS: Record<string, string> = {
  caixa: "Caixa",
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  fundos: "Fundos",
  imoveis: "Imóveis",
  internacional: "Internacional",
  alternativos: "Alternativos",
  cripto: "Cripto",
};

const Z_SCORE: Record<95 | 99, number> = { 95: 1.645, 99: 2.326 };

const num = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function correlation(a: string, b: string): number {
  if (a === b) return 1;
  const pair = CORRELATION.find(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
  if (pair) return pair[2];
  if (a === "caixa" || b === "caixa") return CASH_CORRELATION;
  return DEFAULT_CORRELATION;
}

/** Cenários de choque por classe, em %. Cada linha é uma tese, não um número mágico. */
export const STRESS_SCENARIOS: { id: string; label: string; rationale: string; shocks: Record<string, number> }[] = [
  {
    id: "crise_2008",
    label: "Crise de 2008",
    rationale: "Bolsa brasileira caiu ~60% no pior momento; crédito privado travou e imóvel comercial recuou.",
    shocks: { renda_variavel: -45, fundos: -25, imoveis: -12, internacional: -35, alternativos: -30, cripto: -60, renda_fixa: 2, caixa: 0 },
  },
  {
    id: "covid_2020",
    label: "Choque de março/2020",
    rationale: "Ciclo rápido: bolsa -35% em um mês, fundos imobiliários -20%, juro curto em queda.",
    shocks: { renda_variavel: -35, fundos: -18, imoveis: -8, internacional: -25, alternativos: -20, cripto: -40, renda_fixa: 1.5, caixa: 0.3 },
  },
  {
    id: "juros_300",
    label: "Juros +300 bps",
    rationale: "Marcação a mercado de renda fixa (duration ~3) e compressão de múltiplo em bolsa e imóvel.",
    shocks: { renda_fixa: -9, renda_variavel: -12, fundos: -6, imoveis: -15, internacional: -3, alternativos: -8, caixa: 0.9, cripto: -15 },
  },
  {
    id: "cambio_30",
    label: "Dólar +30%",
    rationale: "Ativos no exterior sobem em reais; o resto não se move (choque isolado de câmbio).",
    shocks: { internacional: 30, caixa: 0, renda_fixa: 0, renda_variavel: 0, fundos: 0, imoveis: 0, alternativos: 0, cripto: 15 },
  },
  {
    id: "imovel_20",
    label: "Imóveis -20%",
    rationale: "Correção patrimonial: imóvel direto, FII em carteira e fundos imobiliários acompanham.",
    shocks: { imoveis: -20, renda_variavel: -6, fundos: -5, renda_fixa: 0, caixa: 0, internacional: 0, alternativos: -2, cripto: 0 },
  },
  {
    id: "credito_privado",
    label: "Evento de crédito privado",
    rationale: "Fundos de crédito e alternativos com resgate bloqueado e haircut; renda fixa soberana sofre pouco.",
    shocks: { fundos: -15, alternativos: -25, renda_fixa: -2, renda_variavel: -8, imoveis: -3, caixa: -1, internacional: -4, cripto: 0 },
  },
];

export function computeRisk(input: RiskInput): RiskReport {
  const confidence = input.confidence ?? 95;
  const horizonDays = input.horizonDays ?? 21;
  const rateShockBps = input.rateShockBps ?? 300;
  const z = Z_SCORE[confidence];

  // ------------------------------------------------ ativo por classe
  const byClass = new Map<string, number>();
  for (const position of input.positions) {
    const key = String(position.asset_class ?? "outros");
    byClass.set(key, (byClass.get(key) ?? 0) + positionValue(position));
  }
  for (const asset of input.registeredAssets ?? []) {
    const key = String(asset.asset_class ?? "imoveis");
    byClass.set(key, (byClass.get(key) ?? 0) + num(asset.current_value));
  }

  const financial = input.positions.reduce((total, position) => total + positionValue(position), 0);
  const registered = (input.registeredAssets ?? []).reduce(
    (total, asset) => total + num(asset.current_value),
    0,
  );
  const totalAssets = financial + registered;
  const debt = (input.liabilities ?? []).reduce((total, item) => total + num(item.outstanding), 0);
  const equity = totalAssets - debt;

  // ------------------------------------------------ VaR paramétrico
  const entries = [...byClass.entries()]
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, value, weight: totalAssets > 0 ? value / totalAssets : 0 }));

  // σ da carteira = sqrt(ΣΣ w_i w_j σ_i σ_j ρ_ij)
  let variance = 0;
  for (const a of entries) {
    for (const b of entries) {
      const volA = CLASS_VOLATILITY[a.key] ?? DEFAULT_VOLATILITY;
      const volB = CLASS_VOLATILITY[b.key] ?? DEFAULT_VOLATILITY;
      variance += a.weight * b.weight * volA * volB * correlation(a.key, b.key);
    }
  }
  const portfolioVolatility = Math.sqrt(Math.max(0, variance)); // % a.a.
  const horizonFactor = Math.sqrt(horizonDays / 252);
  const horizonVolatility = portfolioVolatility * horizonFactor;
  const horizonSigma = (totalAssets * horizonVolatility) / 100;
  const varAmount = z * horizonSigma;

  const classes: ClassRisk[] = entries
    .map((entry) => {
      const vol = CLASS_VOLATILITY[entry.key] ?? DEFAULT_VOLATILITY;
      // Contribuição marginal para σ: w_i × (Σ_j w_j σ_i σ_j ρ_ij) / σ_p
      let covariance = 0;
      for (const other of entries) {
        const volOther = CLASS_VOLATILITY[other.key] ?? DEFAULT_VOLATILITY;
        covariance +=
          other.weight * vol * volOther * correlation(entry.key, other.key);
      }
      // MCTR_i = ∂σ_p/∂w_i; a contribuição para o risco é w_i × MCTR_i, cuja soma
      // é exatamente σ_p (por isso a soma dos shares fecha em 100%).
      const marginal = portfolioVolatility > 0 ? covariance / portfolioVolatility : 0;
      const contribution = entry.weight * marginal;
      return {
        key: entry.key,
        label: CLASS_LABELS[entry.key] ?? entry.key,
        value: round(entry.value, 2),
        weight: round(entry.weight * 100, 2),
        volatility: vol,
        standaloneRisk: round((entry.value * vol * horizonFactor) / 100, 2),
        riskShare: round(portfolioVolatility > 0 ? (contribution / portfolioVolatility) * 100 : 0, 2),
      };
    })
    .sort((a, b) => b.riskShare - a.riskShare);

  // ------------------------------------------------ stress test
  const scenarios: StressScenario[] = STRESS_SCENARIOS.map((scenario) => {
    let delta = 0;
    for (const entry of entries) {
      const shock = scenario.shocks[entry.key] ?? 0;
      delta += (entry.value * shock) / 100;
    }
    // Ativo que não é posição (terreno sem classe) não sofre choque — e isso está dito.
    const assetAfter = totalAssets + delta;
    const equityAfter = assetAfter - debt;
    return {
      id: scenario.id,
      label: scenario.label,
      rationale: scenario.rationale,
      shocks: scenario.shocks,
      assetBefore: round(totalAssets, 2),
      assetDelta: round(delta, 2),
      assetAfter: round(assetAfter, 2),
      equityDelta: round(delta, 2),
      equityAfter: round(equityAfter, 2),
      equityDrawdown: equity !== 0 ? round((delta / equity) * 100, 2) : 0,
      leverageAfter: assetAfter > 0 ? round((debt / assetAfter) * 100, 2) : 0,
    };
  }).sort((a, b) => a.equityDrawdown - b.equityDrawdown);

  // ------------------------------------------------ choque de juros na dívida
  const monthlyRate = (annual: number) => annual / 100 / 12;
  const debtItems = (input.liabilities ?? []).map((item) => {
    const outstanding = num(item.outstanding);
    const rate = num(item.rate_annual);
    const months = Math.max(1, num(item.term_months) || 0);
    const amortization = String(item.amortization ?? "bullet");
    const paymentAt = (annualRate: number) => {
      const r = monthlyRate(annualRate);
      if (amortization === "bullet" || r <= 0) return r * outstanding;
      return outstanding * (r / (1 - (1 + r) ** -months));
    };
    return { outstanding, rate, paymentAt };
  });

  const sumService = (deltaPct: number) =>
    debtItems.reduce((total, item) => total + item.paymentAt(item.rate + deltaPct), 0);
  const costAt = (deltaPct: number) =>
    debtItems.reduce((total, item) => total + (item.outstanding * (item.rate + deltaPct)) / 100, 0);

  const debtShock: DebtShock = {
    rateShockBps,
    annualCostBefore: round(costAt(0), 2),
    annualCostAfter: round(costAt(rateShockBps / 100), 2),
    annualCostDelta: round(costAt(rateShockBps / 100) - costAt(0), 2),
    monthlyServiceBefore: round(sumService(0), 2),
    monthlyServiceAfter: round(sumService(rateShockBps / 100), 2),
    monthlyServiceDelta: round(sumService(rateShockBps / 100) - sumService(0), 2),
  };

  // ------------------------------------------------ liquidez
  const liquid = input.positions
    .filter((position) => position.liquidity === "d0" || position.liquidity === "d1")
    .reduce((total, position) => total + positionValue(position), 0);
  const cashBufferMonths =
    debtShock.monthlyServiceBefore > 0 ? round(liquid / debtShock.monthlyServiceBefore, 1) : null;

  // ------------------------------------------------ avisos
  const warnings: string[] = [];
  const worst = scenarios[0];
  if (worst && Math.abs(worst.equityDrawdown) > 25) {
    warnings.push(
      `No cenário "${worst.label}" o patrimônio líquido cai ${Math.abs(worst.equityDrawdown).toFixed(1).replace(".", ",")}% — acima do que a maioria dos mandatos tolera sem revisão.`,
    );
  }
  if (equity > 0 && Math.abs(worst?.equityDrawdown ?? 0) > Math.abs((worst?.assetDelta ?? 0) / totalAssets) * 100 * 1.3 && debt > 0) {
    warnings.push(
      "A alavancagem amplifica a queda: a perda no patrimônio líquido é maior que a perda no ativo.",
    );
  }
  const riskiest = classes[0];
  if (riskiest && riskiest.riskShare > 60) {
    warnings.push(
      `${riskiest.label} concentra ${riskiest.riskShare.toFixed(0)}% do risco da carteira com ${riskiest.weight.toFixed(0)}% do patrimônio.`,
    );
  }
  const lowVol = classes.filter((item) => item.volatility <= 5).reduce((total, item) => total + item.value, 0);
  if (totalAssets > 0 && lowVol / totalAssets < 0.05 && debt > 0) {
    warnings.push("Menos de 5% do ativo em baixa volatilidade: não há colchão para honrar parcela em ano ruim.");
  }
  if (cashBufferMonths !== null && cashBufferMonths < 6) {
    warnings.push(
      `Liquidez D0/D1 cobre ${cashBufferMonths.toFixed(1).replace(".", ",")} mês(es) do serviço da dívida — o mínimo prudente é 6.`,
    );
  }
  if (debtShock.annualCostDelta > 0) {
    warnings.push(
      `Juros +${(rateShockBps / 100).toFixed(1).replace(".", ",")} p.p. encarecem a dívida em ${debtShock.annualCostDelta.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/ano.`,
    );
  }
  const imoveis = classes.find((item) => item.key === "imoveis");
  if (imoveis && imoveis.weight >= 60) {
    warnings.push(
      `${imoveis.weight.toFixed(0)}% do ativo em imóvel avaliado por laudo: o VaR usa volatilidade contábil e por isso subestima o risco real — leia junto do cenário "Imóveis -20%".`,
    );
  }
  if (totalAssets === 0) {
    warnings.push("Sem ativos cadastrados: VaR e stress não têm o que medir.");
  }

  return {
    assets: { financial: round(financial, 2), registered: round(registered, 2), total: round(totalAssets, 2) },
    equity: round(equity, 2),
    debt: round(debt, 2),
    var: {
      confidence,
      horizonDays,
      z,
      portfolioVolatility: round(portfolioVolatility, 2),
      horizonSigma: round(horizonSigma, 2),
      amount: round(varAmount, 2),
      percentage: totalAssets > 0 ? round((varAmount / totalAssets) * 100, 2) : 0,
      percentageOfEquity: equity > 0 ? round((varAmount / equity) * 100, 2) : 0,
    },
    classes,
    scenarios,
    debtShock,
    liquidity: { liquid: round(liquid, 2), cashBufferMonths },
    warnings,
  };
}
