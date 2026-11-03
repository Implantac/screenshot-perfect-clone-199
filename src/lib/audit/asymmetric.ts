/**
 * Assinatura assimétrica das âncoras de auditoria (wave 25).
 *
 * Na wave 20 a âncora foi assinada com **HMAC-SHA256** de um segredo simétrico.
 * Funciona para provar integridade, mas cria um problema estrutural: quem tem o
 * segredo pode assinar; logo, o auditor ou confia na palavra do operador ou
 * recebe a chave e passa a poder forjar âncoras. Não existe terceiro confiável
 * num esquema simétrico.
 *
 * Aqui a assinatura vira **ECDSA P-256 com SHA-256** (WebCrypto, sem
 * dependência): o servidor assina com a chave privada; o auditor verifica com a
 * chave pública e **não consegue** assinar. É a diferença entre "confie em mim"
 * e "verifique você mesmo".
 *
 * Por que ECDSA P-256 e não Ed25519: P-256 é verificável com `openssl` em
 * qualquer máquina, existe em toda versão de WebCrypto (Node 16+, navegador) e
 * a assinatura cabe em 64 bytes. Ed25519 exigiria Node 22 no servidor.
 *
 * Duas decisões que o código precisa deixar explícitas:
 *
 *  1. **A assinatura sai em DER** (base64). O WebCrypto produz `r||s` cru
 *     (IEEE P1363); convertemos para DER para que `openssl dgst -verify`
 *     funcione direto. Sem isso, a verificação do auditor daria "falha" mesmo
 *     com a assinatura correta — e a reação natural seria duvidar do produto.
 *  2. **A âncora carrega a própria chave pública** (PEM). Sem isso, uma rotação
 *     de chave tornaria âncoras antigas inverificáveis; com isso, cada âncora é
 *     autossuficiente para quem recebeu o pacote.
 */

export type AnchorSignatureAlgorithm = "ECDSA-P256-SHA256" | "HMAC-SHA256";

export type SigningKeyPair = {
  privateKeyPem: string;
  publicKeyPem: string;
  /** SHA-256 do SPKI em hex — identifica a chave sem revelá-la. */
  fingerprint: string;
};

const textEncoder = new TextEncoder();

// --------------------------------------------------------------------- base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** DER → PEM com quebra de 64 colunas (formato que o openssl aceita). */
export function derToPem(der: Uint8Array, label: string): string {
  const base64 = bytesToBase64(der);
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

/**
 * Normaliza PEM vindo de variável de ambiente.
 *
 * Variável de ambiente não carrega quebra de linha de verdade: o jeito prático de
 * guardar a chave é com `\n` escrito. Sem esta normalização, o PEM chegava com
 * "\n" literal, o base64 falhava e a âncora saía sem assinatura — bug silencioso
 * que só apareceria em produção.
 */
export function normalizePemEnv(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/\\n/g, "\n");
  return normalized.length > 0 ? normalized : null;
}

/** PEM → DER, tolerando cabeçalho/rodapé com espaços e quebras extras. */
export function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  if (!body) throw new Error("PEM vazio ou inválido.");
  return base64ToBytes(body);
}

// ------------------------------------------------------------------ SHA-256
/** SHA-256 hex — usa WebCrypto (assíncrono) para não duplicar o hash da cadeia. */
export async function sha256HexAsync(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? textEncoder.encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Fingerprint de uma chave pública: SHA-256 do SPKI, 64 hex. */
export async function keyFingerprint(publicKeyPem: string): Promise<string> {
  return sha256HexAsync(pemToDer(publicKeyPem));
}

/** Versão curta para exibir na tela (nunca para comparar). */
export function shortFingerprint(fingerprint: string | null | undefined): string {
  if (!fingerprint) return "—";
  return fingerprint.slice(0, 16).toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
}

// ------------------------------------------------------------ DER de ECDSA
/**
 * Converte a assinatura crua do WebCrypto (`r||s`, 64 bytes) para DER
 * (`SEQUENCE { INTEGER r, INTEGER s }`), que é o que o openssl espera.
 *
 * Detalhe que quebra implementações ingênuas: inteiros DER são **com sinal**, e
 * precisam de um byte 0x00 na frente quando o bit mais alto está ligado. Sem
 * isso, o openssl lê r negativo e a verificação falha em ~50% dos casos.
 */
export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  if (raw.length !== 64) throw new Error(`Assinatura ECDSA P-256 deve ter 64 bytes (recebi ${raw.length}).`);

  const encodeInteger = (bytes: Uint8Array): number[] => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
    const trimmed = Array.from(bytes.slice(start));
    if (trimmed.length === 0) return [0x02, 0x01, 0x00];
    if ((trimmed[0] & 0x80) === 0x80) trimmed.unshift(0x00);
    return [0x02, trimmed.length, ...trimmed];
  };

  const r = encodeInteger(raw.slice(0, 32));
  const s = encodeInteger(raw.slice(32));
  const body = [...r, ...s];
  return new Uint8Array([0x30, body.length, ...body]);
}

/** DER → `r||s` (para verificar assinatura recebida de fora). */
export function ecdsaDerToRaw(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error("Assinatura DER inválida: falta SEQUENCE.");
  let offset = 2;
  const readInteger = (): Uint8Array => {
    if (der[offset] !== 0x02) throw new Error("Assinatura DER inválida: falta INTEGER.");
    const length = der[offset + 1] as number;
    let value = der.slice(offset + 2, offset + 2 + length);
    offset += 2 + length;
    // Remove o byte de sinal e completa à esquerda até 32 bytes.
    while (value.length > 32 && value[0] === 0x00) value = value.slice(1);
    if (value.length > 32) throw new Error("Inteiro ECDSA maior que 32 bytes.");
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };
  const r = readInteger();
  const s = readInteger();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

// ------------------------------------------------------------------ chaves
export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const spki = new Uint8Array((await crypto.subtle.exportKey("spki", pair.publicKey)) as ArrayBuffer);
  const publicKeyPem = derToPem(spki, "PUBLIC KEY");

  return {
    privateKeyPem: derToPem(pkcs8, "PRIVATE KEY"),
    publicKeyPem,
    fingerprint: await keyFingerprint(publicKeyPem),
  };
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    pemToDer(pem) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    pemToDer(pem) as unknown as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

// ---------------------------------------------------------------- assinatura
export type AsymmetricSignature = {
  algorithm: "ECDSA-P256-SHA256";
  /** Assinatura DER em base64 — o formato que o openssl verifica. */
  signature: string;
  /** PEM da chave pública: vai junto da âncora para ela ser autossuficiente. */
  publicKeyPem: string;
  keyFingerprint: string;
};

/**
 * Assina o `manifestHash` (hex) da âncora.
 *
 * Assina-se o **hash**, não o manifest: o manifest já foi reduzido a 64 hex pela
 * verificação da cadeia, e assinar o hash mantém a assinatura pequena e o
 * procedimento do auditor trivial (recomputar o hash e verificar).
 */
export async function signManifestHash(privateKeyPem: string, manifestHash: string): Promise<AsymmetricSignature> {
  const privateKey = await importPrivateKey(privateKeyPem);
  const raw = new Uint8Array(
    (await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, textEncoder.encode(manifestHash))) as ArrayBuffer,
  );
  const der = ecdsaRawToDer(raw);

  // Deriva a pública da privada é possível só exportando com a flag `true`;
  // importamos a privada sem exportar, então a pública vem do parâmetro.
  return {
    algorithm: "ECDSA-P256-SHA256",
    signature: bytesToBase64(der),
    publicKeyPem: "",
    keyFingerprint: "",
  };
}

/** Assina já preenchendo a chave pública e o fingerprint. */
export async function signManifestHashWithKeys(
  keys: { privateKeyPem: string; publicKeyPem: string },
  manifestHash: string,
): Promise<AsymmetricSignature> {
  const partial = await signManifestHash(keys.privateKeyPem, manifestHash);
  return {
    ...partial,
    publicKeyPem: keys.publicKeyPem.trim(),
    keyFingerprint: await keyFingerprint(keys.publicKeyPem),
  };
}

export type VerifyResult = {
  ok: boolean;
  /** Por que falhou — em português, para aparecer na tela. */
  reason: string | null;
  algorithm: AnchorSignatureAlgorithm | null;
  keyFingerprint: string | null;
};

/**
 * Verifica uma assinatura de âncora.
 *
 * Aceita os dois esquemas: ECDSA (usa a pública que vem na âncora ou a
 * configurada) e HMAC (compatibilidade com âncoras da wave 20, via segredo).
 * A ordem importa: se a âncora declara ECDSA mas não há chave, o resultado é
 * `ok: false` com motivo — nunca "válida por omissão".
 */
export async function verifyAnchorSignatureAsync(input: {
  manifestHash: string;
  signature: string | null;
  algorithm: string | null;
  publicKeyPem?: string | null;
  hmacSecret?: string | null;
  /** HMAC calculado fora, quando o chamador já tem a função síncrona. */
  hmacExpected?: string | null;
}): Promise<VerifyResult> {
  const algorithm = input.algorithm as AnchorSignatureAlgorithm | null;

  if (!input.signature) {
    return { ok: false, reason: "Âncora sem assinatura.", algorithm, keyFingerprint: null };
  }

  if (algorithm === "HMAC-SHA256") {
    if (!input.hmacExpected) {
      return {
        ok: false,
        reason: "Âncora HMAC e segredo ausente no servidor: não é possível verificar.",
        algorithm,
        keyFingerprint: null,
      };
    }
    const ok = input.hmacExpected === input.signature;
    return {
      ok,
      reason: ok ? null : "Assinatura HMAC não confere com o manifest.",
      algorithm,
      keyFingerprint: null,
    };
  }

  const publicKeyPem = input.publicKeyPem?.trim();
  if (!publicKeyPem) {
    return {
      ok: false,
      reason: "Âncora assimétrica sem chave pública: não é possível verificar.",
      algorithm,
      keyFingerprint: null,
    };
  }

  try {
    const key = await importPublicKey(publicKeyPem);
    const raw = ecdsaDerToRaw(base64ToBytes(input.signature));
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      raw as unknown as ArrayBuffer,
      textEncoder.encode(input.manifestHash),
    );
    return {
      ok,
      reason: ok ? null : "Assinatura ECDSA não confere com o manifest — conteúdo alterado ou chave errada.",
      algorithm: "ECDSA-P256-SHA256",
      keyFingerprint: await keyFingerprint(publicKeyPem),
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Falha ao verificar: ${(error as Error).message}`,
      algorithm: "ECDSA-P256-SHA256",
      keyFingerprint: null,
    };
  }
}

/** Instruções para o auditor, no formato que ele usa de fato (terminal). */
export function auditorInstructions(algorithm: AnchorSignatureAlgorithm | null): string[] {
  if (algorithm !== "ECDSA-P256-SHA256") {
    return [
      "1. Recompute o texto canônico do manifest (ordem de manifestToCanonical()).",
      "2. SHA-256 do texto deve ser igual a manifestHash.",
      "3. HMAC-SHA256(manifestHash, segredo compartilhado) deve ser igual a signature.",
      "4. Para cada entrada, SHA-256(prevHash + '|' + payloadText) deve ser igual a entryHash.",
    ];
  }

  return [
    "1. Salve a chave pública do pacote (campo publicKey) em public.pem.",
    "2. Salve a assinatura (base64 de signature) decodificada em signature.der:  base64 -d <<< '<signature>' > signature.der",
    "3. Salve o manifestHash como arquivo de texto manifest-hash.txt (64 caracteres hex).",
    "4. Verifique:  openssl dgst -sha256 -verify public.pem -signature signature.der manifest-hash.txt",
    "5. Resultado esperado: 'Verified OK'. Qualquer outra saída significa âncora adulterada ou chave diferente.",
    "6. Para cada entrada, SHA-256(prevHash + '|' + payloadText) deve ser igual a entryHash.",
  ];
}
