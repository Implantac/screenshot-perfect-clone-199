/**
 * Isolamento entre tenants — régua da wave 23.
 *
 * O problema que este módulo resolve é específico e conhecido: em Postgres,
 * políticas RLS **permissivas se somam com OR**. Uma policy antiga
 * `USING (auth.role() = 'authenticated')` convivendo com a policy por dono não
 * "reforça" nada — ela anula, porque basta uma condição verdadeira.
 *
 * Aqui não há I/O: entram as linhas de `pg_policies` (via RPC
 * `patrium_isolation_audit()`) e as contagens de órfãos, sai o veredito por
 * tabela, a nota do conjunto e o que fazer. A tela de segurança só desenha.
 *
 * Regra de honestidade: este módulo **detecta o que sabe detectar** — policy sem
 * predicado, policy legada por papel e linha sem dono. Ele não prova que uma
 * expressão SQL complexa está correta; por isso o veredito é "sem achados", não
 * "auditado e correto".
 */

export type IsolationPolicyRow = {
  table_name: string;
  policy_name: string;
  cmd: string;
  qual: string;
  with_check: string;
  /** Já classificado pelo banco; recalculado aqui para o teste não depender do SQL. */
  verdict?: string;
  detail?: string;
};

export type OrphanRow = {
  table_name: string;
  tenant_column: string;
  orphan_rows: number | string;
};

export type PolicyVerdict = "vazamento" | "compartilhado" | "ok";

export type IsolationFinding = {
  table: string;
  policy: string;
  cmd: string;
  verdict: PolicyVerdict;
  reason: string;
  severity: "critical" | "warning" | "info";
};

export type TableIsolation = {
  table: string;
  policies: number;
  scoped: number;
  leaks: number;
  /** Existe ao menos uma policy que amarra a linha a um dono/entidade. */
  hasScoping: boolean;
  orphanRows: number;
  status: "isolado" | "quarentena" | "vazando";
  detail: string;
};

export type IsolationReport = {
  generatedAt: string;
  tables: TableIsolation[];
  findings: IsolationFinding[];
  totals: {
    tablesChecked: number;
    policiesChecked: number;
    leaks: number;
    orphanRows: number;
    tablesWithoutScoping: number;
  };
  score: number;
  status: "isolado" | "atencao" | "critico";
  recommendations: string[];
  warnings: string[];
};

/** Dado de mercado/referência: leitura compartilhada é intencional. */
const SHARED_TABLES = new Set(["quotes", "quote_runs", "custodians", "security_policies"]);

/**
 * Normaliza a expressão para comparar sem depender de espaços, parênteses ou
 * cast. `auth.role() = 'authenticated'::text` vira `auth.role='authenticated'`.
 */
export function normalizePredicate(expression: string | null | undefined): string {
  return String(expression ?? "")
    .toLowerCase()
    .replace(/::[a-z ]+/g, "")
    .replace(/[\s()]/g, "");
}

/**
 * Classifica uma policy.
 *
 * `true` puro é o caso mais grave; `auth.role() = 'authenticated'` é o legado que
 * veio do template inicial. Ambos são detectados pelo predicado, não pelo nome —
 * nome de policy não é contrato.
 */
export function classifyPolicy(row: Pick<IsolationPolicyRow, "table_name" | "qual">): {
  verdict: PolicyVerdict;
  reason: string;
  severity: IsolationFinding["severity"];
} {
  if (SHARED_TABLES.has(row.table_name)) {
    return {
      verdict: "compartilhado",
      reason: "Leitura compartilhada intencional (dado de mercado ou de referência).",
      severity: "info",
    };
  }

  const qual = normalizePredicate(row.qual);

  if (qual === "true") {
    return {
      verdict: "vazamento",
      reason: "Policy sem predicado: qualquer sessão autenticada alcança linhas de outro tenant.",
      severity: "critical",
    };
  }

  if (qual.includes("auth.role='authenticated'") || qual.includes("auth.role=authenticated")) {
    return {
      verdict: "vazamento",
      reason: "Policy por papel (legado): soma com OR e anula a policy por entidade/dono.",
      severity: "critical",
    };
  }

  return {
    verdict: "ok",
    reason: "Escopada por dono, entidade ou escritório.",
    severity: "info",
  };
}

/** Uma policy conta como "escopada" quando amarra a linha a um dono. */
export function isScopingPredicate(qual: string | null | undefined): boolean {
  const text = normalizePredicate(qual);
  if (!text || text === "true") return false;
  return (
    text.includes("owns_entity") ||
    text.includes("owner_user_id=auth.uid") ||
    text.includes("office_can_read_tenant") ||
    text.includes("user_id=auth.uid") ||
    text.includes("has_roleauth.uid,'admin'") ||
    text.includes("auth.uid")
  );
}

export type AssessIsolationInput = {
  policies: IsolationPolicyRow[];
  orphans?: OrphanRow[];
  /** Tabelas que a migration de isolamento declara como tenant (ordem de exibição). */
  expectedTables?: string[];
  generatedAt?: string;
};

export function assessIsolation(input: AssessIsolationInput): IsolationReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const warnings: string[] = [];

  const findings: IsolationFinding[] = input.policies.map((row) => {
    const classification = classifyPolicy(row);
    return {
      table: row.table_name,
      policy: row.policy_name,
      cmd: row.cmd,
      verdict: classification.verdict,
      reason: classification.reason,
      severity: classification.severity,
    };
  });

  const orphanMap = new Map<string, number>();
  for (const row of input.orphans ?? []) {
    const count = Number(row.orphan_rows ?? 0);
    if (Number.isFinite(count) && count > 0) orphanMap.set(row.table_name, count);
  }

  const tablesSeen = Array.from(
    new Set([...(input.expectedTables ?? []), ...input.policies.map((row) => row.table_name)]),
  );

  const tables: TableIsolation[] = tablesSeen.map((table) => {
    const rows = input.policies.filter((row) => row.table_name === table);
    const tableFindings = findings.filter((finding) => finding.table === table);
    const leaks = tableFindings.filter((finding) => finding.verdict === "vazamento").length;
    const scoped = rows.filter((row) => isScopingPredicate(row.qual)).length;
    const orphanRows = orphanMap.get(table) ?? 0;
    const hasScoping = scoped > 0;

    let status: TableIsolation["status"] = "isolado";
    let detail = "Escopada por dono; nenhuma linha órfã.";

    if (leaks > 0) {
      status = "vazando";
      detail = `${leaks} policy(s) sem escopo de tenant — dado de outro tenant alcançável.`;
    } else if (orphanRows > 0) {
      status = "quarentena";
      detail = `${orphanRows} linha(s) sem vínculo de tenant: visíveis apenas para admin até serem adotadas.`;
    } else if (!hasScoping && rows.length > 0) {
      status = "vazando";
      detail = "Nenhuma policy amarra a linha a um dono — isolar antes de liberar o módulo.";
    } else if (rows.length === 0) {
      status = "isolado";
      detail = "Sem policy declarada (RLS sem acesso) — nada exposto.";
    }

    return { table, policies: rows.length, scoped, leaks, hasScoping, orphanRows, status, detail };
  });

  const leaks = findings.filter((finding) => finding.verdict === "vazamento").length;
  const orphanRows = tables.reduce((sum, table) => sum + table.orphanRows, 0);
  // Conta só a tabela que **não** tem vazamento declarado e ainda assim não tem
  // predicado de escopo: caso contrário o mesmo defeito pesaria duas vezes na nota.
  const tablesWithoutScoping = tables.filter(
    (table) => table.leaks === 0 && !table.hasScoping && table.policies > 0,
  ).length;

  // Nota: cada vazamento pesa mais que uma linha órfã, porque vazamento é
  // exposição de dado de terceiro; órfão é dado invisível (risco operacional).
  const score = Math.max(0, 100 - leaks * 25 - Math.min(20, orphanRows > 0 ? 5 + Math.log10(orphanRows + 1) * 5 : 0) - tablesWithoutScoping * 10);
  const rounded = Math.round(score);

  const status: IsolationReport["status"] = leaks > 0 ? "critico" : orphanRows > 0 ? "atencao" : "isolado";

  const recommendations: string[] = [];
  if (leaks > 0) {
    recommendations.push(
      "Remover as policies sem predicado e as legadas por papel: em RLS permissivo elas se somam com OR e anulam a policy por dono.",
    );
    recommendations.push(
      "Depois de remover, conferir cada tabela de tenant: sem policy escopada, ninguém lê nada (RLS padrão é negar).",
    );
  }
  if (orphanRows > 0) {
    recommendations.push(
      "Adotar as linhas órfãs para uma entidade (UPDATE ... SET entity_id = <uuid>) ou removê-las com decisão registrada — hoje elas estão em quarentena para admin.",
    );
  }
  if (leaks === 0 && orphanRows === 0 && tables.length > 0) {
    recommendations.push("Nenhum achado: manter o teste como rotina antes de cada liberação de módulo novo.");
  }
  if (tables.length === 0) {
    warnings.push("Nenhuma policy retornada: a migration 20261030280000 foi aplicada nesta base?");
  }

  if (findings.some((finding) => finding.verdict === "compartilhado")) {
    warnings.push(
      "Tabelas de mercado/referência (quotes, custodians…) são lidas por todos de propósito — não confundir com vazamento.",
    );
  }

  warnings.push(
    "Detecção por predicado: policy com expressão complexa é classificada como escopada. Ausência de achado não é prova de correção.",
  );

  return {
    generatedAt,
    tables,
    findings: findings.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 } as const;
      return order[a.severity] - order[b.severity] || a.table.localeCompare(b.table);
    }),
    totals: {
      tablesChecked: tables.length,
      policiesChecked: findings.length,
      leaks,
      orphanRows,
      tablesWithoutScoping,
    },
    score: rounded,
    status,
    recommendations,
    warnings,
  };
}
