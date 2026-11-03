/**
 * Contencioso como número, não como lista.
 *
 * O módulo jurídico do PATRIUM listava processos e `value_at_stake` — o valor da
 * causa, que é a pergunta errada. A pergunta certa é: **quanto disso é provisão
 * (reduz o PL hoje), quanto é divulgação (pode reduzir) e quanto é recuperação
 * esperada (não se reconhece)**.
 *
 * Régua contábil usada (CPC 25 / IAS 37):
 *   - perda provável (p > 50%)      -> reconhece provisão pelo valor esperado
 *   - perda possível (10% < p ≤ 50%) -> divulga em nota, não reconhece
 *   - perda remota (p ≤ 10%)         -> não reconhece e não divulga
 *   - ganho (caso ativo)             -> **nunca** reconhece; só divulga
 *   - processo sem contingência (inventário, regularização, usucapião) -> nem
 *     provisão nem divulgação: é prazo a acompanhar, não dívida
 *
 * Premissas declaradas, não escondidas:
 *   - sem probabilidade informada pelo jurídico, a probabilidade vem de uma
 *     tabela fixa por `risk_level` + ajuste por fase processual (abaixo). É
 *     heurística, e o relatório diz em quais casos ela foi usada.
 *   - provisão com desembolso previsto acima de 12 meses é trazida a valor
 *     presente por 10% a.a. (CPC 25, §46). Abaixo de 12 meses não desconta.
 *   - `encerrado` zera a probabilidade: processo acabado não gera perda futura,
 *     mas se o lançamento continuar aberto o produto acusa baixa pendente.
 */

export type CasePolarity = "passivo" | "ativo" | "neutro";
export type ProvisionBand = "provavel" | "possivel" | "remota";
export type LegalCaseType =
  | "civel"
  | "tributario"
  | "ambiental"
  | "trabalhista"
  | "societario"
  | "imobiliario";
export type LegalCaseStatus = "em_andamento" | "suspenso" | "acordo" | "encerrado";
export type LegalRiskLevel = "low" | "medium" | "high" | "critical";
export type LegalPhase =
  | "conhecimento"
  | "instrucao"
  | "sentenca"
  | "recurso"
  | "execucao"
  | "encerrado";

export type LegalCaseLike = {
  id?: string;
  case_number?: string | null;
  title: string;
  type: LegalCaseType;
  status: LegalCaseStatus;
  risk_level: LegalRiskLevel;
  value_at_stake: number | string | null;
  polarity?: CasePolarity | null;
  probability?: number | string | null;
  phase?: LegalPhase | null;
  expected_settlement?: string | null;
};

export type ProvisionEntryKind = "constituicao" | "atualizacao" | "reversao" | "baixa";

export type ProvisionEntryLike = {
  case_id?: string | null;
  kind: ProvisionEntryKind;
  amount: number | string | null;
  occurred_on: string;
};

export type LegalAssumptions = {
  /** Taxa de desconto anual da provisão (valor presente). */
  discountRateAnnual: number;
  /** Prazo usado quando o processo não tem data prevista de desembolso. */
  defaultSettlementMonths: number;
  /** Abaixo disso a perda é remota. */
  remoteBelow: number;
  /** A partir disso a perda é provável (reconhece). */
  probableFrom: number;
  baseProbabilityByRisk: Record<LegalRiskLevel, number>;
  phaseAdjustment: Record<LegalPhase, number>;
};

export const DEFAULT_LEGAL_ASSUMPTIONS: LegalAssumptions = {
  discountRateAnnual: 0.1,
  defaultSettlementMonths: 24,
  remoteBelow: 0.1,
  probableFrom: 0.5,
  baseProbabilityByRisk: { low: 0.15, medium: 0.35, high: 0.6, critical: 0.75 },
  phaseAdjustment: {
    conhecimento: -0.05,
    instrucao: 0,
    sentenca: 0.1,
    recurso: 0.05,
    execucao: 0.15,
    encerrado: 0,
  },
};

export const BAND_LABELS: Record<ProvisionBand, string> = {
  provavel: "Provável",
  possivel: "Possível",
  remota: "Remota",
};

export const PHASE_LABELS: Record<LegalPhase, string> = {
  conhecimento: "Conhecimento",
  instrucao: "Instrução",
  sentenca: "Sentença",
  recurso: "Recurso",
  execucao: "Execução",
  encerrado: "Encerrado",
};

export const LEGAL_TYPE_LABELS: Record<LegalCaseType, string> = {
  civel: "Cível",
  tributario: "Tributário",
  ambiental: "Ambiental",
  trabalhista: "Trabalhista",
  societario: "Societário",
  imobiliario: "Imobiliário",
};

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Meses (fracionários) entre hoje e uma data de desembolso previsto. */
export function monthsUntil(dateIso: string | null | undefined, today: string): number | null {
  if (!dateIso) return null;
  const target = Date.parse(dateIso);
  const base = Date.parse(today);
  if (Number.isNaN(target) || Number.isNaN(base)) return null;
  return (target - base) / (1000 * 60 * 60 * 24 * 30.4375);
}

/**
 * Probabilidade de perda do caso, com a origem declarada.
 *
 * `informada` (coluna numérica) sempre vence a tabela — o jurídico sabe mais que
 * o modelo. Quando não há número, a heurística é risco × fase, limitada a
 * [2%, 98%] para nunca prometer certeza que processo nenhum tem.
 */
export function resolveProbability(
  legalCase: LegalCaseLike,
  assumptions: LegalAssumptions = DEFAULT_LEGAL_ASSUMPTIONS,
): { probability: number; source: "informada" | "premissa" } {
  if (legalCase.status === "encerrado") return { probability: 0, source: "premissa" };

  const informed = legalCase.probability;
  if (informed !== null && informed !== undefined && informed !== "") {
    const parsed = num(informed);
    if (parsed > 0) return { probability: clamp(parsed, 0.02, 0.98), source: "informada" };
  }

  const base = assumptions.baseProbabilityByRisk[legalCase.risk_level] ?? 0.35;
  const phase = legalCase.phase ? (assumptions.phaseAdjustment[legalCase.phase] ?? 0) : 0;
  return { probability: clamp(base + phase, 0.02, 0.98), source: "premissa" };
}

export function classifyBand(
  probability: number,
  assumptions: LegalAssumptions = DEFAULT_LEGAL_ASSUMPTIONS,
): ProvisionBand {
  if (probability >= assumptions.probableFrom) return "provavel";
  if (probability > assumptions.remoteBelow) return "possivel";
  return "remota";
}

/** Fator de valor presente para o prazo até o desembolso. */
export function presentValueFactor(
  months: number,
  assumptions: LegalAssumptions = DEFAULT_LEGAL_ASSUMPTIONS,
): number {
  if (months <= 12) return 1;
  return 1 / Math.pow(1 + assumptions.discountRateAnnual, months / 12);
}

export type CaseAssessment = {
  id: string;
  title: string;
  caseNumber: string | null;
  type: LegalCaseType;
  typeLabel: string;
  status: LegalCaseStatus;
  polarity: CasePolarity;
  phase: LegalPhase | null;
  riskLevel: LegalRiskLevel;
  valueAtStake: number;
  probability: number;
  probabilitySource: "informada" | "premissa";
  band: ProvisionBand;
  /** Probabilidade × valor da causa. */
  expectedValue: number;
  /** Valor presente do valor esperado — só para provável em caso passivo. */
  presentValue: number;
  /** Quanto entra como provisão no balanço (0 fora de "provável" passivo). */
  provision: number;
  /** Quanto é apenas divulgado em nota explicativa. */
  disclosed: number;
  /** Recuperação esperada de caso ativo — nunca reconhecida. */
  expectedRecovery: number;
  /** Pior caso: valor integral da causa. */
  exposure: number;
  settlementMonths: number;
  settlementEstimated: boolean;
  warnings: string[];
};

export type CaseAssessmentOptions = {
  today?: string;
  assumptions?: LegalAssumptions;
};

export function assessCase(
  legalCase: LegalCaseLike,
  options: CaseAssessmentOptions = {},
): CaseAssessment {
  const assumptions = options.assumptions ?? DEFAULT_LEGAL_ASSUMPTIONS;
  const today = options.today ?? new Date().toISOString().slice(0, 10);

  const polarity: CasePolarity =
    legalCase.polarity === "ativo"
      ? "ativo"
      : legalCase.polarity === "neutro"
        ? "neutro"
        : "passivo";
  const valueAtStake = Math.max(0, num(legalCase.value_at_stake));
  const { probability, source } = resolveProbability(legalCase, assumptions);
  const band = classifyBand(probability, assumptions);

  const measured = monthsUntil(legalCase.expected_settlement, today);
  const settlementMonths =
    measured !== null && measured > 0 ? measured : assumptions.defaultSettlementMonths;
  const settlementEstimated = !(measured !== null && measured > 0);
  const factor = presentValueFactor(settlementMonths, assumptions);

  const expectedValue = valueAtStake * probability;
  const presentValue = expectedValue * factor;

  const recognized = polarity === "passivo" && band === "provavel";
  const provision = recognized ? presentValue : 0;
  const disclosed = polarity === "passivo" && band === "possivel" ? presentValue : 0;
  const expectedRecovery = polarity === "ativo" ? presentValue : 0;

  const warnings: string[] = [];
  if (valueAtStake <= 0) {
    warnings.push("Sem valor da causa informado — o processo não entra no cálculo.");
  }
  if (source === "premissa" && valueAtStake > 0 && legalCase.status !== "encerrado") {
    warnings.push(
      "Probabilidade estimada por risco e fase (o jurídico não informou o percentual).",
    );
  }
  if (settlementEstimated && valueAtStake > 0 && legalCase.status !== "encerrado") {
    warnings.push(
      `Sem data prevista de desembolso: adotados ${assumptions.defaultSettlementMonths} meses para o valor presente.`,
    );
  }
  if (polarity === "neutro") {
    warnings.push(
      "Processo sem contingência financeira (inventário, regularização, usucapião): acompanhado por prazo e não provisionado.",
    );
  }
  if (polarity === "ativo" && band === "provavel") {
    warnings.push(
      "Ganho provável é divulgado, nunca reconhecido — reconhecer ganho contingente é vedado pela norma.",
    );
  }

  return {
    id: legalCase.id ?? legalCase.case_number ?? legalCase.title,
    title: legalCase.title,
    caseNumber: legalCase.case_number ?? null,
    type: legalCase.type,
    typeLabel: LEGAL_TYPE_LABELS[legalCase.type] ?? legalCase.type,
    status: legalCase.status,
    polarity,
    phase: legalCase.phase ?? null,
    riskLevel: legalCase.risk_level,
    valueAtStake,
    probability,
    probabilitySource: source,
    band,
    expectedValue,
    presentValue,
    provision,
    disclosed,
    expectedRecovery,
    exposure: polarity === "passivo" ? valueAtStake : 0,
    settlementMonths,
    settlementEstimated,
    warnings,
  };
}

export type TypeBreakdownRow = {
  type: LegalCaseType;
  label: string;
  cases: number;
  atStake: number;
  provision: number;
  disclosed: number;
  shareOfProvision: number;
};

export type ProvisionRollforward = {
  opening: number;
  additions: number;
  monetaryUpdate: number;
  reversals: number;
  settlements: number;
  /** opening + additions + update − reversals − baixas */
  closing: number;
  entries: number;
};

export type SensitivityRow = {
  id: string;
  title: string;
  probability: number;
  provisionNow: number;
  provisionPlus10: number;
  provisionMinus10: number;
  /** Δ no PL se a probabilidade subir 10 p.p. */
  equityImpactPlus10: number;
};

export type ProvisionReport = {
  today: string;
  assumptions: LegalAssumptions;
  cases: CaseAssessment[];
  totals: {
    cases: number;
    atStake: number;
    provision: number;
    disclosed: number;
    expectedRecovery: number;
    exposure: number;
    probableCases: number;
    possibleCases: number;
    remoteCases: number;
    activeCases: number;
    neutralCases: number;
    estimatedProbabilityCases: number;
  };
  byType: TypeBreakdownRow[];
  equity: {
    netWorth: number;
    provision: number;
    adjustedNetWorth: number;
    provisionToEquity: number;
    worstCaseNetWorth: number;
    worstCaseDrop: number;
  };
  liquidity: {
    available: number;
    provision: number;
    coverageMonths: number;
  };
  rollforward: ProvisionRollforward;
  sensitivity: SensitivityRow[];
  warnings: string[];
};

export type ProvisionReportInput = {
  cases: (LegalCaseLike & { entities?: { name?: string | null } | null })[];
  entries?: ProvisionEntryLike[];
  netWorth: number;
  liquid?: number;
  periodFrom?: string;
  periodTo?: string;
  today?: string;
  assumptions?: LegalAssumptions;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeRollforward(
  entries: ProvisionEntryLike[],
  periodFrom: string,
  periodTo: string,
): ProvisionRollforward {
  const start = Date.parse(periodFrom);
  const end = Date.parse(periodTo);
  const result: ProvisionRollforward = {
    opening: 0,
    additions: 0,
    monetaryUpdate: 0,
    reversals: 0,
    settlements: 0,
    closing: 0,
    entries: 0,
  };

  for (const entry of entries) {
    const when = Date.parse(entry.occurred_on);
    if (Number.isNaN(when)) continue;
    const amount = num(entry.amount);
    const before = !Number.isNaN(start) && when < start;
    const inside = (Number.isNaN(start) || when >= start) && (Number.isNaN(end) || when <= end);

    if (before) {
      if (entry.kind === "constituicao" || entry.kind === "atualizacao") result.opening += amount;
      else result.opening -= amount;
      continue;
    }
    if (!inside) continue;

    result.entries += 1;
    switch (entry.kind) {
      case "constituicao":
        result.additions += amount;
        break;
      case "atualizacao":
        result.monetaryUpdate += amount;
        break;
      case "reversao":
        result.reversals += amount;
        break;
      case "baixa":
        result.settlements += amount;
        break;
    }
  }

  result.opening = round2(result.opening);
  result.closing = round2(
    result.opening + result.additions + result.monetaryUpdate - result.reversals - result.settlements,
  );
  return result;
}

export function buildProvisionReport(input: ProvisionReportInput): ProvisionReport {
  const assumptions = input.assumptions ?? DEFAULT_LEGAL_ASSUMPTIONS;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const periodTo = input.periodTo ?? today;
  const periodFrom =
    input.periodFrom ?? new Date(Date.parse(today) - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const cases = input.cases
    .map((legalCase) => assessCase(legalCase, { today, assumptions }))
    .sort((a, b) => b.provision - a.provision || b.disclosed - a.disclosed || b.exposure - a.exposure);

  const totals = {
    cases: cases.length,
    atStake: 0,
    provision: 0,
    disclosed: 0,
    expectedRecovery: 0,
    exposure: 0,
    probableCases: 0,
    possibleCases: 0,
    remoteCases: 0,
    activeCases: 0,
    neutralCases: 0,
    estimatedProbabilityCases: 0,
  };

  for (const item of cases) {
    totals.atStake += item.valueAtStake;
    totals.provision += item.provision;
    totals.disclosed += item.disclosed;
    totals.expectedRecovery += item.expectedRecovery;
    totals.exposure += item.exposure;
    // As faixas contam só o passivo: causa ativa não é contingência passiva e é
    // medida em `activeCases` / `expectedRecovery`.
    if (item.polarity === "passivo") {
      if (item.band === "provavel") totals.probableCases += 1;
      else if (item.band === "possivel") totals.possibleCases += 1;
      else totals.remoteCases += 1;
    }
    if (item.polarity === "ativo") totals.activeCases += 1;
    if (item.polarity === "neutro") totals.neutralCases += 1;
    if (item.probabilitySource === "premissa" && item.valueAtStake > 0 && item.status !== "encerrado") {
      totals.estimatedProbabilityCases += 1;
    }
  }

  for (const key of ["atStake", "provision", "disclosed", "expectedRecovery", "exposure"] as const) {
    totals[key] = round2(totals[key]);
  }

  const types: LegalCaseType[] = [
    "tributario",
    "trabalhista",
    "civel",
    "ambiental",
    "imobiliario",
    "societario",
  ];
  const byType: TypeBreakdownRow[] = types
    .map((type) => {
      const subset = cases.filter((item) => item.type === type);
      const provision = round2(subset.reduce((sum, item) => sum + item.provision, 0));
      return {
        type,
        label: LEGAL_TYPE_LABELS[type],
        cases: subset.length,
        atStake: round2(subset.reduce((sum, item) => sum + item.valueAtStake, 0)),
        provision,
        disclosed: round2(subset.reduce((sum, item) => sum + item.disclosed, 0)),
        shareOfProvision: totals.provision > 0 ? round2((provision / totals.provision) * 100) : 0,
      };
    })
    // Tipo sem provisão nem divulgação é ruído no gráfico "de onde vem a provisão".
    .filter((row) => row.provision > 0 || row.disclosed > 0)
    .sort((a, b) => b.provision - a.provision || b.atStake - a.atStake);

  const netWorth = num(input.netWorth);
  const adjustedNetWorth = round2(netWorth - totals.provision);
  const worstCaseNetWorth = round2(netWorth - totals.provision - totals.disclosed);

  const liquid = num(input.liquid);
  const liquidity = {
    available: round2(liquid),
    provision: totals.provision,
    coverageMonths: totals.provision > 0 ? round2((liquid / totals.provision) * 12) : 0,
  };

  const rollforward = computeRollforward(input.entries ?? [], periodFrom, periodTo);

  const sensitivity: SensitivityRow[] = cases
    .filter((item) => item.polarity === "passivo" && item.provision > 0)
    .slice(0, 5)
    .map((item) => {
      const plus = clamp(item.probability + 0.1, 0.02, 0.98);
      const minus = clamp(item.probability - 0.1, 0.02, 0.98);
      const factor = presentValueFactor(item.settlementMonths, assumptions);
      const provisionAt = (probability: number) => {
        const band = classifyBand(probability, assumptions);
        if (band !== "provavel") return 0;
        return round2(item.valueAtStake * probability * factor);
      };
      return {
        id: item.id,
        title: item.title,
        probability: round2(item.probability * 100),
        provisionNow: item.provision,
        provisionPlus10: provisionAt(plus),
        provisionMinus10: provisionAt(minus),
        equityImpactPlus10: round2(item.provision - provisionAt(plus)),
      };
    });

  const warnings: string[] = [];

  const largest = cases.find((item) => item.provision > 0);
  if (largest && totals.provision > 0 && largest.provision / totals.provision >= 0.5) {
    warnings.push(
      `${largest.title} concentra ${Math.round((largest.provision / totals.provision) * 100)}% da provisão — um único processo decide o passivo contingente.`,
    );
  }

  const taxRow = byType.find((row) => row.type === "tributario");
  if (taxRow && taxRow.shareOfProvision >= 40) {
    warnings.push(
      `Tributário responde por ${Math.round(taxRow.shareOfProvision)}% da provisão — costuma ser o passivo mais judicializável e o de maior chance de acordo.`,
    );
  }

  if (netWorth > 0 && totals.provision / netWorth >= 0.15) {
    warnings.push(
      `A provisão consome ${(totals.provision / netWorth * 100).toFixed(1).replace(".", ",")}% do PL — o patrimônio divulgado hoje não é o patrimônio disponível.`,
    );
  }

  if (totals.estimatedProbabilityCases > 0) {
    warnings.push(
      `${totals.estimatedProbabilityCases} processo(s) usando probabilidade estimada por risco e fase. Peça o percentual ao jurídico: é o número que mais move a provisão.`,
    );
  }

  const openClosed = cases.filter(
    (item) => item.status === "encerrado" && input.entries?.some((entry) => entry.case_id === item.id),
  );
  if (openClosed.length > 0) {
    warnings.push(
      `${openClosed.length} processo(s) encerrado(s) com lançamento de provisão em aberto — faça a baixa para o saldo não ficar inflado.`,
    );
  }

  if (totals.expectedRecovery > 0) {
    warnings.push(
      `R$ ${totals.expectedRecovery.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} de recuperação esperada em causas ativas: divulgada em nota, jamais somada ao ativo.`,
    );
  }

  if (liquidity.coverageMonths > 0 && liquidity.coverageMonths < 12) {
    warnings.push(
      `Liquidez cobre ${liquidity.coverageMonths.toFixed(1).replace(".", ",")} meses da provisão — abaixo de 12 o desembolso pode forçar venda de ativo.`,
    );
  }

  if (Math.abs(rollforward.closing - totals.provision) > Math.max(1000, totals.provision * 0.02)) {
    warnings.push(
      `Saldo escriturado (R$ ${rollforward.closing.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}) difere da provisão recalculada (R$ ${totals.provision.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}) — registre a constituição ou a reversão da diferença.`,
    );
  }

  return {
    today,
    assumptions,
    cases,
    totals,
    byType,
    equity: {
      netWorth: round2(netWorth),
      provision: totals.provision,
      adjustedNetWorth,
      provisionToEquity: netWorth > 0 ? round2((totals.provision / netWorth) * 100) : 0,
      worstCaseNetWorth,
      worstCaseDrop: netWorth > 0 ? round2(((worstCaseNetWorth - netWorth) / netWorth) * 100) : 0,
    },
    liquidity,
    rollforward,
    sensitivity,
    warnings,
  };
}
