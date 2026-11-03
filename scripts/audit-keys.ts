/**
 * Gera o par de chaves da assinatura de âncoras (wave 25).
 *
 * Uso:
 *   bun run scripts/audit-keys.ts              # imprime o par para colar no .env
 *   bun run scripts/audit-keys.ts --env        # imprime no formato .env (linhas KEY=)
 *   bun run scripts/audit-keys.ts --verify     # só confere o par que está no ambiente
 *
 * A chave privada **fica no servidor** (variável de ambiente, nunca no repositório
 * e nunca com prefixo VITE_). A pública vai no pacote entregue ao auditor: com ela
 * ele verifica a âncora e **não consegue** assinar outra.
 */
import {
  generateSigningKeyPair,
  keyFingerprint,
  signManifestHashWithKeys,
  verifyAnchorSignatureAsync,
} from "../src/lib/audit/asymmetric";

const asEnvValue = (pem: string) => JSON.stringify(pem.replace(/\n/g, "\\n"));

const mode = process.argv.includes("--verify") ? "verify" : process.argv.includes("--env") ? "env" : "print";

if (mode === "verify") {
  const privateKeyPem = process.env.AUDIT_SIGNING_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const publicKeyPem = process.env.AUDIT_SIGNING_PUBLIC_KEY?.replace(/\\n/g, "\n").trim();

  if (!privateKeyPem || !publicKeyPem) {
    console.error("Faltam AUDIT_SIGNING_PRIVATE_KEY / AUDIT_SIGNING_PUBLIC_KEY no ambiente.");
    process.exit(1);
  }

  const probe = "0".repeat(64);
  const signature = await signManifestHashWithKeys({ privateKeyPem, publicKeyPem }, probe);
  const result = await verifyAnchorSignatureAsync({
    manifestHash: probe,
    signature: signature.signature,
    algorithm: signature.algorithm,
    publicKeyPem,
  });

  console.log(`fingerprint: ${await keyFingerprint(publicKeyPem)}`);
  console.log(result.ok ? "par de chaves consistente: assina e verifica" : `par inconsistente: ${result.reason}`);
  process.exit(result.ok ? 0 : 1);
}

const keys = await generateSigningKeyPair();

if (mode === "env") {
  console.log("# Cole no .env do servidor (nunca no repositório, nunca com prefixo VITE_)");
  console.log(`AUDIT_SIGNING_PRIVATE_KEY=${asEnvValue(keys.privateKeyPem)}`);
  console.log(`AUDIT_SIGNING_PUBLIC_KEY=${asEnvValue(keys.publicKeyPem)}`);
  console.log(`# fingerprint (guarde para due diligence): ${keys.fingerprint}`);
} else {
  console.log("=== CHAVE PRIVADA — só no servidor ===");
  console.log(keys.privateKeyPem);
  console.log("=== CHAVE PÚBLICA — vai no pacote do auditor ===");
  console.log(keys.publicKeyPem);
  console.log(`fingerprint (SHA-256 do SPKI): ${keys.fingerprint}`);
  console.log("");
  console.log("Verificação pelo auditor:");
  console.log("  openssl dgst -sha256 -verify public.pem -signature signature.der manifest-hash.txt");
}
