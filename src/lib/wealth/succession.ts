/**
 * Sucessão e tributação — ITCMD, partilha e comparação de estruturas.
 *
 * Este é o módulo que traz para o PATRIUM OS o que a Finvity vende como núcleo:
 * transformar "quanto custa herdar" em número, com as regras brasileiras.
 *
 * Premissas explícitas (e ajustáveis):
 *  - **Regime de bens** define a meação: comunhão parcial/total → 50% do casal
 *    sai antes da herança; separação total → 100% entra no espólio.
 *  - **Legítima** = 50% do patrimônio transmissível vai obrigatoriamente aos
 *    herdeiros necessários (filhos/cônjuge); os outros 50% são a parte disponível.
 *  - **ITCMD** é estadual: alíquota progressiva por faixa. A tabela abaixo cobre
 *    as UFs mais usadas em planejamento patrimonial e é explicitamente
 *    *parametrizável* — quando a reforma tributária mudar as faixas, muda-se a
 *    tabela, não a lógica.
 *  - **Doação em vida** antecipa o imposto, mas normalmente com alíquota menor e
 *    sem inventário: é isso que a comparação de cenários torna visível.
 *
 * ⚠️ Ferramenta de simulação. Não substitui parecer jurídico/tributário.
 */

export type MaritalRegime =
  | "comunhao_parcial"
  | "comunhao_universal"
  | "separacao_total"
  | "participacao_finalistica";

export const MARITAL_REGIME_LABELS: Record<MaritalRegime, string> = {
  comunhao_parcial: "Comunhão parcial de bens",
  comunhao_universal: "Comunhão universal de bens",
  separacao_total: "Separação total de bens",
  participacao_finalistica: "Participação final nos aquestos",
};

/** Fração do patrimônio que integra o espólio (o resto é meação do cônjuge). */
export function estateFraction(regime: MaritalRegime): number {
  switch (regime) {
    case "comunhao_parcial":
    case "comunhao_universal":
      return 0.5;
    case "separacao_total":
    case "participacao_finalistica":
      return 1;
  }
}

/**
 * Faixas de ITCMD por UF (causa mortis e doação).
 * `upTo` em reais; `rate` em %. A última faixa vai até o infinito (upTo null).
 */
export type ItcmdBracket = { upTo: number | null; rate: number };

export const ITCMD_TABLE: Record<string, { name: string; brackets: ItcmdBracket[] }> = {
  PR: {
    name: "Paraná",
    brackets: [
      { upTo: 150_000, rate: 2 },
      { upTo: 300_000, rate: 4 },
      { upTo: 600_000, rate: 6 },
      { upTo: null, rate: 8 },
    ],
  },
  SP: {
    name: "São Paulo",
    brackets: [{ upTo: null, rate: 4 }],
  },
  MG: {
    name: "Minas Gerais",
    brackets: [
      { upTo: 200_000, rate: 1 },
      { upTo: 600_000, rate: 3 },
      { upTo: 1_200_000, rate: 5 },
      { upTo: null, rate: 7 },
    ],
  },
  RJ: {
    name: "Rio de Janeiro",
    brackets: [
      { upTo: 70_000, rate: 4 },
      { upTo: 200_000, rate: 4.5 },
      { upTo: 400_000, rate: 5 },
      { upTo: 800_000, rate: 6 },
      { upTo: null, rate: 8 },
    ],
  },
  RS: {
    name: "Rio Grande do Sul",
    brackets: [
      { upTo: 400_000, rate: 0 },
      { upTo: null, rate: 6 },
    ],
  },
  GO: {
    name: "Goiás",
    brackets: [
      { upTo: 250_000, rate: 2 },
      { upTo: 400_000, rate: 4 },
      { upTo: null, rate: 8 },
    ],
  },
  MT: {
    name: "Mato Grosso",
    brackets: [
      { upTo: 500_000, rate: 2 },
      { upTo: 1_000_000, rate: 4 },
      { upTo: null, rate: 8 },
    ],
  },
  MS: {
    name: "Mato Grosso do Sul",
    brackets: [
      { upTo: 700_000, rate: 3 },
      { upTo: 1_400_000, rate: 5 },
      { upTo: null, rate: 6 },
    ],
  },
  BA: {
    name: "Bahia",
    brackets: [
      { upTo: 100_000, rate: 3.5 },
      { upTo: 200_000, rate: 5 },
      { upTo: 500_000, rate: 7 },
      { upTo: null, rate: 8 },
    ],
  },
};

export const DEFAULT_STATE = "PR";

/**
 * ITCMD devido sobre uma base, aplicando **alíquota marginal por faixa**
 * (modelo progressivo real: cada faixa tributa só a parcela que está nela).
 *
 * Observação importante: alguns estados aplicam alíquota única da faixa em que o
 * patrimônio cai. Aqui usamos o modelo progressivo por faixa (mais comum em PR,
 * MG, RJ, BA) e expomos `effectiveRate` para transparentizar o resultado.
 */
export function computeItcmd(base: number, state = DEFAULT_STATE): {
  state: string;
  stateName: string;
  base: number;
  tax: number;
  effectiveRate: number;
  brackets: { upTo: number | null; rate: number; taxed: number; tax: number }[];
} {
  const table = ITCMD_TABLE[state] ?? ITCMD_TABLE[DEFAULT_STATE];
  let previousCap = 0;
  let remaining = Math.max(0, base);
  let tax = 0;
  const detail: { upTo: number | null; rate: number; taxed: number; tax: number }[] = [];

  for (const bracket of table.brackets) {
    if (remaining <= 0) break;
    const cap = bracket.upTo ?? Infinity;
    const taxableInBracket = Math.min(remaining, cap - previousCap);
    if (taxableInBracket <= 0) continue;
    const bracketTax = (taxableInBracket * bracket.rate) / 100;
    tax += bracketTax;
    detail.push({ upTo: bracket.upTo, rate: bracket.rate, taxed: round(taxableInBracket, 2), tax: round(bracketTax, 2) });
    remaining -= taxableInBracket;
    previousCap = cap;
  }

  return {
    state,
    stateName: table.name,
    base: round(base, 2),
    tax: round(tax, 2),
    effectiveRate: base > 0 ? round((tax / base) * 100, 4) : 0,
    brackets: detail,
  };
}

export type SuccessionInput = {
  /** Patrimônio total do casal/família, em reais. */
  patrimony: number;
  regime: MaritalRegime;
  state: string;
  heirs: number;
  /** Custo estimado de inventário judicial, em % do espólio (default 8%). */
  inventoryCostPercent?: number;
  /** Honorários advocatícios sobre o espólio, em % (default 6%). */
  legalFeesPercent?: number;
  /** Doação em vida: ITCMD antecipado com possível redução de base. */
  donateInLife?: boolean;
  /** Desconto médio de base na doação em vida (ex.: avaliação pelo valor venal). */
  donationDiscountPercent?: number;
};

export type SuccessionResult = {
  grossPatrimony: number;
  meacao: number;
  estate: number;
  itcmd: ReturnType<typeof computeItcmd>;
  inventoryCost: number;
  legalFees: number;
  totalCost: number;
  /** Custo total como % do patrimônio. */
  effectiveCost: number;
  /** O que efetivamente chega aos herdeiros. */
  netToHeirs: number;
  perHeir: number;
  /** Reserva obrigatória (50% do espólio). */
  legitima: number;
  /** Parte disponível (pode ir para quem o titular quiser). */
  availablePortion: number;
};

export function simulateSuccession(input: SuccessionInput): SuccessionResult {
  const gross = Math.max(0, Number(input.patrimony) || 0);
  const fraction = estateFraction(input.regime);
  const meacao = round(gross * (1 - fraction), 2);
  const estate = round(gross * fraction, 2);

  const base =
    input.donateInLife && input.donationDiscountPercent
      ? estate * (1 - Math.min(90, Math.max(0, input.donationDiscountPercent)) / 100)
      : estate;

  const itcmd = computeItcmd(base, input.state);
  const inventoryPercent = input.inventoryCostPercent ?? 8;
  const feesPercent = input.legalFeesPercent ?? 6;

  // Doação em vida não passa por inventário: some o custo do processo.
  const inventoryCost = input.donateInLife ? 0 : round((estate * inventoryPercent) / 100, 2);
  const legalFees = round((estate * feesPercent) / 100, 2);

  const totalCost = round(itcmd.tax + inventoryCost + legalFees, 2);
  const heirs = Math.max(1, Math.round(input.heirs) || 1);

  return {
    grossPatrimony: round(gross, 2),
    meacao,
    estate,
    itcmd,
    inventoryCost,
    legalFees,
    totalCost,
    effectiveCost: gross > 0 ? round((totalCost / gross) * 100, 4) : 0,
    netToHeirs: round(gross - totalCost, 2),
    perHeir: round((gross - totalCost) / heirs, 2),
    legitima: round(estate * 0.5, 2),
    availablePortion: round(estate * 0.5, 2),
  };
}

export type ScenarioComparison = {
  label: string;
  description: string;
  result: SuccessionResult;
  /** Economia (positiva) ou custo adicional (negativa) vs cenário base. */
  deltaVsBase: number;
};

/**
 * Compara três caminhos usuais: herança direta, doação em vida e holding
 * familiar (que aqui só muda o custo de inventário, porque bens em PJ não
 * passam por inventário — o ITCMD incide na transferência de quotas).
 */
export function compareScenarios(input: SuccessionInput): ScenarioComparison[] {
  const base = simulateSuccession(input);
  const donation = simulateSuccession({ ...input, donateInLife: true, donationDiscountPercent: 0 });
  const holding = simulateSuccession({ ...input, inventoryCostPercent: 2 });

  return [
    {
      label: "Herança (inventário)",
      description: "Transmissão causa mortis com inventário judicial ou extrajudicial.",
      result: base,
      deltaVsBase: 0,
    },
    {
      label: "Doação em vida",
      description: "Antecipação com ITCMD doação; dispensa inventário sobre os bens doados.",
      result: donation,
      deltaVsBase: round(base.totalCost - donation.totalCost, 2),
    },
    {
      label: "Holding familiar",
      description: "Bens integralizados em PJ: quotas transferidas, inventário reduzido ao processo da holding.",
      result: holding,
      deltaVsBase: round(base.totalCost - holding.totalCost, 2),
    },
  ];
}

/** Alertas de governança sucessória — o que o sistema recomenda olhar. */
export function successionInsights(result: SuccessionResult, heirs: number): string[] {
  const notes: string[] = [];
  if (result.effectiveCost > 20) {
    notes.push(
      `Custo de transmissão de ${result.effectiveCost.toFixed(1)}% do patrimônio é alto — simule doação em vida e holding.`,
    );
  }
  if (result.itcmd.effectiveRate >= 8) {
    notes.push(
      `A alíquota efetiva de ITCMD (${result.itcmd.effectiveRate.toFixed(2)}%) já está no teto da UF — antecipar a doação tende a reduzir.`,
    );
  }
  if (heirs > 1 && result.perHeir < 1_000_000) {
    notes.push("Partilha pulverizada: avalie testamento e cláusulas de indivisibilidade em quotas.");
  }
  if (result.meacao === 0) {
    notes.push("Regime de separação total: 100% do patrimônio entra no espólio — a meação não protege.");
  }
  if (notes.length === 0) {
    notes.push("Estrutura dentro de parâmetros usuais. Revisar a cada mudança de regime ou de UF.");
  }
  return notes;
}

function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
