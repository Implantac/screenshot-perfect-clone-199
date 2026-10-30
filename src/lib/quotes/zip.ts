/**
 * Leitor mínimo de ZIP (só o necessário para os arquivos da CVM).
 *
 * Por que não uma dependência: o único uso é abrir `inf_diario_fi_YYYYMM.zip`
 * (um CSV dentro de um ZIP, ~12 MB comprimido). Uma lib de ZIP completa traz 300
 * kB e superfície de ataque para resolver um caso de 80 linhas.
 *
 * Suporta os dois métodos que a CVM usa: `store` (0) e `deflate` (8). O inflate
 * vem do `DecompressionStream("deflate-raw")`, nativo em Node 20+, Bun e Workers.
 */

export type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Offset do header local dentro do buffer. */
  headerOffset: number;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Lista as entradas pela central directory (fonte de verdade do ZIP). */
export function listZipEntries(buffer: Uint8Array): ZipEntry[] {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // O EOCD fica no fim, depois de um comentário de tamanho variável (até 64 kB).
  let eocd = -1;
  const floor = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= floor; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP inválido: diretório central não encontrado.");

  const total = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < total; index += 1) {
    if (view.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break;
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const name = new TextDecoder("utf-8").decode(
      buffer.subarray(pointer + 46, pointer + 46 + nameLength),
    );
    entries.push({
      name,
      compression: view.getUint16(pointer + 10, true),
      compressedSize: view.getUint32(pointer + 20, true),
      uncompressedSize: view.getUint32(pointer + 24, true),
      headerOffset: view.getUint32(pointer + 42, true),
    });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/** Bytes comprimidos de uma entrada (sem descomprimir). */
export function readCompressedBytes(buffer: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(entry.headerOffset, true) !== LOCAL_SIGNATURE) {
    throw new Error(`ZIP inválido: header local ausente em ${entry.name}.`);
  }
  const nameLength = view.getUint16(entry.headerOffset + 26, true);
  const extraLength = view.getUint16(entry.headerOffset + 28, true);
  const start = entry.headerOffset + 30 + nameLength + extraLength;
  return buffer.subarray(start, start + entry.compressedSize);
}

/** Conteúdo de uma entrada, descomprimido. */
export async function readZipEntry(buffer: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const compressed = readCompressedBytes(buffer, entry);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8) {
    throw new Error(`Compressão ${entry.compression} não suportada (${entry.name}).`);
  }
  const stream = new Blob([compressed as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Atalho: acha a entrada por padrão de nome e devolve o conteúdo. */
export async function readZipEntryByName(
  buffer: Uint8Array,
  pattern: RegExp | string,
): Promise<{ entry: ZipEntry; bytes: Uint8Array } | null> {
  const entries = listZipEntries(buffer);
  const entry =
    typeof pattern === "string"
      ? entries.find((candidate) => candidate.name === pattern)
      : entries.find((candidate) => pattern.test(candidate.name));
  if (!entry) return null;
  return { entry, bytes: await readZipEntry(buffer, entry) };
}
