/**
 * Guarda-corpo do espelho de migrations (ver `drizzle/README.md`).
 *
 * O bug que este teste teria pegado: em 04/11/2026 as waves 14 a 28 existiam em
 * `supabase/migrations/` e nunca chegaram ao banco, porque o pipeline da Lovable
 * só executa `drizzle/migrations/`. Nenhum teste falhou — não havia teste.
 *
 * Aqui a regra é mecânica: para cada arquivo em `drizzle/migrations/`, existe uma
 * migration em `supabase/migrations/` com o **mesmo fluxo de tokens**. Comparar
 * token, e não texto, é de propósito: o espelho é gerado sem comentários; o que
 * tem de ser idêntico é o SQL que executa.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  findDivergences,
  pairMigrations,
  statementCount,
  stripSqlComments,
  tokenStream,
} from "../../../scripts/migration-mirror";

const ROOT = join(import.meta.dir, "..", "..", "..");
const SUPABASE_DIR = join(ROOT, "supabase", "migrations");
const DRIZZLE_DIR = join(ROOT, "drizzle", "migrations");
const META_DIR = join(DRIZZLE_DIR, "meta");

const read = (path: string) => readFileSync(path, "utf8");

function refs(dir: string, filter: (file: string) => boolean) {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql") && filter(file))
    .sort()
    .map((file) => {
      const base = file.replace(/\.sql$/, "");
      const [key, ...rest] = base.split("_");
      return { key, name: rest.join("_"), path: join(dir, file) };
    });
}

// Esquema inicial criado junto com o projeto: aplicado pela Lovable, sem espelho.
const supabase = refs(SUPABASE_DIR, (file) => !file.startsWith("20260610"));
const drizzle = refs(DRIZZLE_DIR, () => true);

describe("espelho supabase → drizzle", () => {
  test("toda migration do Supabase tem espelho em drizzle/", () => {
    const mirrored = new Set(drizzle.map((migration) => migration.name));
    const missing = supabase.filter((migration) => !mirrored.has(migration.name));
    expect(missing.map((migration) => migration.name)).toEqual([]);
  });

  test("nenhum espelho sobra sem origem no Supabase", () => {
    const source = new Set(supabase.map((migration) => migration.name));
    const orphans = drizzle.filter((migration) => !source.has(migration.name));
    expect(orphans.map((migration) => migration.name)).toEqual([]);
  });

  test("o SQL de cada espelho é idêntico ao original (ignorando comentário e espaço)", () => {
    expect(findDivergences(pairMigrations(drizzle, supabase), read)).toEqual([]);
  });

  test("o journal cobre todos os espelhos, em ordem, a partir de 0", () => {
    const journal = JSON.parse(read(join(META_DIR, "_journal.json"))) as {
      entries: { idx: number; tag: string }[];
    };
    expect(journal.entries.map((entry) => entry.tag)).toEqual(
      drizzle.map((migration) => `${migration.key}_${migration.name}`),
    );
    expect(journal.entries.map((entry) => entry.idx)).toEqual(drizzle.map((_, index) => index));
  });

  test("cada entrada do journal tem snapshot encadeado ao anterior", () => {
    const journal = JSON.parse(read(join(META_DIR, "_journal.json"))) as {
      entries: { idx: number; tag: string }[];
    };
    // O primeiro snapshot aponta para o sentinela de "sem anterior" do drizzle;
    // do segundo em diante, `prevId` é sempre o `id` do snapshot anterior.
    const NO_PREVIOUS = "00000000-0000-0000-0000-000000000000";
    let previousId = NO_PREVIOUS;
    for (const entry of journal.entries) {
      const path = join(META_DIR, `${String(entry.idx).padStart(4, "0")}_snapshot.json`);
      const snapshot = JSON.parse(read(path)) as { id: string; prevId: string };
      expect(snapshot.id).not.toBe(previousId);
      expect(snapshot.prevId).toBe(previousId);
      previousId = snapshot.id;
    }
  });

  test("a remoção de comentário não perde statement", () => {
    for (const pair of pairMigrations(drizzle, supabase)) {
      const source = read(pair.supabase.path);
      expect(statementCount(stripSqlComments(source))).toBe(statementCount(source));
    }
  });
});

describe("lexer de comentários", () => {
  test("não trata `--` dentro de string literal como comentário", () => {
    const sql = "select 'a -- b' as txt; -- comentário de verdade\nselect 1;";
    expect(tokenStream(stripSqlComments(sql))).toBe("select'a--b'astxt;select1;");
  });

  test("preserva o corpo em dollar-quote inteiro (comentário do corpo fica)", () => {
    const sql = [
      "create function f() returns void as $$",
      "begin",
      "  -- comentário dentro do corpo: fica",
      "  perform 'x';",
      "end $$ language plpgsql;",
    ].join("\n");
    const stripped = stripSqlComments(sql);
    // O corpo de `$$ ... $$` é copiado literalmente: `--` lá dentro é do corpo da
    // função, não do arquivo. Tirar seria reescrever o que o autor escreveu.
    expect(stripped).toContain("comentário dentro do corpo: fica");
    expect(stripped).toContain("perform 'x';");
    // Já o fluxo de tokens ignora comentário, então a equivalência vale.
    expect(tokenStream(stripped)).toBe(
      "createfunctionf()returnsvoidas$$begin--comentáriodentrodocorpo:ficaperform'x';end$$languageplpgsql;",
    );
  });

  test("comentário de bloco aninhado não engole código", () => {
    const sql = "/* a /* b */ c */ select 42;";
    expect(tokenStream(stripSqlComments(sql))).toBe("select42;");
  });

  test("aspas simples escapadas com '' não terminam a string antes da hora", () => {
    const sql = "select 'd''água -- nao e comentario';";
    expect(tokenStream(stripSqlComments(sql))).toBe("select'd''água--naoecomentario';");
  });
});
