/**
 * PDF do portal do convidado.
 *
 * Reaproveita o escritor próprio (`./pdf-core`). A diferença em relação ao
 * relatório mensal é o ponto de partida: aqui o objeto já passou pela resolução
 * de permissão e pela redação — este arquivo **desenha**, não decide o que pode
 * ser visto. Se a seção não está na visão, não há o que desenhar.
 */

import { PdfDocument, type Rgb } from "./pdf-core";
import type { PortalView } from "@/lib/portal/snapshot";

const INK: Rgb = [22, 28, 38];
const MUTED: Rgb = [110, 120, 136];
const ACCENT: Rgb = [16, 122, 87];
const LINE: Rgb = [226, 230, 236];
const PAPER: Rgb = [247, 248, 250];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;

const dateBr = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export function renderPortalPdfBytes(view: PortalView): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument(PAGE_W, PAGE_H);
  let cursor = 0;

  const ensureSpace = (needed: number, at = cursor): number => {
    if (at + needed < PAGE_H - MARGIN - 16) return at;
    doc.addPage();
    cursor = MARGIN;
    return MARGIN;
  };

  const section = (title: string) => {
    cursor = ensureSpace(60, cursor);
    doc.text(title.toUpperCase(), MARGIN, cursor, { size: 9, bold: true, color: ACCENT });
    doc.line(MARGIN, cursor + 4, PAGE_W - MARGIN, cursor + 4, { color: ACCENT, width: 0.7 });
    cursor += 18;
  };

  const paragraph = (text: string, size = 8.6, color: Rgb = MUTED) => {
    const lines = doc.wrap(text, CONTENT_W, size);
    cursor = ensureSpace(lines.length * 11 + 4, cursor);
    lines.forEach((line, index) => doc.text(line, MARGIN, cursor + index * 11, { size, color }));
    cursor += lines.length * 11;
  };

  const row = (label: string, value: string, bold = false) => {
    cursor = ensureSpace(15, cursor);
    doc.text(label, MARGIN, cursor, { size: 8.4, color: MUTED });
    doc.text(value, PAGE_W - MARGIN, cursor, { size: 8.4, bold: true, color: bold ? INK : MUTED, align: "right" });
    doc.line(MARGIN, cursor + 4, PAGE_W - MARGIN, cursor + 4, { color: LINE, width: 0.4 });
    cursor += 14;
  };

  // ------------------------------------------------------------- cabeçalho
  doc.rect(0, 0, PAGE_W, 74, { color: INK });
  doc.text("PATRIUM OS", MARGIN, 30, { size: 9, bold: true, color: [255, 255, 255] });
  doc.text("PORTAL DO CLIENTE · POSIÇÃO CONSOLIDADA", MARGIN, 44, { size: 7.5, color: [170, 180, 195] });
  doc.text(view.meta.entityName.toUpperCase(), PAGE_W - MARGIN, 30, {
    size: 11,
    bold: true,
    color: [255, 255, 255],
    align: "right",
  });
  doc.text(`posição de ${dateBr(view.meta.asOf)}`, PAGE_W - MARGIN, 44, {
    size: 7.5,
    color: [170, 180, 195],
    align: "right",
  });

  cursor = 96;
  doc.text(view.meta.holderName, MARGIN, cursor, { size: 12, bold: true, color: INK });
  cursor += 14;
  doc.text(
    `Perfil de acesso: ${view.access.visibility === "completo" ? "valores exatos" : view.access.visibility === "resumido" ? "valores em milhões" : "valores em faixas"} · ${view.access.allowedSections.length} seção(ões) liberada(s)`,
    MARGIN,
    cursor,
    { size: 8, color: MUTED },
  );
  cursor += 22;

  // ----------------------------------------------------------------- cartões
  if (view.cards.length > 0) {
    const gap = 8;
    const width = (CONTENT_W - gap * (view.cards.length - 1)) / view.cards.length;
    view.cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      doc.roundedRect(x, cursor, width, 44, 4, PAPER);
      doc.text(card.label.toUpperCase(), x + 8, cursor + 15, { size: 6.4, bold: true, color: MUTED });
      doc.text(card.value, x + 8, cursor + 33, { size: 11, bold: true, color: INK });
    });
    cursor += 62;
  }

  if (view.classes.length > 0) {
    section("Alocação por classe");
    cursor = ensureSpace(18, cursor);
    doc.text("CLASSE", MARGIN, cursor, { size: 7, bold: true, color: MUTED });
    doc.text("PESO", PAGE_W - MARGIN, cursor, { size: 7, bold: true, color: MUTED, align: "right" });
    cursor += 12;
    for (const item of view.classes) {
      const value = item.amount ? `${item.percentage}  ·  ${item.amount}` : item.percentage;
      row(item.label, value);
    }
    cursor += 10;
  }

  if (view.contributions.length > 0) {
    section("Contribuição no mês");
    for (const item of view.contributions) row(item.label, item.contribution);
    cursor += 10;
  }

  if (view.goals.length > 0) {
    section("Metas");
    for (const goal of view.goals) {
      row(`${goal.name} — ${goal.progress}`, `${goal.requiredMonthly}/mês até ${goal.targetDate}`);
    }
    cursor += 10;
  }

  if (view.unavailable.length > 0) {
    section("Não disponível para este perfil");
    for (const item of view.unavailable) paragraph(`${item.label}: ${item.reason}`, 8.2);
    cursor += 6;
  }

  if (view.notes.length > 0) {
    section("Observações");
    for (const note of view.notes) {
      paragraph(`· ${note}`, 8.2);
      cursor += 3;
    }
  }

  // --------------------------------------------------------------- rodapé
  const total = doc.pageCount;
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.line(MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN, PAGE_H - MARGIN, { color: LINE, width: 0.4 });
    doc.text(
      "Documento de uso pessoal · gerado pelo PATRIUM OS a partir dos dados da família · não substitui extrato oficial",
      MARGIN,
      PAGE_H - MARGIN + 12,
      { size: 7, color: MUTED },
    );
    doc.text(`${page}/${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN + 12, { size: 7, color: MUTED, align: "right" });
  }

  return doc.toBytes();
}

export function renderPortalPdf(view: PortalView): Blob {
  const bytes = renderPortalPdfBytes(view);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type: "application/pdf" });
}
