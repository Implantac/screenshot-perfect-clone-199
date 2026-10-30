/**
 * Diagnóstico de schema: diz, em uma linha por tabela, o que existe no Supabase.
 *
 * Uso: `bun run check:schema`
 *
 * Por que existe: as waves 4–8 dependem de sete migrations. Quando uma não é
 * aplicada, a tela mostra "vazio" — que é indistinguível de "sem dados" para quem
 * está usando. Este script troca o palpite por um diagnóstico.
 */
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou VITE_*) no .env.");
  process.exit(1);
}

/** Tabela → migration que a cria. */
const EXPECTED: { table: string; migration: string }[] = [
  { table: "audit_logs", migration: "20261030120000_audit_trail.sql" },
  { table: "suppliers", migration: "20261030140000_operations_tables.sql" },
  { table: "legal_cases", migration: "20261030140000_operations_tables.sql" },
  { table: "custodians", migration: "20261030150000_wealth_core.sql" },
  { table: "accounts", migration: "20261030150000_wealth_core.sql" },
  { table: "positions", migration: "20261030150000_wealth_core.sql" },
  { table: "cash_flows", migration: "20261030150000_wealth_core.sql" },
  { table: "portfolio_snapshots", migration: "20261030150000_wealth_core.sql" },
  { table: "tax_scenarios", migration: "20261030150000_wealth_core.sql" },
  { table: "import_batches", migration: "20261030160000_imports.sql" },
  { table: "quotes", migration: "20261030170000_quotes.sql" },
  { table: "quote_runs", migration: "20261030170000_quotes.sql" },
  { table: "commitments", migration: "20261030190000_private_markets.sql" },
  { table: "capital_events", migration: "20261030190000_private_markets.sql" },
  { table: "liabilities", migration: "20261030200000_balance_sheet.sql" },
  { table: "goals", migration: "20261030200000_balance_sheet.sql" },
];

/** Colunas que provam que a migration foi aplicada inteira. */
const COLUMNS: { table: string; column: string }[] = [
  { table: "transactions", column: "external_id" },
  { table: "transactions", column: "import_batch_id" },
  { table: "positions", column: "price_source" },
  { table: "positions", column: "instrument_id" },
];

async function probe(path: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, authorization: `Bearer ${key}` },
  });
  if (response.ok) return { ok: true, message: "" };
  const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  if (body.code === "PGRST205" || body.code === "42P01") {
    return { ok: false, message: "tabela ausente" };
  }
  if (body.code === "42703" || body.code === "PGRST204") {
    return { ok: false, message: "coluna ausente" };
  }
  // 401/403 = RLS bloqueando: a tabela existe (é o esperado sem sessão).
  return { ok: true, message: `RLS (HTTP ${response.status})` };
}

const missingMigrations = new Set<string>();
let failures = 0;

console.log(`\nProjeto: ${url}\n`);
console.log("TABELAS");
for (const item of EXPECTED) {
  const result = await probe(`${item.table}?select=*&limit=1`);
  if (!result.ok) missingMigrations.add(item.migration);
  else if (result.message) failures += 1;
  const status = result.ok ? "✅" : "❌";
  console.log(`  ${status} ${item.table.padEnd(22)} ${result.ok ? result.message : result.message}`);
}

console.log("\nCOLUNAS ADICIONADAS POR MIGRATION");
for (const item of COLUMNS) {
  const result = await probe(`${item.table}?select=${item.column}&limit=1`);
  if (!result.ok) missingMigrations.add("(colunas — ver migration correspondente)");
  console.log(`  ${result.ok ? "✅" : "❌"} ${item.table}.${item.column}`);
}

if (missingMigrations.size === 0) {
  console.log("\n✅ Schema completo. Todas as waves podem gravar.\n");
} else {
  console.log("\n❌ Faltam migrations neste projeto:");
  for (const migration of missingMigrations) console.log(`   · ${migration}`);
  console.log(
    "\n   Atalho: cole o conteúdo de supabase/APLICAR-TUDO.sql no SQL Editor e rode uma vez.\n",
  );
  process.exitCode = 1;
}
