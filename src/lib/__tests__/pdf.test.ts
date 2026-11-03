import { describe, expect, test } from "bun:test";
import { PdfDocument, pdfString, textWidth, wrapText } from "@/lib/reports/pdf-core";
import { buildMonthlyReport } from "@/lib/reports/monthly";
import { renderMonthlyPdf, renderMonthlyPdfBytes } from "@/lib/reports/pdf";

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

const model = buildMonthlyReport({
  competencia: "2026-10",
  issuedAt: "2026-11-01",
  clientName: "Família Almeida",
  entityName: "Holding Almeida",
  positions: [
    {
      id: "p1",
      name: "Petrobras PN",
      symbol: "PETR4",
      asset_class: "renda_variavel",
      currency: "BRL",
      quantity: 30_000,
      unit_price: 55,
      cost_basis: 1_020_000,
    },
    {
      id: "p2",
      name: "Tesouro IPCA+ 2035",
      asset_class: "renda_fixa",
      currency: "BRL",
      quantity: 1_500,
      unit_price: 3_180,
      cost_basis: 4_500_000,
    },
  ],
  quotes: [
    { symbol: "PETR4", asOf: "2026-10-01", price: 52 },
    { symbol: "PETR4", asOf: "2026-10-31", price: 55 },
  ],
  snapshots: [{ as_of: "2026-09-30", market_value: 9_020_000 }],
  liabilities: [
    {
      id: "l1",
      name: "Nota comercial",
      kind: "comercial",
      outstanding: 2_400_000,
      rate_annual: 14,
      amortization: "bullet",
      term_months: 24,
      due_date: "2028-10-31",
    },
  ],
  registeredAssets: [{ current_value: 60_400_000 }],
  goals: [
    {
      id: "g1",
      name: "Reserva de liquidez",
      kind: "liquidez",
      target_amount: 3_000_000,
      allocated: 1_200_000,
      target_date: "2028-12-31",
      priority: 1,
      expected_return: 10,
    },
  ],
  today: "2026-10-31",
});

describe("núcleo do PDF", () => {
  test("largura do texto acompanha a fonte (bold é mais largo)", () => {
    const regular = textWidth("Patrimônio líquido", 10);
    expect(regular).toBeGreaterThan(70);
    expect(textWidth("Patrimônio líquido", 10, true)).toBeGreaterThan(regular);
    // acento mede como a letra-base
    expect(textWidth("a", 10)).toBeCloseTo(textWidth("ã", 10), 5);
  });

  test("quebra de linha respeita a largura e não perde palavra", () => {
    const text =
      "O patrimônio financeiro foi de R$ 7.400.000 em 30/09/2026 para R$ 7.536.400, variação de R$ 136.400.";
    const lines = wrapText(text, 200, 8.6);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(textWidth(line, 8.6)).toBeLessThanOrEqual(200.5);
    expect(lines.join(" ")).toBe(text);
  });

  test("palavra maior que a coluna não entra em loop", () => {
    const lines = wrapText("Supercalifragilisticexpialidocious", 40, 9);
    expect(lines.length).toBe(1);
  });

  test("escapa parênteses, barra invertida e translitera o que o WinAnsi não tem", () => {
    expect(pdfString("Total (R$) \\ parcial")).toBe("Total \\(R$\\) \\\\ parcial");
    expect(pdfString("a — b")).toBe("a - b");
    expect(pdfString("a → b")).toBe("a ? b");
  });

  test("documento tem catálogo, páginas, fontes e xref consistente", () => {
    const doc = new PdfDocument(595.28, 841.89);
    doc.text("Primeira página", 44, 40, { size: 10 });
    doc.addPage();
    doc.text("Segunda página", 44, 40, { size: 10 });
    const raw = latin1(doc.toBytes());

    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(raw).toContain("/Type /Catalog");
    expect(raw).toContain("/Type /Pages");
    expect(raw).toContain("/BaseFont /Helvetica-Bold");
    expect(raw).toContain("/Count 2");
    expect(raw).toContain("Primeira página");
    expect(raw).toContain("/Root 1 0 R");

    // o xref aponta para o byte certo de cada objeto
    const xrefAt = raw.indexOf("xref\n");
    const xrefBlock = raw.slice(xrefAt, raw.indexOf("trailer"));
    const header = xrefBlock.split("\n")[1].split(" ");
    const declared = Number(header[1]);
    const entries = xrefBlock.split("\n").filter((line) => line.endsWith("n ") || line.endsWith(" n"));
    // 4 objetos fixos + 2 por página
    expect(declared).toBe(4 + 2 * 2 + 1);
    expect(entries.length).toBe(declared - 1);
    for (const entry of entries) {
      const offset = Number(entry.slice(0, 10));
      expect(raw.slice(offset, offset + 4)).toMatch(/^\d+ 0/);
    }
  });

  test("rótulo é desenhado na página certa depois do setPage", () => {
    const doc = new PdfDocument();
    doc.text("corpo", 44, 40);
    doc.addPage();
    doc.text("corpo2", 44, 40);
    doc.setPage(1);
    doc.text("rodape-pagina-1", 44, 800);
    const raw = latin1(doc.toBytes());
    const firstStream = raw.slice(raw.indexOf("stream"), raw.indexOf("endstream"));
    expect(firstStream).toContain("rodape-pagina-1");
  });
});

describe("relatório em PDF", () => {
  test("gera arquivo válido com as seções do documento", () => {
    const bytes = renderMonthlyPdfBytes(model);
    const raw = latin1(bytes);

    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(bytes.length).toBeGreaterThan(4000);
    expect(raw).toContain("RELATÓRIO MENSAL DE PATRIMÔNIO");
    expect(raw).toContain("1. EVOLUÇÃO DO PATRIMÔNIO");
    expect(raw).toContain("2. DE ONDE VEIO O RETORNO");
    expect(raw).toContain("3. ALOCAÇÃO VS POLÍTICA-ALVO");
    expect(raw).toContain("4. BALANÇO PATRIMONIAL");
    expect(raw).toContain("5. METAS");
    expect(raw).toContain("6. PENDÊNCIAS E PRÓXIMOS PASSOS");
    expect(raw).toContain("7. COMENTÁRIO DO GESTOR");
  });

  test("traz os números do fechamento, não só rótulos", () => {
    const raw = latin1(renderMonthlyPdfBytes(model));
    expect(raw).toContain("R$ 64.420.000"); // patrimônio líquido do cenário
    expect(raw).toContain("OUTUBRO DE 2026");
    expect(raw).toContain("Holding Almeida");
    expect(raw).toContain("Família Almeida");
    expect(raw).toContain("/2"); // paginação "1/2" ou "2/2"
  });

  test("rodapé aparece em todas as páginas", () => {
    const bytes = renderMonthlyPdfBytes(model);
    const raw = latin1(bytes);
    const footer = "não substitui extrato oficial";
    const count = raw.split(footer).length - 1;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("Blob tem o mime correto e o mesmo tamanho dos bytes", () => {
    const bytes = renderMonthlyPdfBytes(model);
    const blob = renderMonthlyPdf(model);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBe(bytes.length);
  });

  test("relatório sem carteira e sem dívida ainda gera PDF de uma página", () => {
    const vazio = buildMonthlyReport({ competencia: "2026-10", positions: [], issuedAt: "2026-11-01" });
    const raw = latin1(renderMonthlyPdfBytes(vazio));
    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw).toContain("6. PENDÊNCIAS E PRÓXIMOS PASSOS");
    // sem dívida e sem ativo registral, a seção de balanço não é impressa
    expect(raw).not.toContain("4. BALANÇO PATRIMONIAL");
    expect(raw).toContain("(1/1)");
  });
});
