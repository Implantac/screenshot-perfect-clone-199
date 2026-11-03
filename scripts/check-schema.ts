/**
 * Diagnóstico de schema: diz, em uma linha por tabela, o que existe no Supabase.
 *
 * Uso:
 *   `bun run check:schema`          → relatório legível, código 1 se faltar algo
 *   `bun run check:schema --json`   → mesmo dado em JSON (para o CI de staging)
 *
 * Por que existe: as waves 4–26 dependem de 28 migrations. Quando uma não é
 * aplicada, a tela mostra "vazio" — indistinguível de "sem dados" para quem está
 * usando. Este script troca o palpite por um diagnóstico.
 *
 * Wave 26: a lista de tabelas saiu daqui e passou a vir do manifesto em
 * `src/lib/observability/schema-manifest.ts`. Antes eram duas listas (esta e a
 * do código) e a daqui apodrecia em silêncio — `system_events`, por exemplo,
 * nunca apareceria. Agora um teste compara o manifesto com os arquivos em disco
 * e este script só consome o resultado.
 */
import {
  LATEST_MIGRATION,
  MIGRATION_COUNT,
  expectedColumns,
  expectedTables,
} from "../src/lib/observability/schema-manifest";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const strict = argv.includes("--strict");

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (ou VITE_*) no .env.");
  process.exit(2);
}

type ProbeResult = { ok: boolean; message: string; code: string | null };

async function probe(path: string): Promise<ProbeResult> {
  try {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key!, authorization: `Bearer ${key!}` },
    });
    if (response.ok) return { ok: true, message: "", code: null };

    const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    const code = body.code ?? null;

    if (code === "PGRST205" || code === "42P01") {
      return { ok: false, message: "tabela ausente", code };
    }
    if (code === "42703" || code === "PGRST204") {
      return { ok: false, message: "coluna ausente", code };
    }
    // 401/403 = RLS bloqueando: a tabela existe (é o esperado sem sessão).
    return { ok: true, message: `RLS (HTTP ${response.status})`, code };
  } catch (error) {
    return {
      ok: false,
      message: `sem conexão: ${error instanceof Error ? error.message : "erro"}`,
      code: "NETWORK",
    };
  }
}

const tables = expectedTables();
const columns = expectedColumns();

const missingMigrations = new Set<string>();
const failures: { target: string; message: string; migration: string; code: string | null }[] = [];
const lines: string[] = [];

if (!asJson) {
  lines.push("");
  lines.push(`Projeto: ${url}`);
  lines.push(`Manifesto: ${MIGRATION_COUNT} migrations · última ${LATEST_MIGRATION}`);
  lines.push("");
  lines.push("TABELAS");
}

for (const item of tables) {
  const result = await probe(`${item.table}?select=*&limit=1`);
  if (!result.ok) {
    missingMigrations.add(item.migration);
    failures.push({ target: item.table, message: result.message, migration: item.migration, code: result.code });
  }
  if (!asJson) {
    lines.push(
      `  ${result.ok ? "✅" : "❌"} ${item.table.padEnd(24)} ${result.message || `ok · wave ${item.migration.slice(0, 8)}`}`,
    );
  }
}

if (!asJson && columns.length > 0) {
  lines.push("");
  lines.push("COLUNAS ADICIONADAS POR MIGRATION");
}

for (const item of columns) {
  const result = await probe(`${item.table}?select=${item.column}&limit=1`);
  if (!result.ok) {
    missingMigrations.add(item.migration);
    failures.push({
      target: `${item.table}.${item.column}`,
      message: result.message,
      migration: item.migration,
      code: result.code,
    });
  }
  if (!asJson) lines.push(`  ${result.ok ? "✅" : "❌"} ${item.table}.${item.column}`);
}

const ok = missingMigrations.size === 0;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        ok,
        url,
        manifest: { migrations: MIGRATION_COUNT, latest: LATEST_MIGRATION },
        checked: { tables: tables.length, columns: columns.length },
        missingMigrations: [...missingMigrations],
        failures,
      },
      null,
      2,
    ),
  );
} else {
  if (ok) {
    lines.push("");
    lines.push("✅ Schema completo. Todas as waves podem gravar.");
    lines.push("");
  } else {
    lines.push("");
    lines.push("❌ Faltam migrations neste projeto:");
    for (const migration of [...missingMigrations].sort()) lines.push(`   · ${migration}`);
    lines.push("");
    lines.push("   Atalho: cole o conteúdo de supabase/APLICAR-TUDO.sql no SQL Editor e rode uma vez.");
    lines.push("");
  }
  console.log(lines.join("\n"));
}

// Falha só quando `--strict` (ou quando falta schema de verdade e não é só RLS).
// Sem `--strict`, falta de migration em ambiente local ainda retorna 1 — é o
// comportamento histórico, e é o que evita "verde" com schema incompleto.
if (!ok) process.exitCode = 1;
else if (strict && failures.length > 0) process.exitCode = 1;
