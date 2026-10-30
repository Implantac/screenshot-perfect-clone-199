/**
 * Parser de CSV de extrato bancário com as jabuticabas brasileiras:
 *
 *  - separador `;` (padrão do BR) ou `,`, detectado por contagem;
 *  - número no formato `1.234,56` (ponto de milhar, vírgula decimal);
 *  - data `dd/mm/aaaa`;
 *  - colunas com nomes diferentes por banco (Data, Data Lançamento, Histórico,
 *    Descrição, Lançamento, Valor, Débito, Crédito, Saldo…);
 *  - coluna única de valor **com sinal** ou duas colunas débito/crédito.
 *
 * Módulo puro e testável — nada de DOM.
 */

export type CsvTransaction = {
  date: string;
  amount: number;
  fitid: string | null;
  description: string;
  type: string | null;
};

export type CsvColumnMap = {
  date: number | null;
  description: number | null;
  /** Coluna única com valor assinado (Débito/Crédito juntos). */
  amount: number | null;
  debit: number | null;
  credit: number | null;
};

export type CsvParseResult = {
  delimiter: string;
  headers: string[];
  map: CsvColumnMap;
  transactions: CsvTransaction[];
  /** Linhas lidas do arquivo (antes de descartar cabeçalho/rodapé). */
  rowsRead: number;
  /** Linhas descartadas por não terem data/valor reconhecíveis. */
  rowsSkipped: number;
  /** Motivo do descarte, quando houver — para mostrar na tela. */
  warnings: string[];
};

const DATE_HEADERS = ["data", "data lancamento", "data do lancamento", "dt", "date", "data movimento"];
const DESC_HEADERS = ["historico", "descricao", "lancamento", "memo", "detalhe", "titulo", "estabelecimento"];
const AMOUNT_HEADERS = ["valor", "valor r$", "montante", "amount", "valor lancamento"];
const DEBIT_HEADERS = ["debito", "saidas", "saida", "débito"];
const CREDIT_HEADERS = ["credito", "entradas", "entrada", "crédito"];

/** Remove acentos e normaliza para comparar cabeçalhos. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/"/g, "")
    .trim();
}

/**
 * Escolhe o separador contando ocorrências fora de aspas nas primeiras linhas
 * úteis. Olhar só a primeira linha falha em extratos que começam com título
 * ("Extrato de conta corrente") antes do cabeçalho real.
 */
export function detectDelimiter(content: string): ";" | "," {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 12);

  let semicolons = 0;
  let commas = 0;
  for (const line of lines) {
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === ";") semicolons += 1;
      else if (!quoted && char === ",") commas += 1;
    }
  }
  return semicolons >= commas ? ";" : ",";
}

/** Split de CSV respeitando aspas (campo com `;` dentro de texto). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      out.push(current);
      current = "";
    } else current += char;
  }
  out.push(current);
  return out.map((cell) => cell.trim());
}

/** Converte número BR (`1.234,56`, `- 1.234,56`) ou US (`1,234.56`) em número. */
export function parseBrNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let value = String(raw).trim();
  if (!value) return null;

  const negativeByParens = /^\(.*\)$/.test(value);
  value = value.replace(/[()]/g, "").replace(/[R$\s]/gi, "").replace(/[^\d.,-]/g, "");
  if (!value || value === "-") return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // O separador decimal é o que aparece por último: 1.234,56 vs 1,234.56
    if (lastComma > lastDot) value = value.replace(/\./g, "").replace(",", ".");
    else value = value.replace(/,/g, "");
  } else if (lastComma > -1) {
    value = value.replace(",", ".");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negativeByParens ? -Math.abs(parsed) : parsed;
}

/** Converte `dd/mm/aaaa`, `aaaa-mm-dd` e `dd/mm/aa` em ISO. */
export function parseBrDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = String(raw).trim().split(/\s+/)[0];
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(value);
  if (!br) return null;
  const day = Number(br[1]);
  const month = Number(br[2]);
  let year = Number(br[3]);
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function findColumn(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map(normalize);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(candidate);
    if (exact > -1) return exact;
  }
  for (const candidate of candidates) {
    const partial = normalized.findIndex((header) => header.includes(candidate));
    if (partial > -1) return partial;
  }
  return null;
}

/** Detecta o mapa de colunas a partir do cabeçalho. */
export function detectColumns(headers: string[]): CsvColumnMap {
  return {
    date: findColumn(headers, DATE_HEADERS),
    description: findColumn(headers, DESC_HEADERS),
    amount: findColumn(headers, AMOUNT_HEADERS),
    debit: findColumn(headers, DEBIT_HEADERS),
    credit: findColumn(headers, CREDIT_HEADERS),
  };
}

export function parseCsv(content: string): CsvParseResult {
  const clean = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean);
  const lines = clean.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return {
      delimiter,
      headers: [],
      map: { date: null, description: null, amount: null, debit: null, credit: null },
      transactions: [],
      rowsRead: 0,
      rowsSkipped: 0,
      warnings: ["Arquivo vazio."],
    };
  }

  // Cabeçalho: primeira linha com pelo menos 2 células e uma data/conhecido.
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    if (cells.length >= 2 && detectColumns(cells).date !== null) {
      headerIndex = i;
      break;
    }
  }

  const headers = splitCsvLine(lines[headerIndex], delimiter);
  const map = detectColumns(headers);
  const transactions: CsvTransaction[] = [];
  const warnings: string[] = [];
  let rowsSkipped = 0;

  if (map.date === null) warnings.push("Não encontrei a coluna de data — ajuste o mapeamento manualmente.");
  if (map.amount === null && map.debit === null && map.credit === null)
    warnings.push("Não encontrei coluna de valor (Valor ou Débito/Crédito).");

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i], delimiter);
    const date = parseBrDate(map.date !== null ? cells[map.date] : null);
    if (!date) {
      rowsSkipped += 1;
      continue;
    }

    let amount: number | null = null;
    if (map.amount !== null) {
      amount = parseBrNumber(cells[map.amount]);
    }
    if (amount === null && (map.debit !== null || map.credit !== null)) {
      const debit = map.debit !== null ? parseBrNumber(cells[map.debit]) : null;
      const credit = map.credit !== null ? parseBrNumber(cells[map.credit]) : null;
      if (credit !== null && credit !== 0) amount = Math.abs(credit);
      else if (debit !== null && debit !== 0) amount = -Math.abs(debit);
    }

    if (amount === null || amount === 0) {
      rowsSkipped += 1;
      continue;
    }

    const description = map.description !== null ? (cells[map.description] ?? "").trim() : "";
    transactions.push({
      date,
      amount,
      fitid: null, // CSV não traz id do banco; a dedupe usa hash da linha.
      description: (description || `Lançamento ${date}`).slice(0, 180),
      type: null,
    });
  }

  return { delimiter, headers, map, transactions, rowsRead: lines.length - headerIndex - 1, rowsSkipped, warnings };
}
