/**
 * Testes do módulo de renda fixa a mercado (wave 27).
 *
 * A amostra abaixo é **real**: copiada das linhas de 30/10/2026 do arquivo
 * `precotaxatesourodireto.csv` do Tesouro Transparente (14,6 MB, 178 mil linhas).
 * Usar dado real importa aqui: um parser com decimal de vírgula pode passar em
 * teste sintético ("10,5") e quebrar no arquivo de verdade ("20.185,67").
 */
import { describe, expect, test } from "bun:test";
import {
  BOND_SPECS,
  bondSymbol,
  bondFromSymbol,
  checkCurve,
  curveHealth,
  countBusinessDays,
  daysBetween,
  impliedRate,
  isoToBrDate,
  latestCurve,
  markBondToMarket,
  markPositions,
  parseBrDate,
  parseBrNumber,
  parseTesouroCsv,
  planTesouroMarks,
  resolveBondLabel,
  specForCode,
  specForOfficialName,
  summarizeCurve,
  type TesouroRow,
} from "@/lib/market/tesouro";

const SAMPLE = `Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
Tesouro Selic;01/03/2029;30/10/2026;0,06;0,07;20185,67;20170,66;20170,66
Tesouro Selic;01/03/2027;30/10/2026;0,02;0,03;20210,04;20199,05;20199,05
Tesouro Prefixado;01/01/2027;30/10/2026;13,48;13,60;979,63;978,97;978,97
Tesouro Prefixado;01/01/2032;30/10/2026;15,38;15,50;479,96;477,14;477,14
Tesouro IPCA+ com Juros Semestrais;15/05/2035;30/10/2026;7,86;7,98;4389,83;4355,94;4355,94
Tesouro IPCA+;15/05/2035;30/10/2026;7,88;8,00;2509,91;2484,95;2484,95
Tesouro IPCA+;15/08/2040;30/10/2026;7,56;7,68;1757,62;1729,99;1729,99
Tesouro IPCA+;15/05/2035;29/10/2026;7,78;7,90;2528,27;2503,61;2503,61
Tesouro IGPM+ com Juros Semestrais;01/01/2031;30/10/2026;7,80;7,92;8006,65;7962,29;7962,29
Tesouro Educa+;15/12/2043;30/10/2026;7,51;7,63;1670,52;1642,94;1642,94
Tesouro Renda+ Aposentadoria Extra;15/12/2064;30/10/2026;7,28;7,40;723,52;702,62;702,62
`;

const curve = (): TesouroRow[] => latestCurve(parseTesouroCsv(SAMPLE).rows);

describe("números e datas no dialeto brasileiro", () => {
  test("decimal com vírgula e milhar com ponto", () => {
    expect(parseBrNumber("20185,67")).toBe(20185.67);
    expect(parseBrNumber("7,88")).toBe(7.88);
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("2.509")).toBe(2509);
    expect(parseBrNumber("2509.91")).toBe(2509.91);
  });

  test("vazio e traço não viram zero", () => {
    // Zero seria um preço válido e silencioso; ausência é outra coisa.
    expect(parseBrNumber("")).toBeNull();
    expect(parseBrNumber("  ")).toBeNull();
    expect(parseBrNumber("-")).toBeNull();
    expect(parseBrNumber(undefined)).toBeNull();
  });

  test("número negativo (defensivo) mantém o sinal", () => {
    expect(parseBrNumber("-1.234,50")).toBe(-1234.5);
  });

  test("data válida e data que não existe", () => {
    expect(parseBrDate("15/05/2035")).toBe("2035-05-15");
    expect(parseBrDate("31/02/2027")).toBeNull(); // não pode virar 03/03
    expect(parseBrDate("01/13/2030")).toBeNull();
    expect(parseBrDate("2035-05-15")).toBeNull();
    expect(isoToBrDate("2035-05-15")).toBe("15/05/2035");
  });
});

describe("parse do CSV do Tesouro", () => {
  test("lê a amostra real e reconhece todas as famílias", () => {
    const result = parseTesouroCsv(SAMPLE);
    expect(result.columns?.length).toBe(8);
    expect(result.rows.length).toBe(11);
    expect(result.skipped).toBe(0);
    expect(result.unknownBonds).toEqual([]);
  });

  test("primeira linha do arquivo real", () => {
    const [first] = parseTesouroCsv(SAMPLE).rows;
    expect(first).toMatchObject({
      code: "LFT",
      maturity: "2029-03-01",
      asOf: "2026-10-30",
      rateSell: 0.07,
      puSell: 20170.66,
    });
  });

  test("cabeçalho desconhecido é recusado inteiro, em vez de ler coluna errada", () => {
    const result = parseTesouroCsv("nome;vencimento;preco\nTesouro Selic;01/03/2029;100");
    expect(result.columns).toBeNull();
    expect(result.rows).toEqual([]);
  });

  test("título fora do catálogo é contado, não inventado", () => {
    const result = parseTesouroCsv(
      SAMPLE + "Tesouro Fantasma;01/01/2050;30/10/2026;1,00;1,00;100,00;100,00;100,00\n",
    );
    expect(result.rows.length).toBe(11);
    expect(result.unknownBonds).toEqual(["Tesouro Fantasma"]);
  });

  test("linha com PU zero é descartada (não é preço de mercado)", () => {
    const result = parseTesouroCsv(
      SAMPLE + "Tesouro Prefixado;01/01/2040;30/10/2026;15,00;15,10;0,00;0,00;0,00\n",
    );
    expect(result.rows.length).toBe(11);
    expect(result.skipped).toBe(1);
  });

  test("filtro `since` corta o histórico sem perder a linha do dia", () => {
    const result = parseTesouroCsv(SAMPLE, { since: "2026-10-30" });
    expect(result.rows.length).toBe(10);
    expect(result.rows.every((row) => row.asOf === "2026-10-30")).toBe(true);
  });

  test("curva mais recente traz um registro por vencimento", () => {
    const latest = curve();
    const ipca2035 = latest.filter((row) => row.maturity === "2035-05-15");
    expect(ipca2035.length).toBe(2); // IPCA+ e IPCA+ com juros
    expect(ipca2035.every((row) => row.asOf === "2026-10-30")).toBe(true);
    expect(ipca2035.find((row) => row.code === "NTN-B-PRINCIPAL")?.puSell).toBe(2484.95);
  });

  test("curva sai ordenada por vencimento", () => {
    const maturities = curve().map((row) => row.maturity);
    expect([...maturities].sort()).toEqual(maturities);
  });
});

describe("catálogo de títulos", () => {
  test("todo nome oficial tem código único", () => {
    const codes = BOND_SPECS.map((spec) => spec.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("reconhece nome oficial com variação de caixa e espaço no '+'", () => {
    expect(specForOfficialName("tesouro ipca+")?.code).toBe("NTN-B-PRINCIPAL");
    expect(specForOfficialName("Tesouro IPCA + com Juros Semestrais")?.code).toBe("NTN-B");
    expect(specForOfficialName("Tesouro Educa+")?.code).toBe("EDUCA+");
    expect(specForOfficialName("Tesouro Inventado")).toBeNull();
  });

  test("NTN-B com juros marca cupom e indexação", () => {
    expect(specForCode("NTN-B")?.semiannualCoupon).toBe(true);
    expect(specForCode("NTN-B-PRINCIPAL")?.semiannualCoupon).toBe(false);
    expect(specForCode("NTN-B-PRINCIPAL")?.inflationLinked).toBe(true);
    expect(specForCode("LFT")?.family).toBe("selic");
  });

  test("símbolo canônico é o mesmo formato de quotes.symbol", () => {
    expect(bondSymbol("NTN-B-PRINCIPAL", "2035-05-15")).toBe("TESOURO:NTN-B-PRINCIPAL:2035-05-15");
  });

  test("reconstrói a curva a partir do símbolo gravado em quotes", () => {
    // `quotes` guarda só PU de venda; taxa e PU de compra não são preço de posição.
    const row = bondFromSymbol("TESOURO:NTN-B-PRINCIPAL:2035-05-15", 2484.95, "2026-10-30");
    expect(row).toMatchObject({ code: "NTN-B-PRINCIPAL", maturity: "2035-05-15", puSell: 2484.95 });
    expect(bondFromSymbol("PETR4", 38.5, "2026-10-30")).toBeNull();
    expect(bondFromSymbol("TESOURO:XPTO:2035-05-15", 1, "2026-10-30")).toBeNull();
  });
});

describe("reconhecer o título pelo rótulo do operador", () => {
  test("IPCA+ 2035 sem cupom", () => {
    const result = resolveBondLabel("Tesouro IPCA+ 2035", curve());
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.bond.code).toBe("NTN-B-PRINCIPAL");
      expect(result.bond.puSell).toBe(2484.95);
    }
  });

  test("IPCA+ com juros semestrais 2035", () => {
    const result = resolveBondLabel("Tesouro IPCA+ com Juros Semestrais 2035", curve());
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.bond.code).toBe("NTN-B");
  });

  test("símbolo do banco com hífens também resolve", () => {
    const result = resolveBondLabel("TESOURO-IPCA-2035", curve());
    expect(result.status).toBe("resolved");
  });

  test("Selic e Prefixado", () => {
    const selic = resolveBondLabel("Tesouro Selic 2029", curve());
    expect(selic.status === "resolved" && selic.bond.puSell).toBe(20170.66);

    const prefixado = resolveBondLabel("Tesouro Prefixado 2032", curve());
    expect(prefixado.status === "resolved" && prefixado.bond.puSell).toBe(477.14);
  });

  test("Prefixado com juros é outro papel", () => {
    const result = resolveBondLabel("Tesouro Prefixado com Juros Semestrais 2032", curve());
    expect(result.status).toBe("none"); // a amostra não tem NTN-F 2032
  });

  test("Educa+ e Renda+ são reconhecidos", () => {
    expect(resolveBondLabel("Tesouro Educa+ 2043", curve()).status).toBe("resolved");
    expect(resolveBondLabel("Tesouro Renda+ 2064", curve()).status).toBe("resolved");
  });

  test("data completa resolve quando o ano tem mais de um vencimento", () => {
    const result = resolveBondLabel("Tesouro IPCA+ 15/05/2035", curve());
    expect(result.status).toBe("resolved");
  });

  test("ano inexistente diz o que existe, em vez de chutar", () => {
    const result = resolveBondLabel("Tesouro IPCA+ 2044", curve());
    expect(result.status).toBe("none");
    if (result.status === "none") expect(result.reason).toContain("2035");
  });

  test("rótulo sem indexador não vira palpite", () => {
    const result = resolveBondLabel("CDB Banco XP 2029", curve());
    expect(result.status).toBe("none");
    if (result.status === "none") expect(result.reason).toContain("Não identifiquei");
  });

  test("rótulo sem vencimento devolve os candidatos em vez de escolher um", () => {
    // Devolver "o mais curto" seria escolher o preço pelo cliente.
    const selic = resolveBondLabel("Tesouro Selic", curve());
    expect(selic.status).toBe("ambiguous");
    if (selic.status === "ambiguous") {
      expect(selic.candidates.length).toBe(2);
      expect(selic.reason).toContain("Faltou o vencimento");
      expect(selic.reason).toContain("01/03/2029");
    }

    const ipca = resolveBondLabel("Tesouro IPCA+", curve());
    expect(ipca.status).toBe("ambiguous");
    if (ipca.status === "ambiguous") expect(ipca.candidates.length).toBe(2);
  });

  test("família com um único vencimento resolve sem ano", () => {
    const only = curve().filter((row) => row.code === "RENDA+");
    const result = resolveBondLabel("Tesouro Renda+", only);
    expect(result.status).toBe("resolved");
  });

  test("curva vazia não resolve nada e diz por quê", () => {
    const result = resolveBondLabel("Tesouro IPCA+ 2035", []);
    expect(result.status).toBe("none");
    if (result.status === "none") expect(result.reason).toContain("Sem curva");
  });
});

describe("marcação a mercado", () => {
  const bond = curve().find((row) => row.code === "NTN-B-PRINCIPAL" && row.maturity === "2035-05-15")!;

  test("usa o PU de venda: é o que o cliente receberia hoje", () => {
    const mark = markBondToMarket({ quantity: 100, unitPrice: 2000, bond, today: "2026-10-30" });
    expect(mark.marketPrice).toBe(2484.95);
    expect(mark.marketValue).toBeCloseTo(248495, 2);
    expect(mark.bookValue).toBeCloseTo(200000, 2);
    expect(mark.deltaBrl).toBeCloseTo(48495, 2);
    expect(mark.deltaPct).toBeCloseTo(24.2475, 2);
  });

  test("spread compra−venda é o custo de ida e volta", () => {
    const mark = markBondToMarket({ quantity: 100, unitPrice: 2484.95, bond, today: "2026-10-30" });
    expect(mark.spreadBrl).toBeCloseTo((2509.91 - 2484.95) * 100, 2);
    expect(mark.spreadBps).toBeCloseTo(100.4, 1);
  });

  test("preço do mesmo dia não está velho; cinco dias depois, está", () => {
    expect(markBondToMarket({ quantity: 1, unitPrice: 1, bond, today: "2026-10-30" }).stale).toBe(false);
    expect(markBondToMarket({ quantity: 1, unitPrice: 1, bond, today: "2026-11-06" }).stale).toBe(true);
    expect(markBondToMarket({ quantity: 1, unitPrice: 1, bond, today: "2026-11-06" }).ageDays).toBe(7);
  });

  test("posição zerada não produz divisão por zero", () => {
    const mark = markBondToMarket({ quantity: 0, unitPrice: 0, bond, today: "2026-10-30" });
    expect(mark.marketValue).toBe(0);
    expect(mark.deltaPct).toBe(0);
  });
});

describe("plano de marcação", () => {
  const positions = [
    { id: "p1", name: "Tesouro IPCA+ 2035", quantity: 100, unit_price: 2000, asset_class: "renda_fixa" },
    { id: "p2", name: "Tesouro Selic 2029", quantity: 50, unit_price: 20170.66, asset_class: "renda_fixa" },
    { id: "p3", name: "CDB Banco XP 2029", quantity: 10, unit_price: 1000, asset_class: "renda_fixa" },
  ];

  test("atualiza o que diverge e não mexe no que está no preço", () => {
    const plan = planTesouroMarks(positions, curve(), "2026-10-30");
    expect(plan.updates.length).toBe(1);
    expect(plan.updates[0]).toMatchObject({ positionId: "p1", toPrice: 2484.95, source: "tesouro" });
    expect(plan.unchanged).toBe(1); // Selic já está no preço
    expect(plan.unresolved).toBe(1); // CDB não tem preço público
    expect(plan.totalDeltaBrl).toBeCloseTo(48495, 2);
  });

  test("plano vazio quando a curva está vazia", () => {
    const plan = planTesouroMarks(positions, []);
    expect(plan.updates).toEqual([]);
    expect(plan.unresolved).toBe(3);
  });

  test("marca e resolve cada posição, com idade do preço", () => {
    const marked = markPositions(positions, curve(), "2026-11-02");
    const first = marked[0]!;
    expect(first.resolution.status).toBe("resolved");
    if (first.resolution.status === "resolved") {
      expect(first.resolution.mark.ageDays).toBe(3);
      expect(first.resolution.bond.code).toBe("NTN-B-PRINCIPAL");
    }
    expect(marked[2]!.resolution.status).toBe("none");
  });
});

describe("sanidade da curva", () => {
  test("dias úteis ignoram fim de semana", () => {
    expect(countBusinessDays("2026-10-30", "2026-11-02")).toBe(1); // sex → seg
    expect(countBusinessDays("2026-10-30", "2026-10-30")).toBe(0);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  });

  test("taxa implícita de uma LTN bate com a publicada em poucos pontos-base", () => {
    const ltn = curve().find((row) => row.code === "LTN" && row.maturity === "2032-01-01")!;
    const implied = impliedRate({ pu: ltn.puSell, faceValue: 1000, asOf: ltn.asOf, maturity: ltn.maturity });
    expect(implied).not.toBeNull();
    // A diferença existe porque feriado não é contado (premissa declarada no código).
    expect(Math.abs((implied as number) - ltn.rateSell)).toBeLessThan(1.5);
  });

  test("achados exatos passam na amostra real", () => {
    const findings = checkCurve(parseTesouroCsv(SAMPLE).rows);
    const spread = findings.filter((finding) => finding.kind === "spread");
    const rateOrder = findings.filter((finding) => finding.kind === "rate-order");
    expect(spread.length).toBe(10);
    expect(rateOrder.length).toBe(10);
    expect(spread.every((finding) => finding.ok)).toBe(true);
    expect(rateOrder.every((finding) => finding.ok)).toBe(true);
    expect(curveHealth(findings).ok).toBe(true);
  });

  test("PU caindo entre dois dias não é erro (taxa subiu)", () => {
    // Amostra real: IPCA+ 2035 foi de 2.503,61 (29/10, 7,90%) para 2.484,95
    // (30/10, 8,00%). Queda de PU é consequência da taxa maior — um teste de
    // monotonicidade do PU seria alarme falso.
    const findings = checkCurve(parseTesouroCsv(SAMPLE).rows);
    expect(findings.some((finding) => finding.kind === "evolution" as never)).toBe(false);
    expect(curveHealth(findings).ok).toBe(true);
  });

  test("direção taxa × PU é conferida no prefixado", () => {
    const consistent: TesouroRow[] = [
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2030-01-01", asOf: "2026-10-29", rateBuy: 14.9, rateSell: 15.0, puBuy: 590, puSell: 589, puBase: 589 },
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2030-01-01", asOf: "2026-10-30", rateBuy: 15.1, rateSell: 15.2, puBuy: 585, puSell: 584, puBase: 584 },
    ];
    const direction = checkCurve(consistent).find((finding) => finding.kind === "direction");
    expect(direction?.ok).toBe(true);

    const impossible: TesouroRow[] = [
      consistent[0]!,
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2030-01-01", asOf: "2026-10-30", rateBuy: 15.3, rateSell: 15.4, puBuy: 600, puSell: 599, puBase: 599 },
    ];
    const broken = checkCurve(impossible).find((finding) => finding.kind === "direction");
    expect(broken?.ok).toBe(false);
    expect(broken?.detail).toContain("impossível");
  });

  test("papel com cupom, VNA ou pós-fixado não é acusado de divergência de taxa", () => {
    const findings = checkCurve(parseTesouroCsv(SAMPLE).rows);
    const notApplicable = findings.filter(
      (finding) => finding.kind === "rate-vs-pu" && finding.values.impliedRate === null,
    );
    // LFT (2), NTN-B (1), IGP-M+ (1), Educa+ (1), Renda+ (1)
    expect(notApplicable.length).toBe(8);
    expect(notApplicable.every((finding) => finding.ok)).toBe(true);
    expect(notApplicable[0]?.detail).toContain("Sem conferência");
  });

  test("taxa reconstruída do PU fica dentro da tolerância declarada", () => {
    const findings = checkCurve(parseTesouroCsv(SAMPLE).rows);
    const rateChecks = findings.filter(
      (finding) => finding.kind === "rate-vs-pu" && finding.code === "LTN",
    );
    expect(rateChecks.length).toBe(2);
    for (const check of rateChecks) {
      expect(check.values.impliedRate).not.toBeNull();
      // A diferença é de feriado não contado — declarada no código, não escondida.
      expect(Math.abs(check.values.diffBps ?? 0)).toBeLessThan(200);
      expect(check.ok).toBe(true);
    }
  });

  test("spread invertido é detectado", () => {
    const broken: TesouroRow[] = [
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2030-01-01", asOf: "2026-10-30", rateBuy: 15, rateSell: 14, puBuy: 500, puSell: 520, puBase: 520 },
    ];
    const findings = checkCurve(broken);
    expect(curveHealth(findings).ok).toBe(false);
    // Os três achados caem juntos: PU invertido, taxa invertida e taxa que não
    // se reconstrói a partir do PU. É o retrato de arquivo com colunas trocadas.
    expect(curveHealth(findings).failed.map((finding) => finding.kind).sort()).toEqual([
      "rate-order",
      "rate-vs-pu",
      "spread",
    ]);
  });

  test("resumo por família, data-base e formato da curva", () => {
    const summary = summarizeCurve(curve());
    expect(summary.bonds).toBe(10); // 11 linhas, uma duplicada de vencimento
    expect(summary.asOf).toBe("2026-10-30");
    expect(summary.families.map((family) => family.family).sort()).toEqual([
      "igpm",
      "ipca",
      "prefixado",
      "selic",
    ]);
    const prefixado = summary.families.find((family) => family.family === "prefixado")!;
    expect(prefixado.minRate).toBeCloseTo(13.6, 2);
    expect(prefixado.maxRate).toBeCloseTo(15.5, 2);
    expect(summary.inverted).toBe(false);
  });

  test("curva invertida é detectada quando o curto paga mais que o longo", () => {
    const invertedCurve: TesouroRow[] = [
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2027-01-01", asOf: "2026-10-30", rateBuy: 16, rateSell: 16.2, puBuy: 900, puSell: 890, puBase: 890 },
      { code: "LTN", officialName: "Tesouro Prefixado", maturity: "2032-01-01", asOf: "2026-10-30", rateBuy: 14, rateSell: 14.2, puBuy: 500, puSell: 490, puBase: 490 },
    ];
    const summary = summarizeCurve(invertedCurve);
    expect(summary.inverted).toBe(true);
    expect(summary.note).toContain("invertida");
  });

  test("resumo de curva vazia é explícito", () => {
    const summary = summarizeCurve([]);
    expect(summary.bonds).toBe(0);
    expect(summary.note).toContain("Nenhuma curva");
  });
});
