/**
 * Agro como negócio, não como "ativo rural".
 *
 * O PATRIUM já sabia que a família tem fazenda: nome, hectares em texto livre e
 * valor de laudo. O que ele não sabia é o que decide a vida do produtor —
 * **margem por talhão, custo da saca, ponto de equilíbrio, taxa implícita do
 * barter, cap rate do arrendamento e passivo ambiental**. Sem isso, a fazenda é
 * um número no balanço que não conversa com a operação nem com o risco.
 *
 * Este motor é 100% função pura: entra dado, sai conta. Nenhuma premissa fica
 * escondida — todas moram em `DEFAULT_AGRO_ASSUMPTIONS` e podem ser trocadas
 * pelo chamador (a tela expõe as que mais mexem no resultado).
 *
 * Premissas declaradas:
 *   - preços de saca e custo/ha vêm do dado ou do default do módulo; nunca de
 *     "cotação de hoje" inventada.
 *   - TMA (custo de oportunidade) padrão 10% a.a. real.
 *   - terra nua R$ 45.000/ha como referência genérica de cerrado agrícola — é
 *     a premissa mais sensível do módulo e por isso aparece na tela.
 *   - recomposição de reserva legal a R$ 6.000/ha.
 *   - crédito agrícola de referência 18% a.a., para comparar com o barter.
 */

export type AgroCrop =
  | "soja"
  | "milho"
  | "milho_safrinha"
  | "algodao"
  | "cana"
  | "cafe"
  | "pastagem"
  | "floresta"
  | "saf"
  | "outro";

export type AgroSystem = "lavoura" | "pastagem" | "saf" | "floresta" | "il" | "app";
export type AgroBiome =
  | "amazonia"
  | "cerrado"
  | "mata_atlantica"
  | "pampa"
  | "pantanal"
  | "caatinga";
export type CarStatus = "ativo" | "pendente" | "em_analise" | "irregular" | "sem_car";
export type LeaseRole = "arrendador" | "arrendatario" | "parceiro_outorgante" | "parceiro_outorgado";
export type LeasePayment = "dinheiro" | "sacas" | "parceria";

export type AgroFieldLike = {
  id?: string;
  asset_id?: string | null;
  name: string;
  area_ha: number | string;
  crop: AgroCrop;
  system?: AgroSystem | null;
  productivity_sc_ha?: number | string | null;
  cost_per_ha?: number | string | null;
  season?: string | null;
};

export type AgroLeaseLike = {
  id?: string;
  asset_id?: string | null;
  role: LeaseRole;
  counterparty?: string | null;
  area_ha: number | string;
  payment: LeasePayment;
  price_per_ha_year?: number | string | null;
  bags_per_ha?: number | string | null;
  share_percent?: number | string | null;
  /** Valor da produção da área arrendada no ano — necessário para parceria. */
  production_value?: number | string | null;
  ends_on?: string | null;
};

export type AgroBarterLike = {
  id?: string;
  supplier?: string | null;
  season?: string | null;
  /** Valor dos insumos à vista, em R$. */
  input_value: number | string;
  /** Sacas devidas na entrega. */
  bags_due: number | string;
  /** Preço da saca usado no fechamento do contrato. */
  bag_reference_price: number | string;
  area_ha?: number | string | null;
  /** Meses entre a entrega dos insumos e a entrega das sacas. */
  months_to_delivery?: number | string | null;
};

export type AgroEnvironmentalLike = {
  id?: string;
  asset_id?: string | null;
  total_ha: number | string;
  biome: AgroBiome;
  /** Propriedade dentro da Amazônia Legal (muda a exigência do cerrado). */
  in_legal_amazon?: boolean | null;
  legal_reserve_declared_ha?: number | string | null;
  app_ha?: number | string | null;
  car_number?: string | null;
  car_status?: CarStatus | null;
};

export type AgroAssumptions = {
  discountRateAnnual: number;
  landValuePerHa: number;
  soyPricePerBag: number;
  cornPricePerBag: number;
  /**
   * Preço de referência por cultura, na unidade de cada uma (saca, arroba,
   * tonelada). Cultura sem preço aqui rende zero — e o motor avisa em vez de
   * fingir margem.
   */
  defaultPricePerUnit: Partial<Record<AgroCrop, number>>;
  replantingCostPerHa: number;
  bankRateAnnual: number;
  /** Cap rate de referência para transformar renda de arrendamento em valor. */
  leaseCapRate: number;
  /** Custo por hectare por cultura quando o dado não vem do banco. */
  defaultCostPerHa: Partial<Record<AgroCrop, number>>;
  /** Produtividade de referência (sc/ha) quando o dado não vem do banco. */
  defaultYieldPerHa: Partial<Record<AgroCrop, number>>;
};

export const DEFAULT_AGRO_ASSUMPTIONS: AgroAssumptions = {
  discountRateAnnual: 0.1,
  landValuePerHa: 45_000,
  soyPricePerBag: 128,
  cornPricePerBag: 68,
  defaultPricePerUnit: {
    soja: 128,          // R$/saca 60 kg
    milho: 68,          // R$/saca 60 kg
    milho_safrinha: 68,
    algodao: 70,        // R$/arroba de algodão em caroço
    cana: 120,          // R$/tonelada
    cafe: 1_050,        // R$/saca 60 kg
    pastagem: 0,
    floresta: 0,
    saf: 0,
    outro: 0,
  },
  replantingCostPerHa: 6_000,
  bankRateAnnual: 0.18,
  leaseCapRate: 0.04,
  defaultCostPerHa: {
    soja: 7_200,
    milho: 6_100,
    milho_safrinha: 4_300,
    algodao: 13_800,
    cana: 9_400,
    cafe: 16_500,
    pastagem: 900,
    floresta: 600,
    saf: 3_200,
    outro: 5_000,
  },
  defaultYieldPerHa: {
    soja: 62,
    milho: 105,
    milho_safrinha: 88,
    algodao: 275,
    cana: 80,
    cafe: 40,
    pastagem: 0,
    floresta: 0,
    saf: 0,
    outro: 0,
  },
};

export const CROP_LABELS: Record<AgroCrop, string> = {
  soja: "Soja",
  milho: "Milho",
  milho_safrinha: "Milho safrinha",
  algodao: "Algodão",
  cana: "Cana",
  cafe: "Café",
  pastagem: "Pastagem",
  floresta: "Floresta plantada",
  saf: "SAF",
  outro: "Outro",
};

export const BIOME_LABELS: Record<AgroBiome, string> = {
  amazonia: "Amazônia",
  cerrado: "Cerrado",
  mata_atlantica: "Mata Atlântica",
  pampa: "Pampa",
  pantanal: "Pantanal",
  caatinga: "Caatinga",
};

export const CAR_STATUS_LABELS: Record<CarStatus, string> = {
  ativo: "CAR ativo",
  pendente: "CAR pendente",
  em_analise: "CAR em análise",
  irregular: "CAR irregular",
  sem_car: "Sem CAR",
};

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Unidade de produção de cada cultura — sem isso "275" não significa nada. */
export const CROP_UNITS: Record<AgroCrop, string> = {
  soja: "saca",
  milho: "saca",
  milho_safrinha: "saca",
  algodao: "arroba",
  cana: "tonelada",
  cafe: "saca",
  pastagem: "—",
  floresta: "—",
  saf: "—",
  outro: "un.",
};

/** Preço de referência por cultura (unidade da própria cultura). */
export function referencePrice(crop: AgroCrop, assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS) {
  const fromMap = assumptions.defaultPricePerUnit?.[crop];
  if (fromMap !== undefined) return fromMap;
  if (crop === "soja") return assumptions.soyPricePerBag;
  if (crop === "milho" || crop === "milho_safrinha") return assumptions.cornPricePerBag;
  return 0;
}

// ---------------------------------------------------------------------------
// Margem por talhão
// ---------------------------------------------------------------------------

export type FieldMargin = {
  id: string;
  name: string;
  crop: AgroCrop;
  cropLabel: string;
  season: string | null;
  areaHa: number;
  productivity: number;
  pricePerBag: number;
  costPerHa: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPerHa: number;
  /** Custo dividido pela produção: quanto custa cada saca produzida. */
  costPerBag: number;
  /** Preço da saca que zera a margem. */
  breakEvenPrice: number;
  /** Produtividade (sc/ha) que zera a margem. */
  breakEvenProductivity: number;
  marginPct: number;
  /** Cultura sem receita no módulo (pastagem, floresta): margem não é medida aqui. */
  nonTraded: boolean;
};

export function computeFieldMargin(
  field: AgroFieldLike,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
  priceOverrides: Partial<Record<AgroCrop, number>> = {},
): FieldMargin {
  const areaHa = Math.max(0, num(field.area_ha));
  const nonTraded = field.crop === "pastagem" || field.crop === "floresta";
  const productivity =
    num(field.productivity_sc_ha) || assumptions.defaultYieldPerHa[field.crop] || 0;
  const costPerHa = num(field.cost_per_ha) || assumptions.defaultCostPerHa[field.crop] || 0;
  const pricePerBag = priceOverrides[field.crop] ?? referencePrice(field.crop, assumptions);

  const bags = areaHa * productivity;
  const revenue = bags * pricePerBag;
  const cost = areaHa * costPerHa;
  const margin = revenue - cost;

  return {
    id: field.id ?? field.name,
    name: field.name,
    crop: field.crop,
    cropLabel: CROP_LABELS[field.crop] ?? field.crop,
    season: field.season ?? null,
    areaHa,
    productivity,
    pricePerBag,
    costPerHa,
    revenue: round2(revenue),
    cost: round2(cost),
    margin: round2(margin),
    marginPerHa: areaHa > 0 ? round2(margin / areaHa) : 0,
    costPerBag: bags > 0 ? round2(cost / bags) : 0,
    breakEvenPrice: bags > 0 ? round2(cost / bags) : 0,
    breakEvenProductivity: areaHa > 0 && pricePerBag > 0 ? round2(cost / (areaHa * pricePerBag)) : 0,
    marginPct: revenue > 0 ? round2((margin / revenue) * 100) : 0,
    nonTraded,
  };
}

export type CropSummaryRow = {
  crop: AgroCrop;
  label: string;
  fields: number;
  areaHa: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPerHa: number;
  /** Peso no resultado (módulo), sempre positivo — o sinal está em `margin`. */
  shareOfMargin: number;
};

export type MarginReport = {
  fields: FieldMargin[];
  totals: {
    areaHa: number;
    /** Área com margem calculada (lavoura): pastagem e floresta ficam fora. */
    tradedAreaHa: number;
    revenue: number;
    cost: number;
    margin: number;
    marginPerHa: number;
    bags: number;
    costPerBag: number;
    breakEvenPriceWeighted: number;
  };
  byCrop: CropSummaryRow[];
};

export function computeMargins(
  fields: AgroFieldLike[],
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
  priceOverrides: Partial<Record<AgroCrop, number>> = {},
): MarginReport {
  const rows = fields
    .map((field) => computeFieldMargin(field, assumptions, priceOverrides))
    .sort((a, b) => b.margin - a.margin || b.areaHa - a.areaHa);

  const traded = rows.filter((row) => !row.nonTraded);
  const areaHa = rows.reduce((sum, row) => sum + row.areaHa, 0);
  const revenue = traded.reduce((sum, row) => sum + row.revenue, 0);
  const cost = traded.reduce((sum, row) => sum + row.cost, 0);
  const margin = revenue - cost;
  const bags = traded.reduce((sum, row) => sum + row.areaHa * row.productivity, 0);
  const tradedArea = traded.reduce((sum, row) => sum + row.areaHa, 0);

  const cropKeys = Array.from(new Set(traded.map((row) => row.crop)));
  const marginByCrop = new Map<AgroCrop, number>();
  for (const row of traded) {
    const current = marginByCrop.get(row.crop) ?? 0;
    marginByCrop.set(row.crop, current + row.revenue - row.cost);
  }
  const absoluteTotal = Array.from(marginByCrop.values()).reduce((sum, value) => sum + Math.abs(value), 0);
  const byCrop: CropSummaryRow[] = cropKeys
    .map((crop) => {
      const subset = traded.filter((row) => row.crop === crop);
      const cropRevenue = subset.reduce((sum, row) => sum + row.revenue, 0);
      const cropCost = subset.reduce((sum, row) => sum + row.cost, 0);
      const cropMargin = cropRevenue - cropCost;
      const cropArea = subset.reduce((sum, row) => sum + row.areaHa, 0);
      return {
        crop,
        label: CROP_LABELS[crop] ?? crop,
        fields: subset.length,
        areaHa: round2(cropArea),
        revenue: round2(cropRevenue),
        cost: round2(cropCost),
        margin: round2(cropMargin),
        marginPerHa: cropArea > 0 ? round2(cropMargin / cropArea) : 0,
        // Peso no resultado medido em MÓDULO: com safra no vermelho, "quem puxa para
        // baixo" continua legível e o total fecha em 100%. O sinal fica em `margin`.
        shareOfMargin: absoluteTotal > 0 ? round2((Math.abs(cropMargin) / absoluteTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.margin - a.margin);

  return {
    fields: rows,
    totals: {
      areaHa: round2(areaHa),
      tradedAreaHa: round2(tradedArea),
      revenue: round2(revenue),
      cost: round2(cost),
      margin: round2(margin),
      marginPerHa: tradedArea > 0 ? round2(margin / tradedArea) : 0,
      bags: round2(bags),
      costPerBag: bags > 0 ? round2(cost / bags) : 0,
      breakEvenPriceWeighted: bags > 0 ? round2(cost / bags) : 0,
    },
    byCrop,
  };
}

// ---------------------------------------------------------------------------
// Stress: o que a seca e o preço fazem com a margem
// ---------------------------------------------------------------------------

export type StressScenario = {
  id: string;
  label: string;
  thesis: string;
  priceFactor: number;
  yieldFactor: number;
  costFactor: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPerHa: number;
  deltaVsBase: number;
};

export const AGRO_STRESS_SCENARIOS = [
  {
    id: "preco_20",
    label: "Preço −20%",
    thesis: "Safra mundial grande derruba o preço na hora da venda.",
    priceFactor: 0.8,
    yieldFactor: 1,
    costFactor: 1,
  },
  {
    id: "seca_30",
    label: "Seca: produtividade −30%",
    thesis: "Veranico no enchimento de grãos; custo por hectare não cai.",
    priceFactor: 1,
    yieldFactor: 0.7,
    costFactor: 1,
  },
  {
    id: "custo_15",
    label: "Custo +15%",
    thesis: "Fertilizante e diesel em alta — insumo é custo em dólar.",
    priceFactor: 1,
    yieldFactor: 1,
    costFactor: 1.15,
  },
  {
    id: "seca_preco",
    label: "Seca + preço baixo",
    thesis: "O cenário que quebra produtor: safra curta e preço ruim juntos.",
    priceFactor: 0.85,
    yieldFactor: 0.7,
    costFactor: 1.05,
  },
] as const;

export function computeStress(
  report: MarginReport,
  scenarios: readonly (typeof AGRO_STRESS_SCENARIOS)[number][] = AGRO_STRESS_SCENARIOS,
): StressScenario[] {
  const traded = report.fields.filter((row) => !row.nonTraded);
  const baseMargin = report.totals.margin;
  const baseArea = traded.reduce((sum, row) => sum + row.areaHa, 0);

  return scenarios
    .map((scenario) => {
      const revenue = traded.reduce(
        (sum, row) => sum + row.areaHa * row.productivity * row.pricePerBag * scenario.yieldFactor * scenario.priceFactor,
        0,
      );
      const cost = traded.reduce((sum, row) => sum + row.cost * scenario.costFactor, 0);
      const margin = revenue - cost;
      return {
        id: scenario.id,
        label: scenario.label,
        thesis: scenario.thesis,
        priceFactor: scenario.priceFactor,
        yieldFactor: scenario.yieldFactor,
        costFactor: scenario.costFactor,
        revenue: round2(revenue),
        cost: round2(cost),
        margin: round2(margin),
        marginPerHa: baseArea > 0 ? round2(margin / baseArea) : 0,
        deltaVsBase: round2(margin - baseMargin),
      };
    })
    .sort((a, b) => a.margin - b.margin);
}

// ---------------------------------------------------------------------------
// Arrendamento e parceria: renda, cap rate e a decisão "produzir ou arrendar"
// ---------------------------------------------------------------------------

export type LeaseAnalysis = {
  id: string;
  role: LeaseRole;
  counterparty: string | null;
  payment: LeasePayment;
  areaHa: number;
  annualRent: number;
  rentPerHa: number;
  /** Sacas equivalentes por hectare (quando há preço de referência). */
  bagsPerHa: number;
  /** renda anual ÷ valor da terra (%). */
  capRate: number;
  /** Valor da terra implícito pela renda e pelo cap rate de referência. */
  impliedLandValue: number;
  endsOn: string | null;
  warnings: string[];
};

const LEASE_ROLE_LABELS: Record<LeaseRole, string> = {
  arrendador: "Cede área (recebe)",
  arrendatario: "Arrenda área (paga)",
  parceiro_outorgante: "Cede em parceria (recebe)",
  parceiro_outorgado: "Recebe em parceria (paga)",
};

export const LEASE_ROLE_LABELS_MAP = LEASE_ROLE_LABELS;

export function analyzeLease(
  lease: AgroLeaseLike,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
  bagPrice = assumptions.soyPricePerBag,
): LeaseAnalysis {
  const areaHa = Math.max(0, num(lease.area_ha));
  const warnings: string[] = [];

  let annualRent = 0;
  if (lease.payment === "dinheiro") {
    annualRent = areaHa * num(lease.price_per_ha_year);
  } else if (lease.payment === "sacas") {
    annualRent = areaHa * num(lease.bags_per_ha) * bagPrice;
  } else {
    const productionValue = num(lease.production_value);
    annualRent = productionValue * (num(lease.share_percent) / 100);
    if (productionValue <= 0) {
      warnings.push("Parceria sem valor de produção informado — a renda não pode ser calculada.");
    }
  }

  const rentPerHa = areaHa > 0 ? annualRent / areaHa : 0;
  const landValue = areaHa * assumptions.landValuePerHa;
  const capRate = landValue > 0 ? (annualRent / landValue) * 100 : 0;
  const impliedLandValue =
    assumptions.leaseCapRate > 0 ? annualRent / assumptions.leaseCapRate : 0;

  if (lease.payment === "sacas" && num(lease.bags_per_ha) > 0 && bagPrice > 0) {
    const bagsPerHa = num(lease.bags_per_ha);
    if (bagsPerHa > 25) {
      warnings.push(
        `${bagsPerHa.toFixed(1).replace(".", ",")} sacas/ha é acima do padrão de mercado (15–22): confira reajuste e índice do contrato.`,
      );
    }
  }
  if (capRate > 0 && capRate < 2) {
    warnings.push(
      `Cap rate de ${capRate.toFixed(2).replace(".", ",")}% ao ano: arrendar rende menos que a poupança — o valor está no ativo, não na renda.`,
    );
  }

  return {
    id: lease.id ?? `${lease.role}-${lease.counterparty ?? "sem-nome"}`,
    role: lease.role,
    counterparty: lease.counterparty ?? null,
    payment: lease.payment,
    areaHa,
    annualRent: round2(annualRent),
    rentPerHa: round2(rentPerHa),
    bagsPerHa: bagPrice > 0 ? round2(annualRent / areaHa / bagPrice) : 0,
    capRate: round2(capRate),
    impliedLandValue: round2(impliedLandValue),
    endsOn: lease.ends_on ?? null,
    warnings,
  };
}

export type LeaseReport = {
  leases: LeaseAnalysis[];
  totals: {
    receivingRent: number;
    payingRent: number;
    netRent: number;
    areaOut: number;
    areaIn: number;
    weightedCapRate: number;
  };
  /** Comparação direta: margem da lavoura por hectare contra a renda por hectare. */
  produceVsLease: {
    cropMarginPerHa: number;
    rentPerHa: number;
    spreadPerHa: number;
    verdict: "produzir" | "arrendar" | "indiferente";
  } | null;
};

export function buildLeaseReport(
  leases: AgroLeaseLike[],
  margins: MarginReport | null,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
  bagPrice = assumptions.soyPricePerBag,
): LeaseReport {
  const analyzed = leases.map((lease) => analyzeLease(lease, assumptions, bagPrice));
  const receiving = analyzed.filter((item) => item.role === "arrendador" || item.role === "parceiro_outorgante");
  const paying = analyzed.filter((item) => item.role === "arrendatario" || item.role === "parceiro_outorgado");

  const receivingRent = receiving.reduce((sum, item) => sum + item.annualRent, 0);
  const payingRent = paying.reduce((sum, item) => sum + item.annualRent, 0);
  const areaOut = receiving.reduce((sum, item) => sum + item.areaHa, 0);
  const areaIn = paying.reduce((sum, item) => sum + item.areaHa, 0);

  let produceVsLease: LeaseReport["produceVsLease"] = null;
  if (margins && margins.totals.marginPerHa !== 0) {
    const rentPerHa = areaOut > 0 ? receivingRent / areaOut : payingRent;
    const spreadPerHa = margins.totals.marginPerHa - rentPerHa;
    produceVsLease = {
      cropMarginPerHa: margins.totals.marginPerHa,
      rentPerHa: round2(rentPerHa),
      spreadPerHa: round2(spreadPerHa),
      verdict: Math.abs(spreadPerHa) < 100 ? "indiferente" : spreadPerHa > 0 ? "produzir" : "arrendar",
    };
  }

  return {
    leases: analyzed,
    totals: {
      receivingRent: round2(receivingRent),
      payingRent: round2(payingRent),
      netRent: round2(receivingRent - payingRent),
      areaOut: round2(areaOut),
      areaIn: round2(areaIn),
      weightedCapRate: round2(
        analyzed.reduce((sum, item) => sum + item.capRate * item.areaHa, 0) /
          Math.max(1, analyzed.reduce((sum, item) => sum + item.areaHa, 0)),
      ),
    },
    produceVsLease,
  };
}

// ---------------------------------------------------------------------------
// Barter: a taxa de juros escondida no "pago em sacas"
// ---------------------------------------------------------------------------

export type BarterAnalysis = {
  id: string;
  supplier: string | null;
  season: string | null;
  inputValue: number;
  bagsDue: number;
  bagReferencePrice: number;
  monthsToDelivery: number;
  /** Valor das sacas na entrega, ao preço de referência do contrato. */
  valueAtDelivery: number;
  /** Quanto a mais o produtor paga por não pagar à vista. */
  overcost: number;
  overcostPct: number;
  /** Taxa anualizada implícita do "financiamento" em sacas. */
  impliedRateAnnual: number;
  /** Sacas por hectare quando a área é informada. */
  bagsPerHa: number;
  /** Comparação com crédito bancário de referência. */
  spreadVsBank: number;
  verdict: "barter_melhor" | "banco_melhor" | "indiferente";
  warnings: string[];
};

export function analyzeBarter(
  barter: AgroBarterLike,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
): BarterAnalysis {
  const inputValue = Math.max(0, num(barter.input_value));
  const bagsDue = Math.max(0, num(barter.bags_due));
  const bagReferencePrice = Math.max(0, num(barter.bag_reference_price));
  const monthsToDelivery = num(barter.months_to_delivery) || 12;
  const areaHa = num(barter.area_ha);

  const valueAtDelivery = bagsDue * bagReferencePrice;
  const overcost = valueAtDelivery - inputValue;
  const overcostPct = inputValue > 0 ? (overcost / inputValue) * 100 : 0;
  const impliedRateAnnual =
    inputValue > 0 && valueAtDelivery > 0
      ? (Math.pow(valueAtDelivery / inputValue, 12 / Math.max(1, monthsToDelivery)) - 1) * 100
      : 0;
  const spreadVsBank = impliedRateAnnual - assumptions.bankRateAnnual * 100;

  const warnings: string[] = [];
  if (impliedRateAnnual > assumptions.bankRateAnnual * 100) {
    warnings.push(
      `O barter embute ${impliedRateAnnual.toFixed(1).replace(".", ",")}% a.a. contra ${(assumptions.bankRateAnnual * 100).toFixed(0)}% do crédito — caro, mas trava o preço da saca.`,
    );
  }
  if (bagReferencePrice > 0 && assumptions.soyPricePerBag > 0 && bagReferencePrice < assumptions.soyPricePerBag * 0.85) {
    warnings.push(
      "Preço da saca travado bem abaixo da referência: o barter protege da queda, mas entrega o upside ao fornecedor.",
    );
  }
  if (inputValue <= 0 || bagsDue <= 0) {
    warnings.push("Contrato incompleto: informe valor à vista dos insumos e sacas devidas.");
  }

  return {
    id: barter.id ?? `${barter.supplier ?? "barter"}-${barter.season ?? ""}`,
    supplier: barter.supplier ?? null,
    season: barter.season ?? null,
    inputValue: round2(inputValue),
    bagsDue,
    bagReferencePrice,
    monthsToDelivery,
    valueAtDelivery: round2(valueAtDelivery),
    overcost: round2(overcost),
    overcostPct: round2(overcostPct),
    impliedRateAnnual: round2(impliedRateAnnual),
    bagsPerHa: areaHa > 0 ? round2(bagsDue / areaHa) : 0,
    spreadVsBank: round2(spreadVsBank),
    verdict:
      Math.abs(spreadVsBank) < 1 ? "indiferente" : spreadVsBank > 0 ? "banco_melhor" : "barter_melhor",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// SAF: sistema agroflorestal tem fluxo irregular — VPL e TIR, não margem
// ---------------------------------------------------------------------------

export type SafSpecies = {
  name: string;
  /** Primeiro ano de colheita (1 = mesmo ano do plantio). */
  firstHarvestYear: number;
  /** Produtividade por hectare no ano adulto (unidade declarada pelo usuário). */
  yieldPerHa: number;
  /** Preço por unidade de produção. */
  pricePerUnit: number;
  /** Anos até estabilizar a produtividade plena. */
  rampYears?: number;
  /** Ciclo: último ano de colheita (0/omitido = perene). */
  lastHarvestYear?: number;
};

export type SafInput = {
  areaHa: number;
  implementationCostPerHa: number;
  maintenanceCostPerHaYear: number;
  species: SafSpecies[];
  horizonYears?: number;
  discountRateAnnual?: number;
  /** Margem anual por hectare da alternativa (soja) — custo de oportunidade. */
  alternativeMarginPerHa?: number;
};

export type SafYearRow = {
  year: number;
  revenue: number;
  cost: number;
  cashFlow: number;
  cumulative: number;
  alternativeCashFlow: number;
  alternativeCumulative: number;
};

export type SafAnalysis = {
  rows: SafYearRow[];
  npv: number;
  irr: number | null;
  paybackYear: number | null;
  /** Ano em que o SAF supera a soja no acumulado. */
  crossoverYear: number | null;
  totalRevenue: number;
  totalCost: number;
  npvAlternative: number;
  verdict: "saf" | "alternativa" | "indiferente";
  warnings: string[];
};

/** TIR por bisection — sem dependência e sem surpresa de convergência. */
export function irr(cashFlows: number[], guessLow = -0.9, guessHigh = 1.5): number | null {
  const npvAt = (rate: number) =>
    cashFlows.reduce((sum, flow, index) => sum + flow / Math.pow(1 + rate, index), 0);

  let low = guessLow;
  let high = guessHigh;
  let lowValue = npvAt(low);
  let highValue = npvAt(high);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return null;
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const value = npvAt(mid);
    if (Math.abs(value) < 1e-7) return mid;
    if (value * lowValue < 0) {
      high = mid;
      highValue = value;
    } else {
      low = mid;
      lowValue = value;
    }
  }
  return (low + high) / 2;
}

export function computeNpv(cashFlows: number[], rate: number): number {
  return cashFlows.reduce((sum, flow, index) => sum + flow / Math.pow(1 + rate, index), 0);
}

export function analyzeSaf(
  input: SafInput,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
): SafAnalysis {
  const areaHa = Math.max(0, num(input.areaHa));
  const horizon = input.horizonYears ?? 20;
  const rate = input.discountRateAnnual ?? assumptions.discountRateAnnual;
  const alternativeMargin = num(input.alternativeMarginPerHa);

  const rows: SafYearRow[] = [];
  let cumulative = 0;
  let alternativeCumulative = 0;
  let paybackYear: number | null = null;
  let crossoverYear: number | null = null;

  for (let year = 0; year <= horizon; year += 1) {
    let revenue = 0;
    for (const species of input.species) {
      if (year < species.firstHarvestYear) continue;
      if (species.lastHarvestYear && year > species.lastHarvestYear) continue;
      const rampYears = Math.max(1, species.rampYears ?? 1);
      const yearsSinceHarvest = year - species.firstHarvestYear;
      const ramp = Math.min(1, (yearsSinceHarvest + 1) / rampYears);
      revenue += areaHa * species.yieldPerHa * ramp * species.pricePerUnit;
    }

    const cost = year === 0
      ? areaHa * input.implementationCostPerHa
      : areaHa * input.maintenanceCostPerHaYear;

    const cashFlow = revenue - cost;
    cumulative += cashFlow;
    const alternativeCashFlow = areaHa * alternativeMargin;
    alternativeCumulative += alternativeCashFlow;

    if (paybackYear === null && year > 0 && cumulative >= 0) paybackYear = year;
    if (crossoverYear === null && year > 0 && cumulative >= alternativeCumulative) crossoverYear = year;

    rows.push({
      year,
      revenue: round2(revenue),
      cost: round2(cost),
      cashFlow: round2(cashFlow),
      cumulative: round2(cumulative),
      alternativeCashFlow: round2(alternativeCashFlow),
      alternativeCumulative: round2(alternativeCumulative),
    });
  }

  const flows = rows.map((row) => row.cashFlow);
  const npv = computeNpv(flows, rate);
  const rateOfReturn = irr(flows);
  const npvAlternative = computeNpv(
    rows.map((row) => row.alternativeCashFlow),
    rate,
  );

  const warnings: string[] = [];
  if (rateOfReturn !== null && rateOfReturn * 100 < rate * 100) {
    warnings.push(
      `TIR de ${(rateOfReturn * 100).toFixed(1).replace(".", ",")}% a.a. abaixo da TMA de ${(rate * 100).toFixed(0)}%: o SAF só se paga se o valor da terra e do carbono entrarem na conta.`,
    );
  }
  if (paybackYear === null) {
    warnings.push(`Sem payback dentro de ${horizon} anos no fluxo informado.`);
  }
  if (alternativeMargin === 0) {
    warnings.push("Sem margem de soja informada, o custo de oportunidade não entra na comparação.");
  }

  return {
    rows,
    npv: round2(npv),
    irr: rateOfReturn === null ? null : round2(rateOfReturn * 100),
    paybackYear,
    crossoverYear,
    totalRevenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
    totalCost: round2(rows.reduce((sum, row) => sum + row.cost, 0)),
    npvAlternative: round2(npvAlternative),
    verdict:
      Math.abs(npv - npvAlternative) < Math.max(1000, Math.abs(npvAlternative) * 0.02)
        ? "indiferente"
        : npv > npvAlternative
          ? "saf"
          : "alternativa",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Ambiental: reserva legal, déficit e passivo de recomposição
// ---------------------------------------------------------------------------

/** Percentual de reserva legal exigido por bioma (Código Florestal, Lei 12.651). */
export function requiredLegalReservePct(biome: AgroBiome, inLegalAmazon = true): number {
  if (biome === "amazonia") return inLegalAmazon ? 0.8 : 0.8; // floresta amazônica: 80%
  if (biome === "cerrado") return inLegalAmazon ? 0.35 : 0.2;
  return 0.2;
}

export type EnvironmentalAssessment = {
  totalHa: number;
  biome: AgroBiome;
  biomeLabel: string;
  requiredPct: number;
  requiredHa: number;
  declaredHa: number;
  appHa: number;
  /** Área que passa do exigido (excedente pode virar CRA). */
  surplusHa: number;
  deficitHa: number;
  reCompositionCost: number;
  carStatus: CarStatus | null;
  carNumber: string | null;
  /** % da propriedade em uso produtivo após descontar o exigido. */
  usablePct: number;
  warnings: string[];
};

export function assessEnvironment(
  env: AgroEnvironmentalLike,
  assumptions: AgroAssumptions = DEFAULT_AGRO_ASSUMPTIONS,
): EnvironmentalAssessment {
  const totalHa = Math.max(0, num(env.total_ha));
  const declaredHa = Math.max(0, num(env.legal_reserve_declared_ha));
  const appHa = Math.max(0, num(env.app_ha));
  const requiredPct = requiredLegalReservePct(env.biome, env.in_legal_amazon ?? true);
  const requiredHa = totalHa * requiredPct;
  const deficitHa = Math.max(0, requiredHa - declaredHa);
  const surplusHa = Math.max(0, declaredHa - requiredHa);
  const reCompositionCost = deficitHa * assumptions.replantingCostPerHa;
  const carStatus = env.car_status ?? null;

  const warnings: string[] = [];
  if (deficitHa > 0) {
    warnings.push(
      `Déficit de reserva legal de ${deficitHa.toFixed(1).replace(".", ",")} ha — recomposição estimada em R$ ${reCompositionCost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} (a R$ ${assumptions.replantingCostPerHa.toLocaleString("pt-BR")}/ha).`,
    );
  }
  if (carStatus === "sem_car" || carStatus === "irregular") {
    warnings.push(
      "CAR irregular ou ausente: trava crédito rural, seguro agrícola e venda para tradings que exigem regularidade.",
    );
  }
  if (surplusHa > 0) {
    warnings.push(
      `Excedente de ${surplusHa.toFixed(1).replace(".", ",")} ha de reserva legal — pode virar Cota de Reserva Ambiental (CRA) e gerar receita.`,
    );
  }
  if (appHa > 0 && appHa < totalHa * 0.05 && env.biome === "amazonia") {
    warnings.push(
      "APP declarada menor que 5% da propriedade em bioma amazônico: confira cursos d'água e nascentes no CAR.",
    );
  }

  return {
    totalHa,
    biome: env.biome,
    biomeLabel: BIOME_LABELS[env.biome] ?? env.biome,
    requiredPct: round2(requiredPct * 100),
    requiredHa: round2(requiredHa),
    declaredHa: round2(declaredHa),
    appHa: round2(appHa),
    surplusHa: round2(surplusHa),
    deficitHa: round2(deficitHa),
    reCompositionCost: round2(reCompositionCost),
    carStatus,
    carNumber: env.car_number ?? null,
    usablePct: totalHa > 0 ? round2(((totalHa - requiredHa - appHa) / totalHa) * 100) : 0,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Relatório consolidado da operação agrícola
// ---------------------------------------------------------------------------

export type AgroReport = {
  assumptions: AgroAssumptions;
  margins: MarginReport;
  stress: StressScenario[];
  leases: LeaseReport;
  barters: BarterAnalysis[];
  saf: SafAnalysis | null;
  environment: EnvironmentalAssessment[];
  kpis: {
    areaHa: number;
    revenue: number;
    margin: number;
    marginPerHa: number;
    costPerBag: number;
    landValue: number;
    rentIncome: number;
    barterOvercost: number;
    environmentalPassive: number;
  };
  warnings: string[];
};

export type AgroReportInput = {
  fields: AgroFieldLike[];
  leases?: AgroLeaseLike[];
  barters?: AgroBarterLike[];
  environments?: AgroEnvironmentalLike[];
  saf?: SafInput | null;
  prices?: Partial<Record<AgroCrop, number>>;
  assumptions?: AgroAssumptions;
};

export function buildAgroReport(input: AgroReportInput): AgroReport {
  const assumptions = input.assumptions ?? DEFAULT_AGRO_ASSUMPTIONS;
  const margins = computeMargins(input.fields, assumptions, input.prices ?? {});
  const stress = computeStress(margins);
  const leases = buildLeaseReport(
    input.leases ?? [],
    margins,
    assumptions,
    input.prices?.soja ?? assumptions.soyPricePerBag,
  );
  const barters = (input.barters ?? []).map((barter) => analyzeBarter(barter, assumptions));
  const saf = input.saf ? analyzeSaf(input.saf, assumptions) : null;
  const environment = (input.environments ?? []).map((env) => assessEnvironment(env, assumptions));

  const landValue = margins.totals.areaHa * assumptions.landValuePerHa;
  const warnings: string[] = [];

  // 1. margem perto do zero é o alerta que importa na lavoura
  if (margins.totals.revenue > 0) {
    const marginPct = (margins.totals.margin / margins.totals.revenue) * 100;
    if (marginPct < 10) {
      warnings.push(
        `Margem de ${marginPct.toFixed(1).replace(".", ",")}% da receita: qualquer alta de custo ou queda de preço leva a safra para o vermelho.`,
      );
    }
  }

  const worst = stress[0];
  if (worst && worst.margin < 0) {
    warnings.push(
      `No cenário "${worst.label}" a safra fecha em −R$ ${Math.abs(worst.margin).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}: é exposição que precisa de hedge ou seguro.`,
    );
  }

  const bartersCaros = barters.filter((barter) => barter.verdict === "banco_melhor");
  if (bartersCaros.length > 0) {
    warnings.push(
      `${bartersCaros.length} contrato(s) de barter acima da taxa do crédito agrícola — vale renegociar ou trocar por linha de custeio.`,
    );
  }

  const environmentalPassive = environment.reduce((sum, item) => sum + item.reCompositionCost, 0);
  if (environmentalPassive > 0) {
    warnings.push(
      `Passivo de recomposição ambiental de R$ ${environmentalPassive.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} — não está no balanço e é exigível.`,
    );
  }

  if (margins.totals.tradedAreaHa < margins.totals.areaHa) {
    warnings.push(
      `Há ${(margins.totals.areaHa - margins.totals.tradedAreaHa).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha sem margem de lavoura (pastagem/floresta): o R$/ha médio considera só ${margins.totals.tradedAreaHa.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha.`,
    );
  }

  const semPreco = margins.fields.filter((row) => !row.nonTraded && row.pricePerBag === 0);
  if (semPreco.length > 0) {
    warnings.push(
      `${semPreco.length} talhão(ões) sem preço de referência para a cultura (${Array.from(new Set(semPreco.map((row) => row.cropLabel))).join(", ")}): a receita aparece zerada até você informar o preço.`,
    );
  }

  return {
    assumptions,
    margins,
    stress,
    leases,
    barters,
    saf,
    environment,
    kpis: {
      areaHa: margins.totals.areaHa,
      revenue: margins.totals.revenue,
      margin: margins.totals.margin,
      marginPerHa: margins.totals.marginPerHa,
      costPerBag: margins.totals.costPerBag,
      landValue: round2(landValue),
      rentIncome: leases.totals.receivingRent,
      barterOvercost: round2(barters.reduce((sum, item) => sum + item.overcost, 0)),
      environmentalPassive: round2(environmentalPassive),
    },
    warnings,
  };
}
