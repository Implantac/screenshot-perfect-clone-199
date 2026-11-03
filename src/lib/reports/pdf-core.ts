/**
 * Escritor de PDF mínimo, sem dependência.
 *
 * Por que não usar uma biblioteca: `jspdf` são ~1 MB de JS que entram no bundle e
 * no build do servidor — o relatório precisa de **texto, linha, retângulo e
 * círculo em Helvetica base-14**, nada mais. Este arquivo gera exatamente esse
 * subconjunto, o que mantém o pacote pequeno, o build leve e o resultado testável
 * (o stream sai descomprimido, então o texto é pesquisável e assertável).
 *
 * Convenções: coordenadas em pontos (1/72"), **y medido a partir do topo** — o
 * chamador pensa como lê um documento; a inversão acontece aqui.
 */

export type Rgb = readonly [number, number, number];

export type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: Rgb;
  align?: "left" | "right" | "center";
};

/** Larguras do Helvetica (unidades/1000) — códigos 32..126. */
// prettier-ignore
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Larguras do Helvetica-Bold — mesmos códigos. */
// prettier-ignore
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Caracteres fora do Latin-1 que aparecem no relatório. */
const TRANSLITERATE: Record<string, string> = {
  "\u2014": "-",
  "\u2013": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201c": '"',
  "\u201d": '"',
  "\u2026": "...",
  "\u2212": "-",
  "\u00a0": " ",
  "\u202f": " ",
};

function widthOf(char: string, bold: boolean): number {
  const code = char.charCodeAt(0);
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  if (code >= 32 && code <= 126) return table[code - 32];
  // Acentos em Latin-1 medem como a letra-base (é ≈ e).
  const base = char
    .normalize("NFD")
    .charAt(0)
    .charCodeAt(0);
  if (base >= 32 && base <= 126) return table[base - 32];
  return bold ? 611 : 556;
}

/** Largura do texto em pontos. */
export function textWidth(text: string, size: number, bold = false): number {
  let units = 0;
  for (const char of text) units += widthOf(char, bold);
  return (units * size) / 1000;
}

/** Quebra de linha por largura disponível, respeitando palavras. */
export function wrapText(text: string, maxWidth: number, size: number, bold = false): string[] {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, bold) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** String PDF: escapa delimitadores e converte para WinAnsi (Latin-1). */
export function pdfString(text: string): string {
  let out = "";
  for (const raw of String(text)) {
    const char = TRANSLITERATE[raw] ?? raw;
    for (const inner of char) {
      const code = inner.codePointAt(0) ?? 32;
      const safe = code <= 255 ? inner : "?";
      if (safe === "(" || safe === ")" || safe === "\\") out += `\\${safe}`;
      else if (code < 32) out += " ";
      else out += safe;
    }
  }
  return out;
}

const n = (value: number) => (Math.round(value * 100) / 100).toString();

export class PdfDocument {
  readonly width: number;
  readonly height: number;
  private pages: string[][] = [];
  private current: string[] = [];

  constructor(width = 595.28, height = 841.89) {
    this.width = width;
    this.height = height;
    this.pages.push(this.current);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.current = [];
    this.pages.push(this.current);
  }

  /** Volta a uma página existente (1-based) — usado para desenhar rodapés. */
  setPage(page: number): void {
    const index = Math.max(0, Math.min(this.pages.length - 1, page - 1));
    this.current = this.pages[index];
  }

  measure(text: string, size: number, bold = false): number {
    return textWidth(text, size, bold);
  }

  wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
    return wrapText(text, maxWidth, size, bold);
  }

  /** Escreve uma linha de texto; devolve a largura ocupada. */
  text(text: string, x: number, y: number, options: TextOptions = {}): number {
    const size = options.size ?? 9;
    const bold = options.bold ?? false;
    const color = options.color ?? [0, 0, 0];
    const width = textWidth(text, size, bold);
    let anchor = x;
    if (options.align === "right") anchor = x - width;
    else if (options.align === "center") anchor = x - width / 2;
    this.current.push(
      `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} rg`,
      "BT",
      `/${bold ? "F2" : "F1"} ${n(size)} Tf`,
      `${n(anchor)} ${n(this.height - y)} Td`,
      `(${pdfString(text)}) Tj`,
      "ET",
    );
    return width;
  }

  line(x1: number, y1: number, x2: number, y2: number, options: { color?: Rgb; width?: number } = {}) {
    const color = options.color ?? [0, 0, 0];
    const width = options.width ?? 0.5;
    this.current.push(
      `${n(width)} w`,
      `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} RG`,
      `${n(x1)} ${n(this.height - y1)} m`,
      `${n(x2)} ${n(this.height - y2)} l`,
      "S",
    );
  }

  rect(x: number, y: number, w: number, h: number, options: { color?: Rgb } = {}) {
    const color = options.color ?? [0, 0, 0];
    this.current.push(
      `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} rg`,
      `${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re`,
      "f",
    );
  }

  roundedRect(x: number, y: number, w: number, h: number, radius: number, color: Rgb) {
    const r = Math.min(radius, h / 2, w / 2);
    const k = r * 0.5523;
    const bottom = this.height - y - h;
    const top = this.height - y;
    this.current.push(
      `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} rg`,
      `${n(x + r)} ${n(bottom)} m`,
      `${n(x + w - r)} ${n(bottom)} l`,
      `${n(x + w - r + k)} ${n(bottom)} ${n(x + w)} ${n(bottom + r - k)} ${n(x + w)} ${n(bottom + r)} c`,
      `${n(x + w)} ${n(top - r)} l`,
      `${n(x + w)} ${n(top - r + k)} ${n(x + w - r + k)} ${n(top)} ${n(x + w - r)} ${n(top)} c`,
      `${n(x + r)} ${n(top)} l`,
      `${n(x + r - k)} ${n(top)} ${n(x)} ${n(top - r + k)} ${n(x)} ${n(top - r)} c`,
      `${n(x)} ${n(bottom + r)} l`,
      `${n(x)} ${n(bottom + r - k)} ${n(x + r - k)} ${n(bottom)} ${n(x + r)} ${n(bottom)} c`,
      "f",
    );
  }

  circle(x: number, y: number, radius: number, color: Rgb) {
    const k = radius * 0.5523;
    const cy = this.height - y;
    this.current.push(
      `${n(color[0] / 255)} ${n(color[1] / 255)} ${n(color[2] / 255)} rg`,
      `${n(x + radius)} ${n(cy)} m`,
      `${n(x + radius)} ${n(cy + k)} ${n(x + k)} ${n(cy + radius)} ${n(x)} ${n(cy + radius)} c`,
      `${n(x - k)} ${n(cy + radius)} ${n(x - radius)} ${n(cy + k)} ${n(x - radius)} ${n(cy)} c`,
      `${n(x - radius)} ${n(cy - k)} ${n(x - k)} ${n(cy - radius)} ${n(x)} ${n(cy - radius)} c`,
      `${n(x + k)} ${n(cy - radius)} ${n(x + radius)} ${n(cy - k)} ${n(x + radius)} ${n(cy)} c`,
      "f",
    );
  }

  /** Bytes do arquivo PDF completo (com xref correto). */
  toBytes(): Uint8Array<ArrayBuffer> {
    const objects: string[] = [];
    const pageCount = this.pages.length;
    // 1 catálogo · 2 páginas · 3 Helvetica · 4 Helvetica-Bold · depois pares página/stream
    const pageIds = this.pages.map((_, index) => 5 + index * 2);

    objects.push(`<< /Type /Catalog /Pages 2 0 R >>`);
    objects.push(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    );
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
    objects.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

    this.pages.forEach((ops, index) => {
      const stream = ops.join("\n");
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
      );
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    let output = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => {
      offsets.push(output.length);
      output += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefStart = output.length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) output += `${String(offset).padStart(10, "0")} 00000 n \n`;
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    // Byte a byte: os offsets do xref são em bytes, não em caracteres.
    const bytes = new Uint8Array(new ArrayBuffer(output.length));
    for (let index = 0; index < output.length; index += 1) {
      bytes[index] = output.charCodeAt(index) & 0xff;
    }
    return bytes;
  }
}
