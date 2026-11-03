/**
 * Layout do relatório mensal em PDF.
 *
 * Usa o escritor próprio (`./pdf-core`) — sem dependência externa, sem peso no
 * bundle e com stream de texto descomprimido: o PDF é pesquisável, selecionável
 * e verificável em teste.
 *
 * Regra de diagramação: cada bloco pede espaço antes de desenhar (`ensureSpace`),
 * porque título de seção órfão no pé da página é o defeito que o cliente nota.
 */

import type { MonthlyReport } from "./monthly";
import { brl, formatDate, pct, signedBrl, signedPct, signedPoints } from "./format";
import { PdfDocument, type Rgb } from "./pdf-core";

const INK: Rgb = [22, 28, 38];
const MUTED: Rgb = [110, 120, 136];
const ACCENT: Rgb = [16, 122, 87];
const DANGER: Rgb = [176, 42, 42];
const WARN: Rgb = [150, 96, 12];
const LINE: Rgb = [226, 230, 236];
const PAPER: Rgb = [247, 248, 250];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - MARGIN;

export function renderMonthlyPdfBytes(report: MonthlyReport): Uint8Array {
  const doc = new PdfDocument(PAGE_W, PAGE_H);
  let cursor = 0;

  const ensureSpace = (needed: number, at = cursor): number => {
    if (at + needed < FOOTER_Y - 16) return at;
    doc.addPage();
    cursor = MARGIN;
    return MARGIN;
  };

  // ----------------------------------------------------------- cabeçalho
  doc.rect(0, 0, PAGE_W, 74, { color: INK });
  doc.text("PATRIUM OS", MARGIN, 30, { size: 9, bold: true, color: [255, 255, 255] });
  doc.text("RELATÓRIO MENSAL DE PATRIMÔNIO", MARGIN, 44, { size: 7.5, color: [170, 180, 195] });
  doc.text(report.meta.label.toUpperCase(), PAGE_W - MARGIN, 30, {
    size: 11,
    bold: true,
    color: [255, 255, 255],
    align: "right",
  });
  doc.text(report.meta.entity, PAGE_W - MARGIN, 44, {
    size: 7.5,
    color: [170, 180, 195],
    align: "right",
  });

  cursor = 96;

  // ----------------------------------------------------------- manchete
  const headline = doc.wrap(report.narrative.headline, CONTENT_W, 13, true);
  doc.text(headline[0] ?? "", MARGIN, cursor, { size: 13, bold: true, color: INK });
  if (headline[1]) {
    doc.text(headline[1], MARGIN, cursor + 16, { size: 13, bold: true, color: INK });
  }
  cursor += headline.length * 16 + 8;

  doc.text(
    `Cliente: ${report.meta.client}   |   Competência: ${formatDate(report.meta.periodFrom)} a ${formatDate(report.meta.periodTo)}   |   Emitido em ${formatDate(report.meta.issuedAt)}`,
    MARGIN,
    cursor,
    { size: 8, color: MUTED },
  );
  cursor += 18;

  // ----------------------------------------------------------- cartões
  const cards: [string, string][] = [
    ["PATRIMÔNIO LÍQUIDO", brl(report.summary.netWorth)],
    ["RETORNO NO MÊS", signedPct(report.summary.monthReturnPct)],
    ["RETORNO NO ANO", signedPct(report.summary.ytdReturnPct)],
    ["DÍVIDA", brl(report.summary.debt)],
  ];
  const gap = 8;
  const cardW = (CONTENT_W - gap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardW + gap);
    doc.roundedRect(x, cursor, cardW, 44, 4, PAPER);
    doc.text(label, x + 8, cursor + 15, { size: 6.4, bold: true, color: MUTED });
    doc.text(value, x + 8, cursor + 33, { size: 11, bold: true, color: INK });
  });
  cursor += 62;

  // ----------------------------------------------------------- seções
  const section = (title: string): void => {
    cursor = ensureSpace(72, cursor);
    doc.text(title.toUpperCase(), MARGIN, cursor, { size: 9, bold: true, color: ACCENT });
    doc.line(MARGIN, cursor + 4, PAGE_W - MARGIN, cursor + 4, { color: ACCENT, width: 0.7 });
    cursor += 18;
  };

  const paragraph = (text: string, size = 8.6, color: Rgb = MUTED): void => {
    const lines = doc.wrap(text, CONTENT_W, size);
    cursor = ensureSpace(lines.length * 11 + 4, cursor);
    lines.forEach((line, index) => {
      doc.text(line, MARGIN, cursor + index * 11, { size, color });
    });
    cursor += lines.length * 11;
  };

  const keyValue = (rows: [string, string][]): void => {
    for (const [label, value] of rows) {
      cursor = ensureSpace(16, cursor);
      doc.text(label, MARGIN, cursor, { size: 8.4, color: MUTED });
      doc.text(value, PAGE_W - MARGIN, cursor, { size: 8.4, bold: true, color: INK, align: "right" });
      doc.line(MARGIN, cursor + 4, PAGE_W - MARGIN, cursor + 4, { color: LINE, width: 0.4 });
      cursor += 15;
    }
  };

  const table = (headers: string[], rows: string[][], widths: number[]): void => {
    cursor = ensureSpace(24, cursor);
    let x = MARGIN;
    headers.forEach((header, index) => {
      const width = CONTENT_W * widths[index];
      const align = index === 0 ? "left" : "right";
      doc.text(header.toUpperCase(), align === "left" ? x : x + width, cursor, {
        size: 7,
        bold: true,
        color: MUTED,
        align,
      });
      x += width;
    });
    cursor += 5;
    doc.line(MARGIN, cursor, PAGE_W - MARGIN, cursor, { color: LINE, width: 0.5 });
    cursor += 13;

    for (const row of rows) {
      cursor = ensureSpace(15, cursor);
      x = MARGIN;
      row.forEach((cell, index) => {
        const width = CONTENT_W * widths[index];
        const align = index === 0 ? "left" : "right";
        const negative = cell.trim().startsWith("-");
        const color = negative && index > 0 ? DANGER : INK;
        const maxWidth = width - (index === 0 ? 10 : 2);
        const line = doc.wrap(cell, maxWidth, 8.2, index > 0)[0] ?? cell;
        doc.text(line, align === "left" ? x : x + width, cursor, {
          size: 8.2,
          bold: index > 0,
          color,
          align,
        });
        x += width;
      });
      cursor += 13;
    }
  };

  // 1 ───────────────────────────────────────────────────────── evolução
  section("1. Evolução do patrimônio");
  const evolution = report.evolution;
  if (evolution.previousValue === null) {
    paragraph(
      `Primeiro fechamento da série: ${brl(evolution.currentValue)}. A partir do próximo mês o relatório compara mês a mês e separa aporte de retorno de mercado.`,
    );
  } else {
    keyValue([
      ["Fechamento anterior", `${brl(evolution.previousValue)} em ${formatDate(evolution.previousDate)}`],
      ["Fechamento atual", brl(evolution.currentValue)],
      [
        "Variação",
        `${signedBrl(evolution.change)}${evolution.changePct === null ? "" : ` (${signedPct(evolution.changePct)})`}`,
      ],
      ["Aportes líquidos", signedBrl(evolution.netFlow)],
      ["Retorno de mercado", signedBrl(evolution.marketGain)],
    ]);
  }
  cursor += 12;

  // 2 ─────────────────────────────────────────────────────── atribuição
  section("2. De onde veio o retorno");
  const monthAttr = report.attribution.month;
  table(
    ["Classe", "Peso", "Retorno no mês", "Contribuição"],
    monthAttr.byClass.map((bucket) => [
      bucket.label,
      pct(bucket.weight, 1),
      signedPct(bucket.returnPct),
      signedPoints(bucket.contribution),
    ]),
    [0.46, 0.16, 0.19, 0.19],
  );
  const best = monthAttr.best[0];
  const worst = monthAttr.worst[0];
  if (best && worst) {
    cursor += 6;
    paragraph(
      `Melhor contribuinte: ${best.name} (${signedPoints(best.contribution)}). ${
        worst.contribution < 0 ? "Pior" : "Menor contribuição"
      }: ${worst.name} (${signedPoints(worst.contribution)}). Cobertura de cotações: ${pct(monthAttr.totals.coverage, 0)} do patrimônio.`,
    );
  }
  cursor += 12;

  // 3 ────────────────────────────────────────────────────────── política
  section("3. Alocação vs política-alvo");
  table(
    ["Classe", "Atual", "Alvo", "Desvio", "Ação"],
    report.classes.map((row) => [
      row.label,
      pct(row.actual, 1),
      pct(row.target, 1),
      signedPoints(row.drift, 1),
      row.breach ? row.action : "manter",
    ]),
    [0.34, 0.15, 0.15, 0.18, 0.18],
  );
  cursor += 12;

  // 4 ─────────────────────────────────────────────────────────── balanço
  if (report.summary.debt > 0 || report.summary.registered > 0) {
    section("4. Balanço patrimonial");
    keyValue([
      ["Ativo financeiro", brl(report.summary.financial)],
      ["Ativos registrais", brl(report.summary.registered)],
      ["Passivo (dívida)", brl(report.summary.debt)],
      ["Patrimônio líquido", brl(report.summary.netWorth)],
      ["Alavancagem", pct(report.summary.leverage, 1)],
      ["Serviço da dívida", `${brl(report.summary.monthlyService)}/mês`],
    ]);
    cursor += 12;
  }

  // 5 ───────────────────────────────────────────────────────────── metas
  if (report.goals.items.length > 0) {
    section("5. Metas");
    table(
      ["Meta", "Alvo", "Alocado", "Progresso", "Aporte/mês"],
      report.goals.items.map((goal) => [
        goal.goal.name,
        brl(goal.target),
        brl(goal.allocated),
        pct(goal.progressPct, 0),
        brl(goal.requiredMonthly),
      ]),
      [0.3, 0.18, 0.18, 0.16, 0.18],
    );
    cursor += 12;
  }

  // 6 ──────────────────────────────────────────────────────── pendências
  section("6. Pendências e próximos passos");
  if (report.pendencies.length === 0) {
    paragraph("Nenhuma pendência aberta neste fechamento.");
  } else {
    for (const item of report.pendencies) {
      const lines = doc.wrap(item.text, CONTENT_W - 12, 8.2);
      cursor = ensureSpace(13 + lines.length * 10.5 + 7, cursor);
      const color = item.severity === "alta" ? DANGER : item.severity === "media" ? WARN : MUTED;
      doc.circle(MARGIN + 2.5, cursor - 2.5, 2.5, color);
      doc.text(`${item.area} · ${item.severity.toUpperCase()}`, MARGIN + 12, cursor, {
        size: 8.2,
        bold: true,
        color: INK,
      });
      cursor += 11;
      lines.forEach((line, index) => {
        doc.text(line, MARGIN + 12, cursor + index * 10.5, { size: 8.2, color: MUTED });
      });
      cursor += lines.length * 10.5 + 7;
    }
  }
  cursor += 6;

  // 7 ──────────────────────────────────────────────────────── comentário
  if (report.narrative.paragraphs.length > 0) {
    section("7. Comentário do gestor");
    for (const text of report.narrative.paragraphs) {
      paragraph(text);
      cursor += 5;
    }
  }

  // ------------------------------------------------------------- rodapé
  const total = doc.pageCount;
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y, { color: LINE, width: 0.4 });
    doc.text(
      "PATRIUM OS · documento gerado a partir dos dados do tenant · não substitui extrato oficial",
      MARGIN,
      FOOTER_Y + 12,
      { size: 7, color: MUTED },
    );
    doc.text(`${page}/${total}`, PAGE_W - MARGIN, FOOTER_Y + 12, {
      size: 7,
      color: MUTED,
      align: "right",
    });
  }

  return doc.toBytes();
}

/** Wrapper de conveniência: devolve um Blob pronto para download. */
export function renderMonthlyPdf(report: MonthlyReport): Blob {
  const bytes = renderMonthlyPdfBytes(report);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}
