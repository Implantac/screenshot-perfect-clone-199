/**
 * Espelho das migrations: `supabase/migrations/` → `drizzle/migrations/`.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * O repositório tem duas árvores de migrations e só uma delas é executada:
 * `supabase/migrations/*.sql` é a fonte legível (comentários, o "por que");
 * `drizzle/migrations/*.sql` é o que o pipeline da Lovable roda de fato.
 *
 * Em 04/11/2026 o banco publicado tinha exatamente as 9 migrations que existiam
 * em `drizzle/` — as waves 14 a 28 estavam só em `supabase/` e nunca chegaram ao
 * banco. A causa não foi um erro de SQL: foi um arquivo que ninguém escreveu.
 *
 * A regra deste módulo: o espelho é derivado, nunca digitado. O texto do drizzle
 * é o da migration do Supabase **sem comentários** — e a prova de que nada se
 * perdeu é comparar o fluxo de tokens, que ignora espaço e comentário.
 *
 * O lexer abaixo respeita string literal ('...'), identificador aspeado ("...")
 * e dollar-quote ($$...$$ / $tag$...$tag$). Sem isso, um `--` dentro de uma
 * função PL/pgSQL ou de um literal seria tratado como comentário e o SQL sairia
 * corrompido — o tipo de bug que só aparece em produção.
 */

/** Arquivo de migration: `0009_portal_access` ou `20261030210000_portal_access`. */
export type MigrationRef = {
  /** Identificador ordenável: timestamp (supabase) ou índice (drizzle). */
  key: string;
  /** Nome curto usado nas duas árvores: `portal_access`. */
  name: string;
  path: string;
};

const DOLLAR_TAG = /\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/;

/** Remove comentários `--`, `/* ... *\/` e normaliza linhas em branco. */
export function stripSqlComments(source: string): string {
  const code = lex(source).code;
  const lines = code.split("\n").map((line) => line.replace(/\s+$/, ""));
  const kept: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" && kept.length > 0 && kept[kept.length - 1].trim() === "") continue;
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();
  while (kept.length > 0 && kept[0].trim() === "") kept.shift();
  return `${kept.join("\n")}\n`;
}

/**
 * Fluxo de tokens: o SQL sem espaço e sem comentário.
 *
 * Dois arquivos com o mesmo token stream executam exatamente as mesmas
 * instruções, mesmo que a formatação e os comentários sejam diferentes. É a
 * comparação que interessa aqui — não a igualdade byte a byte.
 */
export function tokenStream(source: string): string {
  return lex(source).code.replace(/\s+/g, "");
}

/** Número de `;` fora de string/dollar-quote — conferência grosseira de integridade. */
export function statementCount(source: string): number {
  return lex(source).statements;
}

function lex(source: string): { code: string; statements: number } {
  const out: string[] = [];
  let i = 0;
  let statements = 0;
  const n = source.length;

  while (i < n) {
    const char = source[i];

    // dollar-quote: corpo copiado inteiro, sem interpretar comentários dentro
    if (char === "$") {
      const tag = DOLLAR_TAG.exec(source.slice(i));
      if (tag) {
        const marker = tag[0];
        out.push(marker);
        i += marker.length;
        const end = source.indexOf(marker, i);
        if (end < 0) {
          out.push(source.slice(i));
          break;
        }
        const body = source.slice(i, end);
        out.push(body);
        for (const c of body) if (c === ";") statements += 1;
        out.push(marker);
        i = end + marker.length;
        continue;
      }
    }

    // string literal: '' é escape de aspas simples
    if (char === "'") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "'") {
          if (source[j + 1] === "'") {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      out.push(source.slice(i, j));
      i = j;
      continue;
    }

    // identificador aspeado
    if (char === '"') {
      let j = i + 1;
      while (j < n) {
        if (source[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      out.push(source.slice(i, j));
      i = j;
      continue;
    }

    if (source.startsWith("--", i)) {
      const end = source.indexOf("\n", i);
      i = end < 0 ? n : end;
      continue;
    }

    if (source.startsWith("/*", i)) {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (source.startsWith("/*", j)) {
          depth += 1;
          j += 2;
        } else if (source.startsWith("*/", j)) {
          depth -= 1;
          j += 2;
        } else {
          j += 1;
        }
      }
      i = j;
      out.push(" ");
      continue;
    }

    if (char === ";") statements += 1;
    out.push(char);
    i += 1;
  }

  return { code: out.join(""), statements };
}

/** Junta o par (drizzle, supabase) pelo nome curto da migration. */
export function pairMigrations(
  drizzle: MigrationRef[],
  supabase: MigrationRef[],
): { name: string; drizzle: MigrationRef; supabase: MigrationRef }[] {
  const byName = new Map(supabase.map((migration) => [migration.name, migration]));
  const pairs: { name: string; drizzle: MigrationRef; supabase: MigrationRef }[] = [];
  for (const mirror of drizzle) {
    const source = byName.get(mirror.name);
    if (source) pairs.push({ name: mirror.name, drizzle: mirror, supabase: source });
  }
  return pairs;
}

/**
 * Compara cada espelho com a origem e devolve as divergências.
 * Vazio = todo `drizzle/` é uma cópia fiel de algum `supabase/`.
 */
export function findDivergences(
  pairs: { name: string; drizzle: MigrationRef; supabase: MigrationRef }[],
  read: (path: string) => string,
): { name: string; reason: string }[] {
  const problems: { name: string; reason: string }[] = [];
  for (const pair of pairs) {
    const mirror = tokenStream(read(pair.drizzle.path));
    const source = tokenStream(read(pair.supabase.path));
    if (mirror !== source) problems.push({ name: pair.name, reason: "SQL diferente do original" });
  }
  return problems;
}
