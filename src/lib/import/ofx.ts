/**
 * Parser de OFX (Open Financial Exchange) — o formato que todo banco brasileiro
 * exporta. Cobre OFX 1.x (SGML, sem fechamento de tags) e OFX 2.x (XML).
 *
 * Módulo puro: recebe texto e devolve dados. Sem DOM, sem dependência externa,
 * para rodar igual no servidor e no teste.
 *
 * Referência do que extraímos de cada `<STMTTRN>`:
 *   DTPOSTED (data), TRNAMT (valor assinado), FITID (id único do banco),
 *   MEMO/NAME (descrição), TRNTYPE (tipo).
 */

export type OfxTransaction = {
  /** Data no formato ISO (YYYY-MM-DD). */
  date: string;
  /** Valor assinado: negativo = saída, positivo = entrada. */
  amount: number;
  /** Identificador único do banco — a base da deduplicação. */
  fitid: string | null;
  description: string;
  type: string | null;
};

export type OfxStatement = {
  bankId: string | null;
  accountId: string | null;
  currency: string | null;
  /** Data inicial/final informadas no arquivo (DTSTART/DTEND). */
  periodStart: string | null;
  periodEnd: string | null;
  transactions: OfxTransaction[];
  /** Avisos para a tela (ex.: arquivo sem FITID, blocos ignorados). */
  warnings: string[];
};

/** Converte data OFX (20261015, 20261015120000, 20261015[0:GMT]) em ISO. */
export function parseOfxDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/[[].*]$/, "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Extrai o valor de uma tag, funcionando nos dois dialetos:
 *  - SGML 1.x: `<MEMO>PIX RECEBIDO` (sem `</MEMO>`)
 *  - XML 2.x:  `<MEMO>PIX RECEBIDO</MEMO>`
 */
function tagValue(block: string, tag: string): string | null {
  const closed = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (closed) return decodeEntities(closed[1].trim());
  const open = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  if (open) return decodeEntities(open[1].trim());
  return null;
}

function numberValue(raw: string | null): number | null {
  if (!raw) return null;
  // OFX usa ponto decimal e pode trazer sinal; alguns bancos BR mandam vírgula.
  const normalized = raw.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function parseOfx(content: string): OfxStatement {
  const text = content.replace(/^\uFEFF/, "");

  const bankId = tagValue(text, "BANKID");
  const accountId = tagValue(text, "ACCTID");
  const currency = tagValue(text, "CURDEF");
  const periodStart = parseOfxDate(tagValue(text, "DTSTART"));
  const periodEnd = parseOfxDate(tagValue(text, "DTEND"));

  const transactions: OfxTransaction[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  const blockPattern = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi;

  for (const match of text.matchAll(blockPattern)) {
    const block = match[1];
    const amount = numberValue(tagValue(block, "TRNAMT"));
    const date = parseOfxDate(tagValue(block, "DTPOSTED") ?? tagValue(block, "DTUSER"));
    if (amount === null || date === null) {
      skipped += 1;
      continue;
    }

    const memo = tagValue(block, "MEMO");
    const name = tagValue(block, "NAME");
    const description = [name, memo].filter(Boolean).join(" — ") || "Lançamento importado";

    transactions.push({
      date,
      amount,
      fitid: tagValue(block, "FITID"),
      description: description.slice(0, 180),
      type: tagValue(block, "TRNTYPE"),
    });
  }

  if (skipped > 0) warnings.push(`${skipped} lançamento(s) sem data ou valor foram ignorados.`);
  if (transactions.length > 0 && transactions.every((transaction) => !transaction.fitid)) {
    warnings.push(
      "Este OFX não traz FITID — a deduplicação usa a impressão digital de data, valor e descrição.",
    );
  }
  if (transactions.length === 0) warnings.push("Nenhum lançamento encontrado no arquivo OFX.");

  return { bankId, accountId, currency, periodStart, periodEnd, transactions, warnings };
}

/** Detecta se o conteúdo é OFX (a maioria dos arquivos começa com `OFXHEADER`). */
export function looksLikeOfx(content: string): boolean {
  const head = content.slice(0, 2000).toUpperCase();
  return head.includes("OFXHEADER") || head.includes("<OFX>") || /<STMTTRN>/i.test(content);
}
