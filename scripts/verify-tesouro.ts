/**
 * Verificação da marcação a mercado da renda fixa (wave 27).
 *
 * Uso: `bun run verify:tesouro`
 *
 * Baixa o CSV real do Tesouro Transparente e responde, sem banco:
 *   - o arquivo veio e o layout foi reconhecido?
 *   - quantos títulos e famílias existem hoje?
 *   - a curva passa nas conferências exatas (spread, ordem de taxa, prefixado)?
 *   - um rótulo típico de carteira ("Tesouro IPCA+ 2035") resolve para quê?
 *
 * É o teste que o CI não pode fazer (precisa de rede e de 15 MB), mas que o
 * operador roda quando desconfia da fonte.
 */
import { checkCurve, curveHealth, latestCurve, resolveBondLabel, summarizeCurve } from "../src/lib/market/tesouro";
import { fetchTesouroCurve } from "../src/lib/api/tesouro.functions";

const LABELS = [
  "Tesouro IPCA+ 2035",
  "Tesouro IPCA+ com Juros Semestrais 2035",
  "Tesouro Selic 2029",
  "Tesouro Prefixado 2032",
];

const started = Date.now();
console.log("\n▸ Baixando a curva do Tesouro Transparente…");

const fetched = await fetchTesouroCurve({ sinceDays: 10 });
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (fetched.rows.length === 0) {
  console.error("❌ Nenhuma linha reconhecida. O layout mudou?");
  process.exit(1);
}

const curve = latestCurve(fetched.rows);
const summary = summarizeCurve(curve);
const findings = checkCurve(fetched.rows);
const health = curveHealth(findings);

console.log(`✅ ${(fetched.bytes / 1024 / 1024).toFixed(1)} MB em ${elapsed}s`);
console.log(`   linhas úteis: ${fetched.rows.length} · descartadas: ${fetched.skipped}`);
console.log(`   curva: ${summary.bonds} títulos · data-base ${summary.asOf}`);
console.log(`   famílias: ${summary.families.map((f) => `${f.label} ${f.minRate.toFixed(2)}–${f.maxRate.toFixed(2)}%`).join(" · ")}`);
console.log(`   ${summary.note}`);

if (fetched.unknownBonds.length > 0) {
  console.log(`   ⚠️  títulos fora do catálogo: ${fetched.unknownBonds.join(", ")}`);
}

console.log(`\n▸ Conferências: ${health.total} · falhas: ${health.failed.length}`);
for (const failure of health.failed.slice(0, 10)) {
  console.log(`   ❌ ${failure.kind} · ${failure.code} ${failure.maturity} — ${failure.detail}`);
}
if (health.ok) console.log("   ✅ todas passaram");

console.log("\n▸ Rótulos típicos de carteira");
for (const label of LABELS) {
  const result = resolveBondLabel(label, curve);
  if (result.status === "resolved") {
    console.log(
      `   ✅ ${label.padEnd(42)} → ${result.bond.officialName} ${result.bond.maturity} · PU venda R$ ${result.bond.puSell.toFixed(2)} · ${result.bond.rateSell.toFixed(2)}%`,
    );
  } else if (result.status === "ambiguous") {
    console.log(`   ⚠️  ${label.padEnd(42)} → ${result.reason}`);
  } else {
    console.log(`   ❌ ${label.padEnd(42)} → ${result.reason}`);
  }
}

console.log("");
if (!health.ok) process.exitCode = 1;
