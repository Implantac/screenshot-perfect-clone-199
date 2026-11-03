import { describe, expect, it } from "bun:test";
import {
  GENESIS_HASH,
  buildAnchor,
  buildExportPackage,
  canonicalPayload,
  computeEntryHash,
  hashChain,
  hmacSha256Hex,
  manifestToCanonical,
  sha256Hex,
  shortHash,
  stableStringify,
  summarizeChain,
  verifyAnchorSignature,
  verifyChain,
  type ChainEntry,
} from "@/lib/audit/chain";

/** Constrói uma cadeia válida de N entradas, com payloads e hashes reais. */
function buildChain(count: number): ChainEntry[] {
  const entries: ChainEntry[] = [];
  let prevHash = GENESIS_HASH;
  for (let index = 1; index <= count; index += 1) {
    const payloadText = canonicalPayload({
      ownerUserId: "owner-1",
      sequence: index,
      action: "UPDATE",
      tableName: "assets",
      recordId: `rec-${index}`,
      createdAt: `2026-11-0${((index - 1) % 9) + 1}T12:00:0${index % 10}.000Z`,
      userId: "user-1",
      oldHash: "old",
      newHash: "new",
    });
    const entryHash = computeEntryHash(prevHash, payloadText);
    entries.push({
      sequence: index,
      ownerUserId: "owner-1",
      action: "UPDATE",
      tableName: "assets",
      recordId: `rec-${index}`,
      userId: "user-1",
      createdAt: `2026-11-0${((index - 1) % 9) + 1}T12:00:0${index % 10}.000Z`,
      prevHash,
      entryHash,
      payloadText,
    });
    prevHash = entryHash;
  }
  return entries;
}

describe("SHA-256", () => {
  it("bate com os vetores oficiais (string vazia e 'abc')", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("bate com o vetor de duas quadras (448 bits de mensagem)", () => {
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("lida com acentos e emoji (UTF-8, não latin-1)", () => {
    expect(sha256Hex("Patrimônio")).toBe(sha256Hex("Patrimônio"));
    expect(sha256Hex("Patrimônio")).not.toBe(sha256Hex("Patrimonio"));
    expect(sha256Hex("🌾")).toHaveLength(64);
  });

  it("mensagem longa passa de bloco sem perder byte", () => {
    const long = "a".repeat(1_000);
    expect(sha256Hex(long)).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});

describe("HMAC-SHA256", () => {
  it("bate com o vetor 1 da RFC 4231", () => {
    expect(hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  it("bate com o vetor 2 da RFC 4231 (chave e mensagem com 'Jefe')", () => {
    expect(
      hmacSha256Hex("Jefe", "what do ya want for nothing?"),
    ).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("chave diferente muda a assinatura", () => {
    expect(hmacSha256Hex("a", "msg")).not.toBe(hmacSha256Hex("b", "msg"));
  });
});

describe("payload canônico", () => {
  it("usa '|' entre os campos e string vazia para nulos", () => {
    const text = canonicalPayload({
      ownerUserId: null,
      sequence: 7,
      action: "INSERT",
      tableName: null,
      recordId: null,
      createdAt: "2026-11-03T00:00:00.000Z",
      userId: null,
      oldHash: "null-hash",
      newHash: "new-hash",
    });
    // owner vazio | 7 | INSERT | tabela vazia | registro vazio | data | autor vazio | old | new
    expect(text).toBe("|7|INSERT|||2026-11-03T00:00:00.000Z||null-hash|new-hash");
  });

  it("o hash da entrada concatena prev + '|' + payload", () => {
    const payload = "abc";
    expect(computeEntryHash(GENESIS_HASH, payload)).toBe(sha256Hex(`${GENESIS_HASH}|${payload}`));
  });
});

describe("verificação da cadeia", () => {
  const chain = buildChain(5);

  it("cadeia íntegra passa nas três checagens", () => {
    const result = verifyChain(chain);
    expect(result.ok).toBe(true);
    expect(result.startedMidChain).toBe(false);
    expect(result.checked).toBe(5);
    expect(result.contentChecked).toBe(5);
    expect(result.issues).toHaveLength(0);
  });

  it("detecta conteúdo alterado (o caso do auditor)", () => {
    // Simula quem edita a linha no banco: a view recalcula o payload_text a partir
    // dos campos atuais, então o hash gravado deixa de fechar.
    const tampered = chain.map((entry, index) =>
      index === 2 ? { ...entry, payloadText: `${entry.payloadText}|adulterado` } : entry,
    );
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.firstBrokenSequence).toBe(3);
    expect(result.issues[0].kind).toBe("conteudo");
  });

  it("detecta entrada removida pelo buraco na sequência", () => {
    const withGap = [chain[0], chain[1], chain[3], chain[4]];
    const result = verifyChain(withGap);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.kind === "sequencia")).toBe(true);
    expect(result.firstBrokenSequence).toBe(4);
  });

  it("detecta elo trocado", () => {
    const broken = chain.map((entry, index) =>
      index === 3 ? { ...entry, prevHash: "f".repeat(64) } : entry,
    );
    const result = verifyChain(broken);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.kind === "elo")).toBe(true);
  });

  it("não acusa falha de gênesis quando a janela começa no meio", () => {
    const window = chain.slice(2);
    const result = verifyChain(window);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.startedMidChain).toBe(true);
  });

  it("acusa gênesis errado quando a sequência 1 não aponta para zeros", () => {
    const wrongGenesis = [{ ...chain[0], prevHash: "a".repeat(64) }];
    const result = verifyChain(wrongGenesis);
    expect(result.ok).toBe(false);
    expect(result.issues[0].kind).toBe("genesis");
  });

  it("cadeia vazia é válida e não verifica conteúdo", () => {
    const result = verifyChain([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(0);
    expect(result.contentChecked).toBe(0);
  });

  it("sem payloadText o elo ainda é verificado, mas o conteúdo não", () => {
    const withoutPayload = chain.map(({ payloadText: _drop, ...rest }) => rest);
    const result = verifyChain(withoutPayload);
    expect(result.ok).toBe(true);
    expect(result.contentChecked).toBe(0);
  });

  it("verifica cada tenant na sua cadeia: admin vendo vários não vê falha falsa", () => {
    const tenantA = buildChain(3);
    const tenantB = buildChain(3).map((entry) => ({ ...entry, ownerUserId: "owner-2" }));
    // intercala as duas cadeias numa janela só (é o que o admin enxerga)
    const interleaved = [
      tenantA[0], tenantB[0], tenantA[1], tenantB[1], tenantA[2], tenantB[2],
    ];
    const result = verifyChain(interleaved);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(6);
    expect(result.issues).toHaveLength(0);
  });

  it("quebra em um tenant não contamina o outro", () => {
    const tenantA = buildChain(2);
    const tenantB = buildChain(2).map((entry) => ({ ...entry, ownerUserId: "owner-2" }));
    const brokenB = [tenantB[0], { ...tenantB[1], prevHash: "9".repeat(64) }];
    const result = verifyChain([...tenantA, ...brokenB]);
    expect(result.ok).toBe(false);
    // o mesmo defeito aparece no elo e no conteúdo, mas só na sequência 2 do tenant B
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues.every((issue) => issue.sequence === 2)).toBe(true);
    expect(result.issues[0].kind).toBe("elo");
  });

  it("aceita entrada fora de ordem na janela e ordena antes de verificar", () => {
    const shuffled = [chain[4], chain[0], chain[3], chain[1], chain[2]];
    expect(verifyChain(shuffled).ok).toBe(true);
  });
});

describe("resumo da cadeia", () => {
  const chain = buildChain(4);

  it("conta entradas, elo atual e período", () => {
    const summary = summarizeChain(chain);
    expect(summary.count).toBe(4);
    expect(summary.firstSequence).toBe(1);
    expect(summary.headSequence).toBe(4);
    expect(summary.headHash).toBe(chain[3].entryHash);
    expect(summary.owners).toBe(1);
    expect(summary.byAction.UPDATE).toBe(4);
    expect(summary.byTable.assets).toBe(4);
  });

  it("janela vazia devolve nulos em vez de quebrar", () => {
    const summary = summarizeChain([]);
    expect(summary.count).toBe(0);
    expect(summary.headHash).toBeNull();
    expect(summary.firstAt).toBeNull();
  });

  it("hash da cadeia muda se qualquer elo mudar", () => {
    const before = hashChain(chain);
    const after = hashChain(chain.map((entry, index) =>
      index === 1 ? { ...entry, entryHash: "b".repeat(64) } : entry,
    ));
    expect(before).not.toBe(after);
    expect(before).toHaveLength(64);
  });
});

describe("âncora assinada", () => {
  const chain = buildChain(6);
  const anchor = buildAnchor({
    entries: chain,
    generatedAt: "2026-11-03T10:00:00.000Z",
    periodFrom: "2026-11-01T00:00:00.000Z",
    periodTo: "2026-11-30T23:59:59.000Z",
    ownerUserId: "owner-1",
    secret: "segredo-do-servidor",
  });

  it("assina o hash do manifest com HMAC-SHA256", () => {
    expect(anchor.signatureAlgorithm).toBe("HMAC-SHA256");
    expect(anchor.signature).toBe(hmacSha256Hex("segredo-do-servidor", anchor.manifestHash));
  });

  it("verifica a assinatura com o mesmo segredo e rejeita outro", () => {
    expect(verifyAnchorSignature(anchor, "segredo-do-servidor")).toBe(true);
    expect(verifyAnchorSignature(anchor, "segredo-errado")).toBe(false);
    expect(verifyAnchorSignature(anchor, null)).toBe(false);
  });

  it("sem segredo, emite âncora sem assinatura e avisa (não inventa assinatura)", () => {
    const unsigned = buildAnchor({ entries: chain, generatedAt: "2026-11-03T10:00:00.000Z" });
    expect(unsigned.signature).toBeNull();
    expect(unsigned.signatureAlgorithm).toBeNull();
    expect(unsigned.signaturePending).toBe(true);
    expect(unsigned.manifestHash).toHaveLength(64);
  });

  it("o manifest carrega o resultado da própria verificação", () => {
    expect(anchor.manifest.verification.ok).toBe(true);
    expect(anchor.manifest.verification.contentChecked).toBe(6);
    expect(anchor.manifest.verification.issues).toBe(0);
    expect(anchor.manifest.entries).toBe(6);
    expect(anchor.manifest.headHash).toBe(chain[5].entryHash);
  });

  it("manifest de cadeia adulterada sai marcado como não verificado", () => {
    const bad = buildAnchor({
      entries: chain.map((entry, index) => (index === 2 ? { ...entry, entryHash: "c".repeat(64) } : entry)),
      generatedAt: "2026-11-03T10:00:00.000Z",
      secret: "segredo-do-servidor",
    });
    expect(bad.manifest.verification.ok).toBe(false);
    expect(bad.manifest.verification.issues).toBeGreaterThan(0);
  });

  it("mudar um campo do manifest muda o hash canônico", () => {
    const altered = { ...anchor.manifest, entries: anchor.manifest.entries + 1 };
    expect(manifestToCanonical(altered)).not.toBe(manifestToCanonical(anchor.manifest));
  });

  it("mesmo manifest gera o mesmo hash (assinatura determinística)", () => {
    const again = buildAnchor({
      entries: chain,
      generatedAt: "2026-11-03T10:00:00.000Z",
      periodFrom: "2026-11-01T00:00:00.000Z",
      periodTo: "2026-11-30T23:59:59.000Z",
      ownerUserId: "owner-1",
      secret: "outro-segredo",
    });
    expect(again.manifestHash).toBe(anchor.manifestHash);
    expect(again.signature).not.toBe(anchor.signature);
  });
});

describe("pacote de exportação", () => {
  const chain = buildChain(3);
  const anchor = buildAnchor({
    entries: chain,
    generatedAt: "2026-11-03T10:00:00.000Z",
    secret: "segredo-do-servidor",
  });

  it("inclui manifest, assinatura, instruções e as entradas", () => {
    const pkg = buildExportPackage(anchor, chain);
    expect(pkg.format).toBe("patrium-audit-package");
    expect(pkg.manifestHash).toBe(anchor.manifestHash);
    expect(pkg.entries).toHaveLength(3);
    expect(pkg.instructions.length).toBeGreaterThanOrEqual(4);
  });

  it("o pacote continua verificável depois de serializado e relido", () => {
    const pkg = buildExportPackage(anchor, chain);
    const roundTrip = JSON.parse(stableStringify(pkg)) as typeof pkg;
    expect(verifyAnchorSignature(roundTrip, "segredo-do-servidor")).toBe(true);
    expect(verifyChain(roundTrip.entries as ChainEntry[]).ok).toBe(true);
  });

  it("stableStringify ordena chaves — hash não muda por ordem de propriedade", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ a: [1, { d: 1, c: 2 }] })).toBe('{"a":[1,{"c":2,"d":1}]}');
  });

  it("hash curto é só para exibição", () => {
    expect(shortHash("abcdef0123456789")).toBe("abcdef0123");
    expect(shortHash(null)).toBe("—");
  });
});
