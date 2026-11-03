/**
 * Trilha de auditoria como prova, não como log.
 *
 * A wave 4 fez o `audit_logs` existir de verdade (trigger genérico + diff
 * old/new). Só que log gravável não prova nada: quem tem acesso ao banco apaga a
 * linha, ajusta o valor e a "trilha" continua linda. Esta camada transforma a
 * trilha em **cadeia de hash** — cada entrada carrega o hash da anterior — e em
 * **âncora assinada** com HMAC-SHA256, que é o que o auditor recebe.
 *
 * Decisões declaradas:
 *   - SHA-256 em JS puro (sem dependência e **síncrono**), usado tanto no
 *     navegador quanto no servidor. Os testes conferem contra vetores oficiais
 *     (NIST/RFC 4231), então "implementação caseira" não é desculpa para hash
 *     errado.
 *   - O texto canônico que entra no hash é montado no banco por
 *     `audit_payload_text()` — uma única fonte de verdade para os dois lados.
 *     O JS recomputa o hash sobre esse texto: se alguém editar o dado, o hash
 *     não fecha.
 *   - HMAC usa segredo do servidor (`AUDIT_SIGNING_SECRET`). Sem segredo, a
 *     âncora é emitida sem assinatura e a tela diz isso — degradação honesta,
 *     nunca assinatura falsa.
 */

export const GENESIS_HASH = "0".repeat(64);

export type ChainEntry = {
  sequence: number;
  ownerUserId: string | null;
  action: string;
  tableName: string | null;
  recordId: string | null;
  userId: string | null;
  createdAt: string;
  prevHash: string;
  entryHash: string;
  /** Texto canônico devolvido pela view `audit_logs_chain` (opcional na verificação). */
  payloadText?: string | null;
};

// ---------------------------------------------------------------------------
// SHA-256 puro (síncrono, funciona em navegador, Bun e Node)
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (value: number, shift: number) => (value >>> shift) | (value << (32 - shift));

function utf8Bytes(input: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(input);
  const bytes: number[] = [];
  for (const char of input) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
  }
  return new Uint8Array(bytes);
}

export function sha256Bytes(input: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  const bitLength = input.length * 8;
  const withPadding = new Uint8Array((((input.length + 9) >> 6) + 1) << 6);
  withPadding.set(input);
  withPadding[input.length] = 0x80;
  // comprimento em bits nos últimos 8 bytes (big-endian, 64 bits)
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(withPadding.length - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < withPadding.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i]);
  return out;
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export function sha256Hex(input: string): string {
  return toHex(sha256Bytes(utf8Bytes(input)));
}

export function hmacSha256Hex(secret: string, message: string): string {
  const blockSize = 64;
  let key = utf8Bytes(secret);
  if (key.length > blockSize) key = sha256Bytes(key);
  const padded = new Uint8Array(blockSize);
  padded.set(key);

  const inner = new Uint8Array(blockSize + message.length);
  const outer = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i += 1) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(utf8Bytes(message), blockSize);
  outer.set(sha256Bytes(inner), blockSize);
  return toHex(sha256Bytes(outer));
}

// ---------------------------------------------------------------------------
// Cadeia
// ---------------------------------------------------------------------------

/**
 * Espelho em JS de `public.audit_payload_text()` (SQL).
 *
 * Existe para o app conseguir montar/verificar payload em teste e para gerar o
 * pacote de exportação. A fonte de verdade em produção é a função SQL — se as
 * duas divergirem, a verificação acusa (e o teste de contrato quebra).
 */
export function canonicalPayload(entry: {
  ownerUserId: string | null;
  sequence: number;
  action: string;
  tableName: string | null;
  recordId: string | null;
  createdAt: string;
  userId: string | null;
  oldHash: string;
  newHash: string;
}): string {
  return [
    entry.ownerUserId ?? "",
    String(entry.sequence),
    entry.action ?? "",
    entry.tableName ?? "",
    entry.recordId ?? "",
    entry.createdAt,
    entry.userId ?? "",
    entry.oldHash,
    entry.newHash,
  ].join("|");
}

export function computeEntryHash(prevHash: string, payloadText: string): string {
  return sha256Hex(`${prevHash}|${payloadText}`);
}

export type ChainIssue = {
  sequence: number;
  kind: "elo" | "sequencia" | "conteudo" | "genesis";
  detail: string;
};

export type ChainVerification = {
  ok: boolean;
  checked: number;
  contentChecked: number;
  firstBrokenSequence: number | null;
  issues: ChainIssue[];
  /** Janela começa no meio da cadeia (paginação): não é falha, é contexto. */
  startedMidChain: boolean;
};

/**
 * Verifica a cadeia de uma janela de entradas.
 *
 * Três checagens independentes:
 *   1. **elo** — `prev_hash` tem de ser igual ao `entry_hash` da anterior;
 *   2. **sequência** — sem buraco: sequência 7 depois de 5 significa linha apagada;
 *   3. **conteúdo** — quando o texto canônico está disponível, recomputa o hash.
 *
 * A janela é verificada como cadeia fechada: a primeira entrada precisa ser o
 * gênesis **ou** a verificação declara que começou no meio (não inventa falha).
 */
function verifySingleChain(ordered: ChainEntry[]): { issues: ChainIssue[]; contentChecked: number; startedMidChain: boolean } {
  const issues: ChainIssue[] = [];
  let contentChecked = 0;

  if (ordered.length === 0) return { issues, contentChecked, startedMidChain: false };

  // Janela que começa no meio (paginação/consulta por período) é legítima: o elo
  // anterior simplesmente não está aqui. Só é falha se a sequência 1 não aponta
  // para o gênesis.
  const startedMidChain = ordered[0].sequence !== 1;

  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    const previous = index > 0 ? ordered[index - 1] : null;

    if (previous) {
      if (entry.sequence !== previous.sequence + 1) {
        issues.push({
          sequence: entry.sequence,
          kind: "sequencia",
          detail: `Salto de ${previous.sequence} para ${entry.sequence}: entrada removida ou fora de ordem.`,
        });
      }
      if (entry.prevHash !== previous.entryHash) {
        issues.push({
          sequence: entry.sequence,
          kind: "elo",
          detail: `prev_hash não confere com o entry_hash da entrada ${previous.sequence}.`,
        });
      }
    } else if (entry.sequence === 1 && entry.prevHash !== GENESIS_HASH) {
      issues.push({
        sequence: entry.sequence,
        kind: "genesis",
        detail: "Primeira entrada não aponta para o gênesis.",
      });
    }

    if (entry.payloadText) {
      contentChecked += 1;
      const recomputed = computeEntryHash(entry.prevHash, entry.payloadText);
      if (recomputed !== entry.entryHash) {
        issues.push({
          sequence: entry.sequence,
          kind: "conteudo",
          detail: "Hash recomputado difere do gravado: o conteúdo da entrada foi alterado.",
        });
      }
    }
  }

  return { issues, contentChecked, startedMidChain };
}

/**
 * Verifica a cadeia de uma janela de entradas.
 *
 * Três checagens independentes:
 *   1. **elo** — `prev_hash` tem de ser igual ao `entry_hash` da anterior;
 *   2. **sequência** — sem buraco: sequência 7 depois de 5 significa linha apagada;
 *   3. **conteúdo** — quando o texto canônico está disponível, recomputa o hash.
 *
 * A cadeia é **por tenant** (`ownerUserId`): um admin vendo vários tenants recebe
 * sequências que reiniciam, e isso não é falha — cada dono tem a sua cadeia.
 */
export function verifyChain(entries: ChainEntry[]): ChainVerification {
  const groups = new Map<string, ChainEntry[]>();
  for (const entry of entries) {
    const key = entry.ownerUserId ?? "";
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  const issues: ChainIssue[] = [];
  let contentChecked = 0;
  let checked = 0;
  let startedMidChain = false;

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => a.sequence - b.sequence);
    const result = verifySingleChain(ordered);
    checked += ordered.length;
    contentChecked += result.contentChecked;
    startedMidChain = startedMidChain || result.startedMidChain;
    issues.push(...result.issues);
  }

  issues.sort((a, b) => a.sequence - b.sequence);

  return {
    ok: issues.length === 0,
    checked,
    contentChecked,
    firstBrokenSequence: issues[0]?.sequence ?? null,
    issues,
    startedMidChain,
  };
}

export type ChainSummary = {
  count: number;
  firstSequence: number | null;
  headSequence: number | null;
  headHash: string | null;
  firstAt: string | null;
  lastAt: string | null;
  owners: number;
  byAction: Record<string, number>;
  byTable: Record<string, number>;
};

export function summarizeChain(entries: ChainEntry[]): ChainSummary {
  const byAction: Record<string, number> = {};
  const byTable: Record<string, number> = {};
  const owners = new Set<string>();

  for (const entry of entries) {
    byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
    const table = entry.tableName ?? "—";
    byTable[table] = (byTable[table] ?? 0) + 1;
    if (entry.ownerUserId) owners.add(entry.ownerUserId);
  }

  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
  const dates = ordered.map((entry) => entry.createdAt).sort();

  return {
    count: ordered.length,
    firstSequence: ordered[0]?.sequence ?? null,
    headSequence: ordered[ordered.length - 1]?.sequence ?? null,
    headHash: ordered[ordered.length - 1]?.entryHash ?? null,
    firstAt: dates[0] ?? null,
    lastAt: dates[dates.length - 1] ?? null,
    owners: owners.size,
    byAction,
    byTable,
  };
}

// ---------------------------------------------------------------------------
// Âncora assinada (o artefato que o auditor recebe)
// ---------------------------------------------------------------------------

export type AuditManifest = {
  version: 1;
  algorithm: "SHA-256";
  generatedAt: string;
  periodFrom: string | null;
  periodTo: string | null;
  entries: number;
  firstSequence: number | null;
  headSequence: number | null;
  headHash: string | null;
  ownerUserId: string | null;
  /** Hash sobre a lista ordenada de entry_hash — muda se qualquer elo mudar. */
  chainHash: string;
  verification: {
    ok: boolean;
    contentChecked: number;
    issues: number;
  };
};

export type SignedAnchor = {
  manifest: AuditManifest;
  /** SHA-256 do manifest canônico (é o que se assina). */
  manifestHash: string;
  signature: string | null;
  signatureAlgorithm: "HMAC-SHA256" | null;
  signaturePending?: boolean;
};

/** Hash da cadeia: SHA-256 de todos os entry_hash em ordem, separados por ";". */
export function hashChain(entries: ChainEntry[]): string {
  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
  return sha256Hex(ordered.map((entry) => entry.entryHash).join(";"));
}

/** Serialização canônica do manifest — chaves fixas, sem espaço, ordem estável. */
export function manifestToCanonical(manifest: AuditManifest): string {
  return [
    `version=${manifest.version}`,
    `algorithm=${manifest.algorithm}`,
    `generatedAt=${manifest.generatedAt}`,
    `periodFrom=${manifest.periodFrom ?? ""}`,
    `periodTo=${manifest.periodTo ?? ""}`,
    `entries=${manifest.entries}`,
    `firstSequence=${manifest.firstSequence ?? ""}`,
    `headSequence=${manifest.headSequence ?? ""}`,
    `headHash=${manifest.headHash ?? ""}`,
    `ownerUserId=${manifest.ownerUserId ?? ""}`,
    `chainHash=${manifest.chainHash}`,
    `verificationOk=${manifest.verification.ok}`,
    `verificationContentChecked=${manifest.verification.contentChecked}`,
    `verificationIssues=${manifest.verification.issues}`,
  ].join("\n");
}

export function buildAnchor(input: {
  entries: ChainEntry[];
  generatedAt: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  ownerUserId?: string | null;
  secret?: string | null;
}): SignedAnchor {
  const summary = summarizeChain(input.entries);
  const verification = verifyChain(input.entries);
  const manifest: AuditManifest = {
    version: 1,
    algorithm: "SHA-256",
    generatedAt: input.generatedAt,
    periodFrom: input.periodFrom ?? null,
    periodTo: input.periodTo ?? null,
    entries: summary.count,
    firstSequence: summary.firstSequence,
    headSequence: summary.headSequence,
    headHash: summary.headHash,
    ownerUserId: input.ownerUserId ?? null,
    chainHash: hashChain(input.entries),
    verification: {
      ok: verification.ok,
      contentChecked: verification.contentChecked,
      issues: verification.issues.length,
    },
  };

  const manifestHash = sha256Hex(manifestToCanonical(manifest));
  const secret = input.secret?.trim();
  if (!secret) {
    return {
      manifest,
      manifestHash,
      signature: null,
      signatureAlgorithm: null,
      signaturePending: true,
    };
  }

  return {
    manifest,
    manifestHash,
    signature: hmacSha256Hex(secret, manifestHash),
    signatureAlgorithm: "HMAC-SHA256",
  };
}

export function verifyAnchorSignature(anchor: {
  manifestHash: string;
  signature: string | null;
}, secret: string | null | undefined): boolean {
  if (!anchor.signature || !secret) return false;
  return hmacSha256Hex(secret, anchor.manifestHash) === anchor.signature;
}

/** Hash curto para exibição (nunca para comparação). */
export function shortHash(hash: string | null | undefined, size = 10): string {
  if (!hash) return "—";
  return hash.slice(0, size);
}

/** Pacote que o auditor baixa: manifest + janela de entradas, em JSON estável. */
export function buildExportPackage(anchor: SignedAnchor, entries: ChainEntry[]) {
  const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
  return {
    format: "patrium-audit-package",
    version: 1,
    generatedAt: anchor.manifest.generatedAt,
    manifest: anchor.manifest,
    manifestHash: anchor.manifestHash,
    signature: anchor.signature,
    signatureAlgorithm: anchor.signatureAlgorithm,
    /** Como o auditor verifica: recompute o manifest canônico, o SHA-256 e o HMAC. */
    instructions: [
      "1. Recompute o texto canônico do manifest na ordem dos campos de manifestToCanonical().",
      "2. SHA-256 do texto deve ser igual a manifestHash.",
      "3. HMAC-SHA256(manifestHash, segredo compartilhado) deve ser igual a signature.",
      "4. Para cada entrada, SHA-256(prevHash + '|' + payloadText) deve ser igual a entryHash.",
    ],
    entries: ordered,
  };
}

/** Serializador com chaves ordenadas — o JSON do pacote não muda de hash à toa. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(",")}}`;
}
