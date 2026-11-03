import { describe, expect, it } from "bun:test";
import {
  DEFAULT_AGRO_ASSUMPTIONS,
  analyzeBarter,
  analyzeLease,
  analyzeSaf,
  assessEnvironment,
  buildAgroReport,
  buildLeaseReport,
  computeFieldMargin,
  computeMargins,
  computeNpv,
  computeStress,
  irr,
  requiredLegalReservePct,
  type AgroFieldLike,
} from "@/lib/agro/agro";

const field = (overrides: Partial<AgroFieldLike> = {}): AgroFieldLike => ({
  name: "Talhão 1",
  area_ha: 100,
  crop: "soja",
  productivity_sc_ha: 60,
  cost_per_ha: 7_000,
  ...overrides,
});

describe("margem por talhão", () => {
  it("receita = área × produtividade × preço da saca", () => {
    const row = computeFieldMargin(field());
    expect(row.revenue).toBe(100 * 60 * DEFAULT_AGRO_ASSUMPTIONS.soyPricePerBag);
    expect(row.cost).toBe(700_000);
    expect(row.margin).toBeCloseTo(row.revenue - row.cost, 2);
  });

  it("ponto de equilíbrio do preço é o custo por saca produzida", () => {
    const row = computeFieldMargin(field());
    expect(row.costPerBag).toBeCloseTo(700_000 / 6_000, 2);
    expect(row.breakEvenPrice).toBeCloseTo(row.costPerBag, 2);
  });

  it("ponto de equilíbrio da produtividade devolve sacas por hectare", () => {
    const row = computeFieldMargin(field({ productivity_sc_ha: 48, cost_per_ha: 7_100 }));
    expect(row.breakEvenProductivity).toBeCloseTo(7_100 / DEFAULT_AGRO_ASSUMPTIONS.soyPricePerBag, 1);
  });

  it("preço de referência pode ser substituído pelo chamador", () => {
    const base = computeFieldMargin(field());
    const cheaper = computeFieldMargin(field(), DEFAULT_AGRO_ASSUMPTIONS, { soja: 100 });
    expect(cheaper.revenue).toBeLessThan(base.revenue);
    // O ponto de equilíbrio do PREÇO é custo/saca e não muda com o preço de mercado;
    // quem muda é a produtividade mínima para não perder dinheiro.
    expect(cheaper.breakEvenPrice).toBeCloseTo(base.breakEvenPrice, 2);
    expect(cheaper.breakEvenProductivity).toBeGreaterThan(base.breakEvenProductivity);
  });

  it("produtividade e custo em falta caem no default da cultura", () => {
    const row = computeFieldMargin(field({ productivity_sc_ha: null, cost_per_ha: null }));
    expect(row.productivity).toBe(Number(DEFAULT_AGRO_ASSUMPTIONS.defaultYieldPerHa.soja));
    expect(row.costPerHa).toBe(Number(DEFAULT_AGRO_ASSUMPTIONS.defaultCostPerHa.soja));
  });

  it("pastagem não é tratada como lavoura com receita", () => {
    const row = computeFieldMargin(field({ crop: "pastagem", productivity_sc_ha: 0, cost_per_ha: 900 }));
    expect(row.nonTraded).toBe(true);
    expect(row.revenue).toBe(0);
    expect(row.margin).toBe(-90_000);
  });
});

describe("consolidado de margens", () => {
  const margins = computeMargins([
    field({ name: "T1", area_ha: 500, productivity_sc_ha: 62, cost_per_ha: 7_200 }),
    field({ name: "T2", area_ha: 300, crop: "milho_safrinha", productivity_sc_ha: 90, cost_per_ha: 4_300 }),
    field({ name: "Pasto", area_ha: 400, crop: "pastagem", productivity_sc_ha: 0, cost_per_ha: 900 }),
  ]);

  it("soma área total, inclusive pastagem", () => {
    expect(margins.totals.areaHa).toBe(1_200);
  });

  it("margem por hectare usa só a área de lavoura", () => {
    const tradedArea = 800;
    expect(margins.totals.marginPerHa).toBeCloseTo(margins.totals.margin / tradedArea, 2);
  });

  it("quebra por cultura e os percentuais de margem somam 100", () => {
    const share = margins.byCrop.reduce((sum, row) => sum + row.shareOfMargin, 0);
    expect(margins.byCrop.length).toBe(2);
    expect(share).toBeCloseTo(100, 0);
  });

  it("share de margem usa a soma dos módulos: safra no vermelho continua legível", () => {
    const negative = computeMargins([
      field({ name: "Bom", area_ha: 100, productivity_sc_ha: 62, cost_per_ha: 7_000 }),
      field({ name: "Ruim", area_ha: 100, crop: "milho", productivity_sc_ha: 30, cost_per_ha: 9_000 }),
    ]);
    const share = negative.byCrop.reduce((sum, row) => sum + row.shareOfMargin, 0);
    expect(share).toBeCloseTo(100, 0);
    expect(negative.byCrop.every((row) => row.shareOfMargin >= 0)).toBe(true);
    // a cultura no vermelho pesa no resultado, com sinal no valor da margem
    expect(negative.byCrop.find((row) => row.crop === "milho")?.margin).toBeLessThan(0);
  });

  it("área de lavoura é exposta separada da área total", () => {
    expect(margins.totals.tradedAreaHa).toBe(800);
    expect(margins.totals.areaHa).toBe(1_200);
  });

  it("custo por saca consolidado é custo total dividido por sacas totais", () => {
    const bags = 500 * 62 + 300 * 90;
    expect(margins.totals.bags).toBe(bags);
    expect(margins.totals.costPerBag).toBeCloseTo(margins.totals.cost / bags, 2);
  });
});

describe("preço por cultura", () => {
  it("algodão tem preço de referência em arroba — sem isso a receita viria zero", () => {
    const row = computeFieldMargin(
      field({ crop: "algodao", productivity_sc_ha: 268, cost_per_ha: 14_200, area_ha: 100 }),
    );
    expect(row.pricePerBag).toBe(Number(DEFAULT_AGRO_ASSUMPTIONS.defaultPricePerUnit.algodao));
    expect(row.revenue).toBeGreaterThan(0);
    expect(row.margin).toBeGreaterThan(0);
  });

  it("cultura sem preço no mapa devolve zero e o relatório avisa", () => {
    const semPreco = buildAgroReport({
      fields: [field({ crop: "cana", area_ha: 100 })],
      assumptions: { ...DEFAULT_AGRO_ASSUMPTIONS, defaultPricePerUnit: { cana: 0 } },
    });
    expect(semPreco.margins.fields[0].revenue).toBe(0);
    expect(semPreco.warnings.some((warning) => warning.includes("sem preço de referência"))).toBe(true);
  });
});

describe("stress da safra", () => {
  const margins = computeMargins([field({ area_ha: 1_000 })]);
  const stress = computeStress(margins);

  it("preço −20% derruba a receita na proporção exata", () => {
    const row = stress.find((item) => item.id === "preco_20")!;
    expect(row.revenue).toBeCloseTo(margins.totals.revenue * 0.8, 2);
    expect(row.cost).toBeCloseTo(margins.totals.cost, 2);
  });

  it("seca de 30% não reduz custo — é isso que dói", () => {
    const row = stress.find((item) => item.id === "seca_30")!;
    expect(row.revenue).toBeCloseTo(margins.totals.revenue * 0.7, 2);
    expect(row.cost).toBeCloseTo(margins.totals.cost, 2);
    expect(row.margin).toBeLessThan(margins.totals.margin);
  });

  it("ordena do pior para o melhor cenário", () => {
    const ordered = stress.map((row) => row.margin);
    expect([...ordered].sort((a, b) => a - b)).toEqual(ordered);
  });

  it("o cenário combinado é pior que cada choque isolado", () => {
    const combo = stress.find((item) => item.id === "seca_preco")!;
    const dry = stress.find((item) => item.id === "seca_30")!;
    expect(combo.margin).toBeLessThan(dry.margin);
  });
});

describe("arrendamento", () => {
  it("renda em dinheiro é área × R$/ha e o cap rate sai sobre o valor da terra", () => {
    const lease = analyzeLease({
      role: "arrendador",
      area_ha: 500,
      payment: "dinheiro",
      price_per_ha_year: 2_200,
    });
    expect(lease.annualRent).toBe(1_100_000);
    expect(lease.capRate).toBeCloseTo((1_100_000 / (500 * DEFAULT_AGRO_ASSUMPTIONS.landValuePerHa)) * 100, 2);
  });

  it("arrendamento em sacas converte pela cotação e devolve sacas por hectare", () => {
    const lease = analyzeLease({
      role: "arrendatario",
      area_ha: 400,
      payment: "sacas",
      bags_per_ha: 18,
    });
    expect(lease.annualRent).toBe(400 * 18 * DEFAULT_AGRO_ASSUMPTIONS.soyPricePerBag);
    expect(lease.bagsPerHa).toBeCloseTo(18, 2);
  });

  it("sacas acima do padrão de mercado geram aviso", () => {
    const lease = analyzeLease({ role: "arrendatario", area_ha: 100, payment: "sacas", bags_per_ha: 30 });
    expect(lease.warnings.some((warning) => warning.includes("acima do padrão"))).toBe(true);
  });

  it("parceria sem valor de produção avisa que a renda não fecha", () => {
    const lease = analyzeLease({
      role: "parceiro_outorgante",
      area_ha: 200,
      payment: "parceria",
      share_percent: 30,
    });
    expect(lease.annualRent).toBe(0);
    expect(lease.warnings.length).toBeGreaterThan(0);
  });

  it("valor implícito da terra usa o cap rate de referência", () => {
    const lease = analyzeLease({ role: "arrendador", area_ha: 100, payment: "dinheiro", price_per_ha_year: 1_800 });
    expect(lease.impliedLandValue).toBeCloseTo(180_000 / DEFAULT_AGRO_ASSUMPTIONS.leaseCapRate, 2);
  });

  it("compara produzir com arrendar e escolhe o maior retorno por hectare", () => {
    const margins = computeMargins([field({ area_ha: 1_000, cost_per_ha: 7_000 })]);
    const leases = buildLeaseReport(
      [{ role: "arrendador", area_ha: 1_000, payment: "dinheiro", price_per_ha_year: 500 }],
      margins,
    );
    expect(leases.produceVsLease?.verdict).toBe("produzir");
    expect(leases.totals.receivingRent).toBe(500_000);
  });

  it("renda alta inverte o veredito para arrendar", () => {
    const margins = computeMargins([field({ area_ha: 1_000, cost_per_ha: 7_800, productivity_sc_ha: 62 })]);
    const leases = buildLeaseReport(
      [{ role: "arrendador", area_ha: 1_000, payment: "dinheiro", price_per_ha_year: 9_000 }],
      margins,
    );
    expect(leases.produceVsLease?.verdict).toBe("arrendar");
  });

  it("separa o que recebe do que paga e soma a área de cada lado", () => {
    const leases = buildLeaseReport(
      [
        { role: "arrendador", area_ha: 300, payment: "dinheiro", price_per_ha_year: 2_000 },
        { role: "arrendatario", area_ha: 100, payment: "dinheiro", price_per_ha_year: 3_000 },
      ],
      null,
    );
    expect(leases.totals.receivingRent).toBe(600_000);
    expect(leases.totals.payingRent).toBe(300_000);
    expect(leases.totals.netRent).toBe(300_000);
    expect(leases.totals.areaOut).toBe(300);
    expect(leases.totals.areaIn).toBe(100);
  });
});

describe("barter", () => {
  const barter = {
    input_value: 1_000_000,
    bags_due: 10_000,
    bag_reference_price: 120,
    months_to_delivery: 12,
    area_ha: 1_000,
  };

  it("valor na entrega é sacas × preço travado", () => {
    const analysis = analyzeBarter(barter);
    expect(analysis.valueAtDelivery).toBe(1_200_000);
    expect(analysis.overcost).toBe(200_000);
    expect(analysis.overcostPct).toBe(20);
  });

  it("taxa implícita anualizada é a do sobrepreço no prazo", () => {
    const analysis = analyzeBarter(barter);
    expect(analysis.impliedRateAnnual).toBeCloseTo(20, 2);
  });

  it("prazo maior com o mesmo sobrepreço reduz a taxa anual", () => {
    const short = analyzeBarter(barter);
    const long = analyzeBarter({ ...barter, months_to_delivery: 18 });
    expect(long.impliedRateAnnual).toBeLessThan(short.impliedRateAnnual);
  });

  it("compara com o crédito e diz qual é melhor", () => {
    const caro = analyzeBarter(barter);
    expect(caro.verdict).toBe("banco_melhor");

    const barato = analyzeBarter({ ...barter, bag_reference_price: 104, bags_due: 10_000 });
    expect(barato.verdict).toBe("barter_melhor");
  });

  it("sacas por hectare e contrato incompleto", () => {
    expect(analyzeBarter(barter).bagsPerHa).toBe(10);
    const incomplete = analyzeBarter({ input_value: 0, bags_due: 0, bag_reference_price: 120 });
    expect(incomplete.warnings.some((warning) => warning.includes("incompleto"))).toBe(true);
  });

  it("preço travado muito abaixo da referência gera aviso de upside entregue", () => {
    const analysis = analyzeBarter({ ...barter, bag_reference_price: 100, bags_due: 10_000 });
    expect(analysis.warnings.some((warning) => warning.includes("upside"))).toBe(true);
  });
});

describe("SAF", () => {
  const saf = analyzeSaf({
    areaHa: 50,
    implementationCostPerHa: 12_000,
    maintenanceCostPerHaYear: 2_400,
    alternativeMarginPerHa: 2_000,
    discountRateAnnual: 0.1,
    horizonYears: 20,
    species: [
      { name: "Banana", firstHarvestYear: 2, yieldPerHa: 8_000, pricePerUnit: 2, rampYears: 2 },
      { name: "Mandioca", firstHarvestYear: 1, yieldPerHa: 12_000, pricePerUnit: 0.8, lastHarvestYear: 3 },
      { name: "Madeira", firstHarvestYear: 12, yieldPerHa: 350, pricePerUnit: 220, rampYears: 3 },
    ],
  });

  it("ano zero é só custo de implantação", () => {
    const year0 = saf.rows[0];
    expect(year0.revenue).toBe(0);
    expect(year0.cost).toBe(50 * 12_000);
    expect(year0.cashFlow).toBe(-600_000);
  });

  it("colheita anual aparece com rampa de produtividade", () => {
    const year2 = saf.rows[2];
    expect(year2.revenue).toBeGreaterThan(0);
    const year3 = saf.rows[3];
    expect(year3.revenue).toBeGreaterThan(year2.revenue);
  });

  it("ciclo declarado termina a colheita (mandioca sai do ano 4)", () => {
    const year4 = saf.rows[4];
    const year3 = saf.rows[3];
    expect(year4.revenue).toBeLessThan(year3.revenue);
  });

  it("VPL desconta o fluxo pela TMA", () => {
    const manual = computeNpv(
      saf.rows.map((row) => row.cashFlow),
      0.1,
    );
    expect(saf.npv).toBeCloseTo(manual, 2);
  });

  it("TIR é compatível com o VPL: descontar pela TIR zera o resultado", () => {
    const flows = saf.rows.map((row) => row.cashFlow);
    const exact = irr(flows);
    expect(exact).not.toBeNull();
    expect(Math.abs(computeNpv(flows, exact as number))).toBeLessThan(0.01);
    // a TIR publicada é arredondada para 2 casas em %
    expect(saf.irr).toBeCloseTo((exact as number) * 100, 1);
  });

  it("payback acontece depois da implantação e antes do horizonte", () => {
    expect(saf.paybackYear).not.toBeNull();
    expect(saf.paybackYear as number).toBeGreaterThan(0);
    expect(saf.paybackYear as number).toBeLessThanOrEqual(20);
  });

  it("sem payback no horizonte, o aviso aparece", () => {
    const inviavel = analyzeSaf({
      areaHa: 10,
      implementationCostPerHa: 400_000,
      maintenanceCostPerHaYear: 40_000,
      species: [{ name: "Madeira", firstHarvestYear: 18, yieldPerHa: 100, pricePerUnit: 100 }],
      horizonYears: 10,
    });
    expect(inviavel.paybackYear).toBeNull();
    expect(inviavel.warnings.some((warning) => warning.includes("Sem payback"))).toBe(true);
  });

  it("custo de oportunidade decide entre SAF e lavoura", () => {
    const lavouraMelhor = analyzeSaf({
      areaHa: 50,
      implementationCostPerHa: 12_000,
      maintenanceCostPerHaYear: 2_400,
      alternativeMarginPerHa: 200_000,
      species: [{ name: "Banana", firstHarvestYear: 2, yieldPerHa: 8_000, pricePerUnit: 2 }],
      horizonYears: 10,
    });
    expect(lavouraMelhor.verdict).toBe("alternativa");

    const safMelhor = analyzeSaf({
      areaHa: 50,
      implementationCostPerHa: 2_000,
      maintenanceCostPerHaYear: 500,
      alternativeMarginPerHa: 100,
      species: [{ name: "Banana", firstHarvestYear: 1, yieldPerHa: 8_000, pricePerUnit: 5 }],
      horizonYears: 10,
    });
    expect(safMelhor.verdict).toBe("saf");
  });

  it("cruzamento com a alternativa é reportado por ano", () => {
    expect(saf.crossoverYear).not.toBeNull();
  });

  it("TIR sem troca de sinal devolve null em vez de número inventado", () => {
    expect(irr([-100, -50, -20])).toBeNull();
  });
});

describe("ambiental", () => {
  it("reserva legal segue o bioma e a Amazônia Legal", () => {
    expect(requiredLegalReservePct("amazonia", true)).toBe(0.8);
    expect(requiredLegalReservePct("cerrado", true)).toBe(0.35);
    expect(requiredLegalReservePct("cerrado", false)).toBe(0.2);
    expect(requiredLegalReservePct("mata_atlantica", false)).toBe(0.2);
  });

  it("déficit de reserva legal vira passivo de recomposição", () => {
    const assessment = assessEnvironment({
      total_ha: 1_000,
      biome: "cerrado",
      in_legal_amazon: true,
      legal_reserve_declared_ha: 200,
      app_ha: 40,
      car_status: "ativo",
    });
    expect(assessment.requiredHa).toBe(350);
    expect(assessment.deficitHa).toBe(150);
    expect(assessment.reCompositionCost).toBe(150 * DEFAULT_AGRO_ASSUMPTIONS.replantingCostPerHa);
    expect(assessment.warnings.some((warning) => warning.includes("Déficit"))).toBe(true);
  });

  it("excedente é oportunidade de CRA, não passivo", () => {
    const assessment = assessEnvironment({
      total_ha: 1_000,
      biome: "cerrado",
      in_legal_amazon: false,
      legal_reserve_declared_ha: 500,
      car_status: "ativo",
    });
    expect(assessment.surplusHa).toBe(300);
    expect(assessment.deficitHa).toBe(0);
    expect(assessment.reCompositionCost).toBe(0);
    expect(assessment.warnings.some((warning) => warning.includes("CRA"))).toBe(true);
  });

  it("CAR irregular trava crédito e avisa", () => {
    const assessment = assessEnvironment({
      total_ha: 500,
      biome: "cerrado",
      in_legal_amazon: true,
      legal_reserve_declared_ha: 200,
      car_status: "irregular",
    });
    expect(assessment.warnings.some((warning) => warning.includes("crédito rural"))).toBe(true);
  });

  it("área utilizável desconta reserva legal e APP", () => {
    const assessment = assessEnvironment({
      total_ha: 1_000,
      biome: "amazonia",
      legal_reserve_declared_ha: 800,
      app_ha: 50,
      car_status: "ativo",
    });
    expect(assessment.usablePct).toBe(15);
  });
});

describe("relatório consolidado", () => {
  const report = buildAgroReport({
    fields: [
      { name: "T1", area_ha: 800, crop: "soja", productivity_sc_ha: 62, cost_per_ha: 7_200 },
      { name: "T2", area_ha: 400, crop: "milho_safrinha", productivity_sc_ha: 90, cost_per_ha: 4_300 },
    ],
    leases: [{ role: "arrendador", area_ha: 200, payment: "dinheiro", price_per_ha_year: 1_800 }],
    barters: [
      { input_value: 900_000, bags_due: 8_000, bag_reference_price: 118, months_to_delivery: 10 },
    ],
    environments: [
      { total_ha: 1_200, biome: "cerrado", in_legal_amazon: true, legal_reserve_declared_ha: 300, car_status: "pendente" },
    ],
  });

  it("KPIs consolidam área, receita, margem e valor da terra", () => {
    expect(report.kpis.areaHa).toBe(1_200);
    expect(report.kpis.landValue).toBe(1_200 * DEFAULT_AGRO_ASSUMPTIONS.landValuePerHa);
    expect(report.kpis.revenue).toBeGreaterThan(0);
    expect(report.kpis.margin).toBeLessThan(report.kpis.revenue);
  });

  it("renda de arrendamento e sobrepreço do barter entram nos KPIs", () => {
    expect(report.kpis.rentIncome).toBe(360_000);
    expect(report.kpis.barterOvercost).toBe(8_000 * 118 - 900_000);
  });

  it("passivo ambiental somado é o que falta recompor", () => {
    // 1.200 ha de cerrado na Amazônia Legal exigem 420 ha; declarados 300 -> 120 ha
    expect(report.kpis.environmentalPassive).toBe(120 * DEFAULT_AGRO_ASSUMPTIONS.replantingCostPerHa);
  });

  it("avisa quando o cenário ruim vira prejuízo", () => {
    const fragile = buildAgroReport({
      fields: [{ name: "T1", area_ha: 1_000, crop: "soja", productivity_sc_ha: 45, cost_per_ha: 7_200 }],
    });
    expect(fragile.stress[0].margin).toBeLessThan(0);
    expect(fragile.warnings.some((warning) => warning.includes("fecha em"))).toBe(true);
  });

  it("relatório sem talhão não quebra e não inventa número", () => {
    const empty = buildAgroReport({ fields: [] });
    expect(empty.kpis.areaHa).toBe(0);
    expect(empty.kpis.revenue).toBe(0);
    expect(empty.margins.byCrop.length).toBe(0);
    expect(empty.warnings.length).toBe(0);
  });

  it("SAF é opcional e não entra no relatório quando ausente", () => {
    expect(report.saf).toBeNull();
  });
});
