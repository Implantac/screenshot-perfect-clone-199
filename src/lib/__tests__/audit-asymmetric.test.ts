import { describe, expect, it } from "bun:test";
import {
  auditorInstructions,
  derToPem,
  ecdsaDerToRaw,
  ecdsaRawToDer,
  generateSigningKeyPair,
  keyFingerprint,
  pemToDer,
  sha256HexAsync,
  shortFingerprint,
  signManifestHash,
  signManifestHashWithKeys,
  verifyAnchorSignatureAsync,
} from "@/lib/audit/asymmetric";

const HASH = "a3".repeat(32); // 64 hex, como o manifestHash real

describe("PEM e fingerprint", () => {
  it("PEM ida e volta preserva os bytes", async () => {
    const keys = await generateSigningKeyPair();
    const der = pemToDer(keys.publicKeyPem);
    expect(der.length).toBeGreaterThan(0);
    expect(derToPem(der, "PUBLIC KEY").trim()).toBe(keys.publicKeyPem.trim());
  });

  it("PEM com espaços extras é aceito", async () => {
    const keys = await generateSigningKeyPair();
    const messy = keys.publicKeyPem.replace(/\n/g, "\n  ");
    expect(pemToDer(messy)).toEqual(pemToDer(keys.publicKeyPem));
  });

  it("PEM vazio falha alto, em vez de devolver lixo", () => {
    expect(() => pemToDer("-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----")).toThrow(/vazio/);
  });

  it("fingerprint é o SHA-256 do SPKI, determinístico", async () => {
    const keys = await generateSigningKeyPair();
    const again = await keyFingerprint(keys.publicKeyPem);
    expect(again).toBe(keys.fingerprint);
    expect(keys.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chaves diferentes têm fingerprints diferentes", async () => {
    const [a, b] = await Promise.all([generateSigningKeyPair(), generateSigningKeyPair()]);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("fingerprint curto é só para exibição", async () => {
    const keys = await generateSigningKeyPair();
    const shown = shortFingerprint(keys.fingerprint);
    expect(shown).toHaveLength(19); // 16 hex + 3 espaços
    expect(shortFingerprint(null)).toBe("—");
  });

  it("sha256 async bate com o vetor conhecido", async () => {
    expect(await sha256HexAsync("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("conversão DER/P1363", () => {
  it("ida e volta preserva r e s", () => {
    const raw = new Uint8Array(64);
    for (let index = 0; index < 64; index += 1) raw[index] = (index * 7 + 3) % 256;
    expect(Array.from(ecdsaDerToRaw(ecdsaRawToDer(raw)))).toEqual(Array.from(raw));
  });

  it("inteiro com bit alto ligado recebe byte de sinal", () => {
    const raw = new Uint8Array(64);
    raw[0] = 0xff; // r começa com 0x80 ligado
    raw[32] = 0x01;
    const der = ecdsaRawToDer(raw);
    // SEQUENCE, len, INTEGER, len=33, 0x00, 0xff...
    expect(der[0]).toBe(0x30);
    expect(der[2]).toBe(0x02);
    expect(der[3]).toBe(33);
    expect(der[4]).toBe(0x00);
    expect(der[5]).toBe(0xff);
  });

  it("zeros à esquerda são removidos (DER exige inteiro mínimo)", () => {
    const raw = new Uint8Array(64);
    raw[2] = 0x12; // dois bytes zero à esquerda; o resto de r é zero também
    raw[32] = 0x34;
    const der = ecdsaRawToDer(raw);
    // r vai de 0x12 até o fim dos 32 bytes → 30 bytes, sem os dois zeros iniciais.
    expect(der[2]).toBe(0x02);
    expect(der[3]).toBe(30);
    expect(der[4]).toBe(0x12);
    // e o valor volta íntegro
    const back = ecdsaDerToRaw(der);
    expect(back[2]).toBe(0x12);
    expect(back[32]).toBe(0x34);
  });

  it("assinatura com tamanho errado é recusada", () => {
    expect(() => ecdsaRawToDer(new Uint8Array(63))).toThrow(/64 bytes/);
  });

  it("DER inválido é recusado em vez de virar assinatura aleatória", () => {
    expect(() => ecdsaDerToRaw(new Uint8Array([0x31, 0x00]))).toThrow(/SEQUENCE/);
  });
});

describe("assinatura e verificação", () => {
  it("assina e verifica com a chave pública", async () => {
    const keys = await generateSigningKeyPair();
    const signature = await signManifestHashWithKeys(keys, HASH);
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: signature.signature,
      algorithm: signature.algorithm,
      publicKeyPem: signature.publicKeyPem,
    });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.keyFingerprint).toBe(keys.fingerprint);
  });

  it("manifest adulterado não verifica", async () => {
    const keys = await generateSigningKeyPair();
    const signature = await signManifestHashWithKeys(keys, HASH);
    const result = await verifyAnchorSignatureAsync({
      manifestHash: "b7".repeat(32),
      signature: signature.signature,
      algorithm: signature.algorithm,
      publicKeyPem: signature.publicKeyPem,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("não confere");
  });

  it("outra chave pública não verifica (o auditor não consegue forjar)", async () => {
    const keys = await generateSigningKeyPair();
    const other = await generateSigningKeyPair();
    const signature = await signManifestHashWithKeys(keys, HASH);
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: signature.signature,
      algorithm: signature.algorithm,
      publicKeyPem: other.publicKeyPem,
    });
    expect(result.ok).toBe(false);
  });

  it("assinatura é sempre diferente entre execuções (ECDSA é aleatório)", async () => {
    const keys = await generateSigningKeyPair();
    const [a, b] = await Promise.all([signManifestHash(keys.privateKeyPem, HASH), signManifestHash(keys.privateKeyPem, HASH)]);
    expect(a.signature).not.toBe(b.signature);
    // mas as duas verificam
    for (const signature of [a, b]) {
      const result = await verifyAnchorSignatureAsync({
        manifestHash: HASH,
        signature: signature.signature,
        algorithm: signature.algorithm,
        publicKeyPem: keys.publicKeyPem,
      });
      expect(result.ok).toBe(true);
    }
  });

  it("âncora sem assinatura não é válida por omissão", async () => {
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: null,
      algorithm: null,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("sem assinatura");
  });

  it("âncora assimétrica sem chave pública falha declarando o motivo", async () => {
    const keys = await generateSigningKeyPair();
    const signature = await signManifestHashWithKeys(keys, HASH);
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: signature.signature,
      algorithm: signature.algorithm,
      publicKeyPem: null,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("sem chave pública");
  });

  it("assinatura corrompida não vira exceção: vira falha explicada", async () => {
    const keys = await generateSigningKeyPair();
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: "bmFvIGUgdW1hIGFzc2luYXR1cmE=", // base64 de texto qualquer
      algorithm: "ECDSA-P256-SHA256",
      publicKeyPem: keys.publicKeyPem,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("chave pública malformada é recusada com motivo", async () => {
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: "AAAA",
      algorithm: "ECDSA-P256-SHA256",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----",
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Falha ao verificar");
  });
});

describe("compatibilidade com âncoras HMAC (wave 20)", () => {
  it("verifica HMAC quando o esperado é informado", async () => {
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: "abc123",
      algorithm: "HMAC-SHA256",
      hmacExpected: "abc123",
    });
    expect(result.ok).toBe(true);
  });

  it("HMAC divergente não verifica", async () => {
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: "abc123",
      algorithm: "HMAC-SHA256",
      hmacExpected: "outro",
    });
    expect(result.ok).toBe(false);
  });

  it("HMAC sem segredo não é declarado válido", async () => {
    const result = await verifyAnchorSignatureAsync({
      manifestHash: HASH,
      signature: "abc123",
      algorithm: "HMAC-SHA256",
      hmacExpected: null,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("segredo ausente");
  });
});

describe("instruções do auditor", () => {
  it("assimétrica manda usar openssl com a chave pública", () => {
    const instructions = auditorInstructions("ECDSA-P256-SHA256");
    const text = instructions.join("\n");
    expect(text).toContain("openssl dgst -sha256 -verify");
    expect(text).toContain("Verified OK");
    expect(text).toContain("public.pem");
  });

  it("simétrica continua descrevendo o HMAC", () => {
    const text = auditorInstructions("HMAC-SHA256").join("\n");
    expect(text).toContain("HMAC-SHA256");
    expect(text).not.toContain("openssl");
  });

  it("âncora sem assinatura recebe as instruções de hash da cadeia", () => {
    expect(auditorInstructions(null).length).toBeGreaterThan(0);
  });
});

/**
 * Prova final: a assinatura que geramos é verificável pelo `openssl` do sistema,
 * com o comando que está nas instruções do auditor. Se este teste passa, as
 * instruções entregues ao auditor funcionam de fato — não são documentação
 * esperançosa.
 */
describe("verificação com openssl de verdade", () => {
  const hasOpenssl = Boolean(Bun.which("openssl"));

  it.skipIf(!hasOpenssl)("openssl confirma a assinatura e recusa conteúdo alterado", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");

    const dir = mkdtempSync(join(tmpdir(), "patrium-anchor-"));
    try {
      const keys = await generateSigningKeyPair();
      const signature = await signManifestHashWithKeys(keys, HASH);

      writeFileSync(join(dir, "public.pem"), signature.publicKeyPem);
      writeFileSync(join(dir, "signature.der"), Buffer.from(signature.signature, "base64"));
      writeFileSync(join(dir, "manifest-hash.txt"), HASH);
      writeFileSync(join(dir, "adulterado.txt"), "b7".repeat(32));

      const ok = Bun.spawnSync([
        "openssl",
        "dgst",
        "-sha256",
        "-verify",
        join(dir, "public.pem"),
        "-signature",
        join(dir, "signature.der"),
        join(dir, "manifest-hash.txt"),
      ]);
      expect(ok.stdout.toString()).toContain("Verified OK");

      const bad = Bun.spawnSync([
        "openssl",
        "dgst",
        "-sha256",
        "-verify",
        join(dir, "public.pem"),
        "-signature",
        join(dir, "signature.der"),
        join(dir, "adulterado.txt"),
      ]);
      expect(bad.stdout.toString()).toContain("Verification failure");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
