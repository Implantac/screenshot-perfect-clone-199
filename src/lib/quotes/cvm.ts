/**
 * Cota de fundos pela CVM (Informe Diário — `inf_diario_fi_YYYYMM.zip`).
 *
 * Contexto de engenharia: o arquivo da CVM tem ~11 MB comprimido e **54 MB
 * descomprimido** (538 mil linhas, um mês). Carregar 54 MB de string num worker
 * é receita para estourar memória, então a leitura é em fluxo: inflate nativo em
 * pedaços, decodifica ISO-8859-1 incremental, quebra linha e **descarta tudo que
 * não seja dos CNPJs da carteira**. A memória fica próxima do tamanho do ZIP.
 *
 * Formato (2026): `TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;
 * VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST`, decimais com
 * ponto. Versões antigas usam `TP_FUNDO;CNPJ_FUNDO;…` — o parser lê o header.
 */
import { fundSymbol, normalizeCnpj, type Quote } from "./index";
import { listZipEntries, readCompressedBytes, readZipEntry } from "./zip";

export type CvmFundRow = {
  cnpj: string;
  date: string;
  /** Valor da cota do dia. */
  quota: number;
  /** Patrimônio líquido do fundo, quando presente. */
  netAssets?: number;
};

const SOURCE = "cvm" as const;

/** `2026-10-30` → `202609` (o arquivo é mensal). */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** URL do informe diário de um mês (`yyyyMM`). */
export function cvmInfDiarioUrl(month: string): string {
  return `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${month}.zip`;
}

/** Mês corrente e os anteriores (a CVM publica com defasagem de alguns dias). */
export function recentMonths(reference = new Date(), back = 2): string[] {
  const months: string[] = [];
  for (let offset = 0; offset <= back; offset += 1) {
    const date = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - offset, 1));
    months.push(monthKey(date));
  }
  return months;
}

/** Nome da entrada dentro do ZIP (`inf_diario_fi_202609.csv`). */
export function entryNameForMonth(month: string): string {
  return `inf_diario_fi_${month}.csv`;
}

/** Índices das colunas a partir do header — a CVM já renomeou campos antes. */
export function mapCvmHeader(header: string): { cnpj: number; date: number; quota: number; net: number } | null {
  const columns = header.split(";").map((column) => column.trim().toUpperCase());
  const find = (...names: string[]) => columns.findIndex((column) => names.includes(column));
  const cnpj = find("CNPJ_FUNDO_CLASSE", "CNPJ_FUNDO");
  const date = find("DT_COMPTC");
  const quota = find("VL_QUOTA");
  if (cnpj < 0 || date < 0 || quota < 0) return null;
  return { cnpj, date, quota, net: find("VL_PATRIM_LIQ") };
}

/** Converte `44.636723400000` (ou `44,6367`) em número. */
export function parseCvmNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = raw.trim().replace(/\./g, (match, offset, full) => {
    // Ponto como separador de milhar só existe em formato pt-BR com vírgula decimal.
    return full.includes(",") ? (match === "." ? "" : match) : match;
  });
  const normalized = value.includes(",") ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Uma linha do informe → registro. Devolve `null` para header, rodapé e lixo. */
export function parseCvmRow(line: string, map: ReturnType<typeof mapCvmHeader>): CvmFundRow | null {
  if (!map) return null;
  const fields = line.split(";");
  if (fields.length <= map.quota) return null;
  const cnpj = normalizeCnpj(fields[map.cnpj]);
  if (!cnpj) return null;
  const date = fields[map.date]?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const quota = parseCvmNumber(fields[map.quota] ?? "");
  if (quota === null || quota <= 0) return null;
  const netAssets = map.net >= 0 ? parseCvmNumber(fields[map.net] ?? "") ?? undefined : undefined;
  return { cnpj, date, quota, netAssets };
}

/**
 * Mantém apenas a cota mais recente de cada CNPJ pedido.
 * Um mês de informe traz ~21 cotas por fundo; interessa a última.
 */
export function createFundCollector(wanted: Set<string>) {
  const latest = new Map<string, CvmFundRow>();
  let headerSkipped = false;
  let map: ReturnType<typeof mapCvmHeader> = null;
  // Filtro barato: um bloco de 3 dígitos do CNPJ que fica contíguo nas duas
  // grafias ("12.345.678/0001-90" e "12345678000190"). É só um descarte
  // antecipado: a comparação correta continua sendo `wanted.has(row.cnpj)`.
  const needles = [...wanted].map((cnpj) => cnpj.slice(2, 5));

  return {
    push(line: string) {
      if (!headerSkipped) {
        headerSkipped = true;
        map = mapCvmHeader(line);
        return;
      }
      if (needles.length > 0 && !needles.some((needle) => line.includes(needle))) return;
      const row = parseCvmRow(line, map);
      if (!row || (wanted.size > 0 && !wanted.has(row.cnpj))) return;
      const current = latest.get(row.cnpj);
      if (!current || row.date >= current.date) latest.set(row.cnpj, row);
    },
    result(): CvmFundRow[] {
      return [...latest.values()].sort((a, b) => a.cnpj.localeCompare(b.cnpj));
    },
  };
}

export function rowsToQuotes(rows: CvmFundRow[]): Quote[] {
  return rows.map((row) => ({
    symbol: fundSymbol(row.cnpj),
    price: row.quota,
    currency: "BRL",
    asOf: row.date,
    source: SOURCE,
  }));
}

/** Versão de memória do coletor — usada nos testes e em arquivos pequenos. */
export function parseCvmInfDiario(csvText: string, wanted: Set<string>): CvmFundRow[] {
  const collector = createFundCollector(wanted);
  for (const line of csvText.split(/\r?\n/)) {
    if (line.length > 0) collector.push(line);
  }
  return collector.result();
}

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

/**
 * Baixa o informe do mês, abre o CSV dentro do ZIP e devolve a cota mais recente
 * de cada CNPJ pedido. Se o mês ainda não foi publicado (HTTP 404), tenta o anterior.
 */
export async function fetchCvmFundQuotes(
  cnpjs: string[],
  options: { months?: string[]; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<{ quotes: Quote[]; errors: { symbol: string; message: string }[]; month: string | null }> {
  const wanted = new Set(
    cnpjs.map((cnpj) => normalizeCnpj(cnpj)).filter((cnpj): cnpj is string => cnpj !== null),
  );
  if (wanted.size === 0) return { quotes: [], errors: [], month: null };

  const doFetch = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const months = options.months ?? recentMonths();
  const errors: { symbol: string; message: string }[] = [];

  for (const month of months) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
    try {
      const response = await doFetch(cvmInfDiarioUrl(month), { signal: controller.signal });
      if (response.status === 404) continue; // mês ainda não publicado
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = new Uint8Array(await response.arrayBuffer());
      const entries = listZipEntries(buffer);
      const entry = entries.find((candidate) => candidate.name === entryNameForMonth(month))
        ?? entries.find((candidate) => candidate.name.endsWith(".csv"));
      if (!entry) throw new Error("CSV do informe não encontrado no ZIP.");

      const rows = await collectFromZip(buffer, entry, wanted);
      if (rows.length === 0) {
        errors.push({
          symbol: "FUND",
          message: `Nenhuma cota encontrada para os CNPJs informados no informe de ${month}.`,
        });
        return { quotes: [], errors, month };
      }
      return { quotes: rowsToQuotes(rows), errors, month };
    } catch (error) {
      errors.push({
        symbol: "FUND",
        message: error instanceof Error ? error.message : "Falha ao baixar o informe da CVM.",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return { quotes: [], errors, month: null };
}

/** Inflate em fluxo + decode incremental: memória ~ ZIP, não ~ CSV. */
async function collectFromZip(
  buffer: Uint8Array,
  entry: { name: string; compression: number; compressedSize: number; uncompressedSize: number; headerOffset: number },
  wanted: Set<string>,
): Promise<CvmFundRow[]> {
  const collector = createFundCollector(wanted);

  // ZIP "store": nada a descomprimir.
  if (entry.compression === 0) {
    const bytes = await readZipEntry(buffer, entry);
    for (const line of new TextDecoder("iso-8859-1").decode(bytes).split(/\r?\n/)) {
      if (line) collector.push(line);
    }
    return collector.result();
  }

  const compressed = readCompressedBytes(buffer, entry);
  const stream = new Blob([compressed as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder("iso-8859-1");
  let remainder = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = remainder + decoder.decode(value, { stream: true });
    const lines = text.split(/\r?\n/);
    remainder = lines.pop() ?? "";
    for (const line of lines) if (line) collector.push(line);
  }
  if (remainder) collector.push(remainder);

  return collector.result();
}
