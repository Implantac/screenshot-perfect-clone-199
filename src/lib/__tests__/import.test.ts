/**
 * Testes da importação de extrato: parsers OFX/CSV, normalização e dedupe.
 * Os fixtures reproduzem o formato real de banco brasileiro (inclusive SGML sem
 * fechamento de tag, `1.234,56` e `dd/mm/aaaa`).
 */
import { describe, expect, test } from "bun:test";
import { looksLikeOfx, parseOfx, parseOfxDate } from "@/lib/import/ofx";
import { detectDelimiter, parseBrDate, parseBrNumber, parseCsv, splitCsvLine } from "@/lib/import/csv";
import {
  dedupeWithinFile,
  fingerprint,
  guessCategory,
  normalizeCsv,
  normalizeOfx,
  summarizeRows,
} from "@/lib/import/normalize";

// ------------------------------------------------------------------- OFX

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>0341
<ACCTID>12345-6
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001
<DTEND>20261031
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005
<TRNAMT>-1250.90
<FITID>202610050001
<MEMO>PAGAMENTO FORNECEDOR INSUMOS
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261010
<TRNAMT>48500.00
<FITID>202610100002
<NAME>FAZENDA SANTA FE
<MEMO>RECEBIMENTO ARRENDAMENTO
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

describe("parser OFX", () => {
  test("reconhece o arquivo pelo cabeçalho", () => {
    expect(looksLikeOfx(OFX_SGML)).toBe(true);
    expect(looksLikeOfx("data;valor\n01/10/2026;100")).toBe(false);
  });

  test("extrai metadados de conta e período", () => {
    const statement = parseOfx(OFX_SGML);
    expect(statement.bankId).toBe("0341");
    expect(statement.accountId).toBe("12345-6");
    expect(statement.currency).toBe("BRL");
    expect(statement.periodStart).toBe("2026-10-01");
    expect(statement.periodEnd).toBe("2026-10-31");
  });

  test("lê transações em SGML sem tag de fechamento", () => {
    const statement = parseOfx(OFX_SGML);
    expect(statement.transactions).toHaveLength(2);
    expect(statement.transactions[0]).toMatchObject({
      date: "2026-10-05",
      amount: -1250.9,
      fitid: "202610050001",
      description: "PAGAMENTO FORNECEDOR INSUMOS",
    });
    expect(statement.transactions[1].amount).toBe(48500);
    expect(statement.transactions[1].description).toContain("ARRENDAMENTO");
  });

  test("lê OFX 2.x em XML com tags fechadas", () => {
    const xml = `<OFX><CURDEF>BRL</CURDEF><BANKTRANLIST><STMTTRN>
      <TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261015120000[-3:BRT]</DTPOSTED>
      <TRNAMT>-99.90</TRNAMT><FITID>X1</FITID><MEMO>TARIFA PACOTE</MEMO>
    </STMTTRN></BANKTRANLIST></OFX>`;
    const statement = parseOfx(xml);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]).toMatchObject({ date: "2026-10-15", amount: -99.9, fitid: "X1" });
  });

  test("data OFX com fuso e hora é truncada para o dia", () => {
    expect(parseOfxDate("20261015120000[-3:BRT]")).toBe("2026-10-15");
    expect(parseOfxDate("20261015")).toBe("2026-10-15");
    expect(parseOfxDate("lixo")).toBeNull();
  });

  test("arquivo sem transação não quebra", () => {
    expect(parseOfx("<OFX><CURDEF>BRL</CURDEF></OFX>").transactions).toHaveLength(0);
  });
});

// ------------------------------------------------------------------- CSV

const CSV_SEMICOLON = `Data;Histórico;Valor
05/10/2026;PAGAMENTO FORNECEDOR;-1.250,90
10/10/2026;RECEBIMENTO ARRENDAMENTO;48.500,00
12/10/2026;TARIFA BANCARIA;-49,90`;

const CSV_DEBIT_CREDIT = `Data Lançamento,Descrição,Débito,Crédito
05/10/2026,PAGAMENTO FORNECEDOR,1250.90,
10/10/2026,RECEBIMENTO ARRENDAMENTO,,48500.00`;

describe("parser CSV", () => {
  test("detecta ponto e vírgula como separador no padrão BR", () => {
    expect(detectDelimiter(CSV_SEMICOLON)).toBe(";");
    expect(detectDelimiter(CSV_DEBIT_CREDIT)).toBe(",");
  });

  test("respeita campo entre aspas contendo o separador", () => {
    expect(splitCsvLine('01/10/2026;"PIX; recebido";100,00', ";")).toEqual([
      "01/10/2026",
      "PIX; recebido",
      "100,00",
    ]);
  });

  test("número brasileiro: milhar com ponto e decimal com vírgula", () => {
    expect(parseBrNumber("1.234,56")).toBe(1234.56);
    expect(parseBrNumber("-1.250,90")).toBe(-1250.9);
    expect(parseBrNumber("48.500,00")).toBe(48500);
    expect(parseBrNumber("R$ 12.345,67")).toBe(12345.67);
    expect(parseBrNumber("1,234.56")).toBe(1234.56);
    expect(parseBrNumber("(250,00)")).toBe(-250);
    expect(parseBrNumber("")).toBeNull();
  });

  test("data brasileira vira ISO, com ano de 2 dígitos", () => {
    expect(parseBrDate("05/10/2026")).toBe("2026-10-05");
    expect(parseBrDate("5/1/26")).toBe("2026-01-05");
    expect(parseBrDate("2026-10-05")).toBe("2026-10-05");
    expect(parseBrDate("05/10/2026 14:32")).toBe("2026-10-05");
    expect(parseBrDate("abacaxi")).toBeNull();
  });

  test("mapeia colunas do extrato brasileiro e respeita o sinal", () => {
    const result = parseCsv(CSV_SEMICOLON);
    expect(result.delimiter).toBe(";");
    expect(result.map).toMatchObject({ date: 0, description: 1, amount: 2 });
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({ date: "2026-10-05", amount: -1250.9 });
    expect(result.transactions[1].amount).toBe(48500);
    expect(result.rowsSkipped).toBe(0);
  });

  test("funciona com colunas separadas de débito e crédito", () => {
    const result = parseCsv(CSV_DEBIT_CREDIT);
    expect(result.map.debit).toBe(2);
    expect(result.map.credit).toBe(3);
    expect(result.transactions[0].amount).toBe(-1250.9);
    expect(result.transactions[1].amount).toBe(48500);
  });

  test("ignora linhas de saldo/rodapé sem data", () => {
    const withFooter = `${CSV_SEMICOLON}\n;SALDO FINAL;12.345,67\n\n`;
    const result = parseCsv(withFooter);
    expect(result.transactions).toHaveLength(3);
    expect(result.rowsSkipped).toBe(1);
  });

  test("cabeçalho precedido de linhas de propaganda é encontrado", () => {
    const noisy = `Extrato de conta corrente\nGerado em 31/10/2026\n${CSV_SEMICOLON}`;
    const result = parseCsv(noisy);
    expect(result.transactions).toHaveLength(3);
  });

  test("CSV vazio devolve aviso em vez de exceção", () => {
    const result = parseCsv("   \n");
    expect(result.transactions).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------- normalização e dedupe

describe("normalização", () => {
  test("OFX: sinal define receita/despesa e FITID vira external_id", () => {
    const rows = normalizeOfx(parseOfx(OFX_SGML).transactions);
    expect(rows[0]).toMatchObject({ type: "expense", amount: 1250.9, external_id: "ofx:202610050001" });
    expect(rows[1]).toMatchObject({ type: "income", amount: 48500 });
  });

  test("CSV sem FITID usa hash estável (mesmo arquivo, mesmas chaves)", () => {
    const first = normalizeCsv(parseCsv(CSV_SEMICOLON).transactions);
    const second = normalizeCsv(parseCsv(CSV_SEMICOLON).transactions);
    expect(first.map((r) => r.external_id)).toEqual(second.map((r) => r.external_id));
    expect(first[0].external_id.startsWith("hash:")).toBe(true);
  });

  test("hash muda quando o valor muda (não engole lançamento legítimo)", () => {
    const a = fingerprint(["2026-10-05", "-1250.90", "pagamento fornecedor"]);
    const b = fingerprint(["2026-10-05", "-1251.90", "pagamento fornecedor"]);
    expect(a).not.toBe(b);
  });

  test("categorização reconhece tributos, folha, investimentos e transferências", () => {
    expect(guessCategory("DARF IRPF 0921", "expense")).toBe("Tributos");
    expect(guessCategory("PAGAMENTO FOLHA INSS", "expense")).toBe("Folha de pagamento");
    expect(guessCategory("APLICACAO CDB XP", "expense")).toBe("Investimentos");
    expect(guessCategory("PIX RECEBIDO JOAO", "income")).toBe("Transferências");
    expect(guessCategory("RECEBIMENTO ARRENDAMENTO", "income")).toBe("Receita operacional");
    expect(guessCategory("COISA ESTRANHA", "expense")).toBe("Outras despesas");
  });

  test("dedupe dentro do arquivo remove FITID repetido", () => {
    const rows = normalizeOfx([
      { date: "2026-10-05", amount: -100, fitid: "ABC", description: "X", type: "DEBIT" },
      { date: "2026-10-05", amount: -100, fitid: "ABC", description: "X", type: "DEBIT" },
      { date: "2026-10-06", amount: -100, fitid: "DEF", description: "Y", type: "DEBIT" },
    ]);
    const result = dedupeWithinFile(rows);
    expect(result.rows).toHaveLength(2);
    expect(result.removed).toBe(1);
  });

  test("resumo do preview separa novas de duplicadas contra o banco", () => {
    const rows = normalizeCsv(parseCsv(CSV_SEMICOLON).transactions);
    const existing = new Set([rows[0].external_id]);
    const summary = summarizeRows(rows, existing);
    expect(summary.rowsTotal).toBe(3);
    expect(summary.rowsImported).toBe(2);
    expect(summary.rowsDuplicated).toBe(1);
    // O período do lote reflete o que foi efetivamente importado: a linha de
    // 05/10 é a duplicada, então o intervalo começa em 10/10.
    expect(summary.periodStart).toBe("2026-10-10");
    expect(summary.periodEnd).toBe("2026-10-12");
  });

  test("avisa quando o OFX não traz FITID (dedupe cai no hash)", () => {
    const sgml = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261015<TRNAMT>-250.00<NAME>COMPRA CARTAO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    const statement = parseOfx(sgml);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.warnings.join(" ")).toContain("não traz FITID");
    expect(normalizeOfx(statement.transactions)[0].external_id.startsWith("hash:")).toBe(true);
  });

  test("avisa quando blocos do OFX são ignorados por falta de data ou valor", () => {
    const sgml = `<OFX><STMTTRN><TRNTYPE>DEBIT<TRNAMT>-10.00<NAME>SEM DATA</STMTTRN></OFX>`;
    const statement = parseOfx(sgml);
    expect(statement.transactions).toHaveLength(0);
    expect(statement.warnings.join(" ")).toMatch(/ignorados/);
  });
});
