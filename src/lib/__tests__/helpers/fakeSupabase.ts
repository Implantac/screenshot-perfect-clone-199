/**
 * Dublê mínimo de Supabase para testar a máquina de estados das propostas.
 *
 * Não tenta emular PostgREST inteiro: cobre só o encadeamento que o código usa
 * (insert/select/update com eq, order, limit, single, maybeSingle). Se um dia o
 * código usar outro encadeamento, o teste falha no `throw` abaixo — de propósito,
 * para o dublê não virar ficção.
 */

type Row = Record<string, unknown>;

export type FakeOptions = {
  /** Força erro em um insert (para exercitar o caminho de falha). */
  failInsertOn?: string;
  failUpdateOn?: string;
};

class Builder {
  private filters: [string, unknown][] = [];
  private action: "select" | "insert" | "update" = "select";
  private payload: Row | Row[] | null = null;
  private ordering: { column: string; ascending: boolean } | null = null;
  private max: number | null = null;

  constructor(
    private readonly db: FakeDatabase,
    private readonly table: string,
  ) {}

  insert(payload: Row | Row[]) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.ordering = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.max = count;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private run(): { data: Row | Row[] | null; error: { message: string } | null } {
    if (this.action === "insert") {
      if (this.db.options.failInsertOn === this.table) {
        return { data: null, error: { message: "insert simulado falhou" } };
      }
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload ?? {}]).map((row) =>
        this.db.insertRow(this.table, row),
      );
      return { data: Array.isArray(this.payload) ? rows : (rows[0] ?? null), error: null };
    }

    if (this.action === "update") {
      if (this.db.options.failUpdateOn === this.table) {
        return { data: null, error: { message: "update simulado falhou" } };
      }
      const updated = this.db.updateRows(this.table, (row) => this.matches(row), this.payload as Row);
      return { data: updated[0] ?? null, error: null };
    }

    let rows = (this.db.tables[this.table] ?? []).filter((row) => this.matches(row));
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows = [...rows].sort((a, b) =>
        String(a[column] ?? "") < String(b[column] ?? "")
          ? ascending
            ? -1
            : 1
          : ascending
            ? 1
            : -1,
      );
    }
    if (this.max !== null) rows = rows.slice(0, this.max);
    return { data: rows, error: null };
  }

  single() {
    const { data, error } = this.run();
    if (error) return Promise.resolve({ data: null, error });
    const row = Array.isArray(data) ? (data[0] ?? null) : data;
    if (!row) return Promise.resolve({ data: null, error: { message: "nenhuma linha" } });
    return Promise.resolve({ data: row, error: null });
  }

  maybeSingle() {
    const { data, error } = this.run();
    if (error) return Promise.resolve({ data: null, error });
    const row = Array.isArray(data) ? (data[0] ?? null) : data;
    return Promise.resolve({ data: row, error: null });
  }

  then<T>(resolve: (value: { data: Row[] | null; error: { message: string } | null }) => T) {
    const { data, error } = this.run();
    return Promise.resolve(resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error }));
  }
}

export class FakeDatabase {
  tables: Record<string, Row[]> = {};
  options: FakeOptions;
  private counter = 0;

  constructor(options: FakeOptions = {}) {
    this.options = options;
  }

  insertRow(table: string, row: Row): Row {
    this.counter += 1;
    const created = {
      id: `00000000-0000-4000-8000-${String(this.counter).padStart(12, "0")}`,
      created_at: new Date(Date.UTC(2026, 9, 30, 12, 0, this.counter)).toISOString(),
      ...row,
    };
    this.tables[table] = [...(this.tables[table] ?? []), created];
    return created;
  }

  updateRows(table: string, predicate: (row: Row) => boolean, patch: Row): Row[] {
    const updated: Row[] = [];
    this.tables[table] = (this.tables[table] ?? []).map((row) => {
      if (!predicate(row)) return row;
      const next = { ...row, ...patch };
      updated.push(next);
      return next;
    });
    return updated;
  }

  from(table: string) {
    return new Builder(this, table);
  }

  /** Atalho de leitura nos testes. */
  rows(table: string): Row[] {
    return this.tables[table] ?? [];
  }
}

/** Cast para o tipo esperado pelo código de produção, só nos testes. */
export function asClient(db: FakeDatabase) {
  return db as unknown as never;
}
