/**
 * `bun run db:mirror` — gera os espelhos em `drizzle/migrations/` para as
 * migrations novas de `supabase/migrations/`.
 *
 * Idempotente: o que já existe não é reescrito. Falha (código 1) se um espelho
 * já existente divergir do original — nesse caso, o certo é consertar o arquivo
 * à mão depois de entender por quê, não deixar o script sobrescrever o que o
 * runner da Lovable já aplicou (o drizzle guarda hash por arquivo).
 *
 * Ficam de fora as 8 migrations `20260610*`: são o esquema inicial criado pela
 * própria Lovable, já aplicado na criação do projeto, e nunca tiveram espelho.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findDivergences, pairMigrations, stripSqlComments, tokenStream } from "./migration-mirror";

type MigrationRef = { key: string; name: string; path: string };

const ROOT = join(import.meta.dir, "..");
const SUPABASE_DIR = join(ROOT, "supabase", "migrations");
const DRIZZLE_DIR = join(ROOT, "drizzle", "migrations");
const META_DIR = join(DRIZZLE_DIR, "meta");

/** Esquema inicial criado junto com o projeto: não tem espelho e não precisa ter. */
const INITIAL = /^20260610/;

function listSupabase(): MigrationRef[] {
  return readdirSync(SUPABASE_DIR)
    .filter((file) => file.endsWith(".sql") && !INITIAL.test(file))
    .sort()
    .map((file) => {
      const base = file.replace(/\.sql$/, "");
      const [key, ...rest] = base.split("_");
      return { key, name: rest.join("_"), path: join(SUPABASE_DIR, file) };
    });
}

function listDrizzle(): MigrationRef[] {
  return readdirSync(DRIZZLE_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const base = file.replace(/\.sql$/, "");
      const [key, ...rest] = base.split("_");
      return { key, name: rest.join("_"), path: join(DRIZZLE_DIR, file) };
    });
}

const read = (path: string) => readFileSync(path, "utf8");

function main() {
  const supabase = listSupabase();
  const drizzle = listDrizzle();

  // 1. Nada já aplicado pode divergir: isso é corrupção, não tarefa pendente.
  const problems = findDivergences(pairMigrations(drizzle, supabase), read);
  if (problems.length > 0) {
    console.error("❌ Espelho divergente do original:");
    for (const problem of problems) console.error(`   · ${problem.name}: ${problem.reason}`);
    console.error("\nO drizzle guarda hash por arquivo: não reescreva uma migration já aplicada.");
    process.exit(1);
  }

  // 2. O que falta espelhar.
  const mirrored = new Set(drizzle.map((migration) => migration.name));
  const pending = supabase.filter((migration) => !mirrored.has(migration.name));

  const journalPath = join(META_DIR, "_journal.json");
  const journal = JSON.parse(read(journalPath)) as {
    version: string;
    dialect: string;
    entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
  };

  // 3. Journal desalinhado com o disco (arquivo criado à mão, merge, revert).
  //    Reconstruir é seguro: o drizzle identifica a migration pelo arquivo, e o
  //    `when` só serve de ordenação informativa.
  const reconciled = reconcileJournal(journal, drizzle.map((migration) => `${migration.key}_${migration.name}`));

  if (pending.length === 0) {
    if (reconciled) {
      writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
      console.log(`✅ Journal reconstruído: ${journal.entries.length} entradas para ${drizzle.length} espelhos.`);
      return;
    }
    console.log(`✅ Nada a fazer: ${drizzle.length} espelhos, todos fiéis a supabase/migrations/.`);
    return;
  }

  let nextIndex = journal.entries.length;
  let prevSnapshotId = lastSnapshotId(nextIndex - 1);
  let when = journal.entries.at(-1)?.when ?? Date.now();

  for (const migration of pending) {
    const tag = `${String(nextIndex).padStart(4, "0")}_${migration.name}`;
    const source = read(migration.path);
    const mirror = stripSqlComments(source);

    // Prova de que a remoção de comentário não comeu SQL.
    if (tokenStream(mirror) !== tokenStream(source)) {
      console.error(`❌ ${migration.name}: o espelho não é equivalente ao original. Abortado.`);
      process.exit(1);
    }

    writeFileSync(join(DRIZZLE_DIR, `${tag}.sql`), mirror);

    const snapshotId = randomUUID();
    const snapshot = {
      id: snapshotId,
      prevId: prevSnapshotId,
      version: "7",
      dialect: "postgresql",
      tables: {},
      enums: {},
      schemas: {},
      views: {},
      sequences: {},
      roles: {},
      policies: {},
      _meta: { columns: {}, schemas: {}, tables: {} },
    };
    writeFileSync(
      join(META_DIR, `${String(nextIndex).padStart(4, "0")}_snapshot.json`),
      `${JSON.stringify(snapshot, null, 2)}\n`,
    );

    prevSnapshotId = snapshotId;
    when += 12_000;
    journal.entries.push({
      idx: nextIndex,
      version: "7",
      when,
      tag,
      breakpoints: true,
    });

    console.log(`✅ ${tag}  ←  ${migration.key}_${migration.name}.sql`);
    nextIndex += 1;
  }

  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  console.log(`\n${pending.length} espelho(s) criado(s). Próximo passo: bun run check:migrations`);
}

function lastSnapshotId(index: number): string {
  for (let current = index; current >= 0; current -= 1) {
    const path = join(META_DIR, `${String(current).padStart(4, "0")}_snapshot.json`);
    if (existsSync(path)) return (JSON.parse(read(path)) as { id: string }).id;
  }
  return "";
}

main();

/**
 * Alinha `_journal.json` com os arquivos que existem em `drizzle/migrations/`.
 * Devolve `true` se mexeu em algo. Preserva o `when` das entradas que já existiam.
 */
function reconcileJournal(
  journal: { entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[] },
  tags: string[],
): boolean {
  const current = journal.entries.map((entry) => entry.tag);
  if (current.length === tags.length && current.every((tag, index) => tag === tags[index])) return false;

  const byTag = new Map(journal.entries.map((entry) => [entry.tag, entry]));
  let when = journal.entries.at(-1)?.when ?? Date.now();
  journal.entries = tags.map((tag, index) => {
    const existing = byTag.get(tag);
    if (existing) return { ...existing, idx: index };
    when += 12_000;
    return { idx: index, version: "7", when, tag, breakpoints: true };
  });
  return true;
}
