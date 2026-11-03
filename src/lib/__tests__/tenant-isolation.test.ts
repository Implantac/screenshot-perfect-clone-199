import { describe, expect, it } from "bun:test";
import {
  assessIsolation,
  classifyPolicy,
  isScopingPredicate,
  normalizePredicate,
  type IsolationPolicyRow,
  type OrphanRow,
} from "@/lib/security/isolation";

const policy = (over: Partial<IsolationPolicyRow>): IsolationPolicyRow => ({
  table_name: "assets",
  policy_name: "Owners manage assets",
  cmd: "ALL",
  qual: "public.owns_entity(entity_id)",
  with_check: "public.owns_entity(entity_id)",
  ...over,
});

describe("classificação de predicado", () => {
  it("normaliza espaços, parênteses e cast", () => {
    expect(normalizePredicate(" ( auth.role() = 'authenticated'::text ) ")).toBe("auth.role='authenticated'");
    expect(normalizePredicate("TRUE")).toBe("true");
    expect(normalizePredicate(null)).toBe("");
  });

  it("policy com `true` é vazamento crítico", () => {
    const result = classifyPolicy({ table_name: "risks", qual: "true" });
    expect(result.verdict).toBe("vazamento");
    expect(result.severity).toBe("critical");
    expect(result.reason).toContain("sem predicado");
  });

  it("policy legada por papel é vazamento crítico", () => {
    const result = classifyPolicy({ table_name: "documents", qual: "auth.role() = 'authenticated'" });
    expect(result.verdict).toBe("vazamento");
    expect(result.reason).toContain("OR");
  });

  it("policy escopada por entidade passa", () => {
    expect(classifyPolicy(policy({ qual: "public.owns_entity(entity_id)" })).verdict).toBe("ok");
  });

  it("policy escopada por dono passa", () => {
    expect(classifyPolicy(policy({ table_name: "entities", qual: "owner_user_id = auth.uid()" })).verdict).toBe("ok");
  });

  it("tabela de mercado é compartilhada de propósito", () => {
    const result = classifyPolicy({ table_name: "quotes", qual: "true" });
    expect(result.verdict).toBe("compartilhado");
    expect(result.severity).toBe("info");
  });

  it("custodians idem", () => {
    expect(classifyPolicy({ table_name: "custodians", qual: "true" }).verdict).toBe("compartilhado");
  });

  it("reconhece predicado de escopo pelas funções reais do projeto", () => {
    expect(isScopingPredicate("public.owns_entity(entity_id)")).toBe(true);
    expect(isScopingPredicate("owner_user_id = auth.uid()")).toBe(true);
    expect(isScopingPredicate("public.office_can_read_tenant(owner_user_id)")).toBe(true);
    expect(isScopingPredicate("EXISTS (SELECT 1 FROM legal_cases c WHERE c.id = case_id AND public.owns_entity(c.entity_id))")).toBe(true);
    expect(isScopingPredicate("true")).toBe(false);
    expect(isScopingPredicate("")).toBe(false);
    expect(isScopingPredicate("auth.role() = 'authenticated'")).toBe(false);
  });
});

describe("relatório de isolamento", () => {
  it("base limpa: isolado, nota 100, sem recomendação de correção", () => {
    const report = assessIsolation({
      policies: [
        policy({}),
        policy({ table_name: "entities", policy_name: "Owners manage entities", qual: "owner_user_id = auth.uid()" }),
      ],
      expectedTables: ["assets", "entities"],
    });
    expect(report.status).toBe("isolado");
    expect(report.score).toBe(100);
    expect(report.totals.leaks).toBe(0);
    expect(report.recommendations[0]).toContain("Nenhum achado");
  });

  it("uma policy permissiva derruba o status para crítico", () => {
    const report = assessIsolation({
      policies: [
        policy({}),
        policy({ policy_name: "Full access to authenticated users", qual: "auth.role() = 'authenticated'" }),
      ],
      expectedTables: ["assets"],
    });
    expect(report.status).toBe("critico");
    expect(report.totals.leaks).toBe(1);
    expect(report.score).toBe(75);
    expect(report.tables[0]?.status).toBe("vazando");
  });

  it("cada vazamento adicional pesa na nota", () => {
    const report = assessIsolation({
      policies: [
        policy({ policy_name: "legado", qual: "true" }),
        policy({ table_name: "risks", policy_name: "legado", qual: "true" }),
        policy({ table_name: "documents", policy_name: "legado", qual: "true" }),
      ],
    });
    expect(report.totals.leaks).toBe(3);
    expect(report.score).toBe(25);
  });

  it("órfãos sem vazamento viram atenção, não crítico", () => {
    const orphans: OrphanRow[] = [{ table_name: "assets", tenant_column: "entity_id", orphan_rows: 4 }];
    const report = assessIsolation({ policies: [policy({})], orphans, expectedTables: ["assets"] });
    expect(report.status).toBe("atencao");
    expect(report.tables[0]?.status).toBe("quarentena");
    expect(report.tables[0]?.detail).toContain("apenas para admin");
    expect(report.recommendations.join(" ")).toContain("Adotar as linhas órfãs");
  });

  it("órfãos como string (numeric do Postgres) são lidos", () => {
    const report = assessIsolation({
      policies: [policy({})],
      orphans: [{ table_name: "assets", tenant_column: "entity_id", orphan_rows: "12" as unknown as number }],
      expectedTables: ["assets"],
    });
    expect(report.totals.orphanRows).toBe(12);
  });

  it("tabela com policy e nenhum escopo é vazamento mesmo sem `true` explícito", () => {
    const report = assessIsolation({
      policies: [policy({ qual: "status = 'ativo'" })],
      expectedTables: ["assets"],
    });
    expect(report.tables[0]?.status).toBe("vazando");
    expect(report.tables[0]?.hasScoping).toBe(false);
    expect(report.tables[0]?.detail).toContain("Nenhuma policy amarra");
  });

  it("tabela sem policy nenhuma é isolado (RLS nega por padrão)", () => {
    const report = assessIsolation({ policies: [], expectedTables: ["tax_scenarios"] });
    expect(report.tables[0]?.status).toBe("isolado");
    expect(report.tables[0]?.detail).toContain("RLS sem acesso");
  });

  it("tabela de mercado com policy `true` não conta como vazamento", () => {
    const report = assessIsolation({
      policies: [policy({ table_name: "quotes", policy_name: "Market data", qual: "true" })],
      expectedTables: ["quotes"],
    });
    expect(report.totals.leaks).toBe(0);
    expect(report.status).toBe("isolado");
    expect(report.warnings.join(" ")).toContain("propósito");
  });

  it("achados vêm ordenados por severidade", () => {
    const report = assessIsolation({
      policies: [
        policy({ table_name: "quotes", qual: "true" }),
        policy({ table_name: "assets", policy_name: "vaza", qual: "true" }),
        policy({}),
      ],
      expectedTables: ["assets", "quotes"],
    });
    expect(report.findings[0]?.severity).toBe("critical");
    expect(report.findings[report.findings.length - 1]?.severity).toBe("info");
  });

  it("responde vazio com aviso quando a RPC não devolveu nada", () => {
    const report = assessIsolation({ policies: [] });
    expect(report.totals.tablesChecked).toBe(0);
    expect(report.warnings.join(" ")).toContain("20261030280000");
  });

  it("sempre declara o limite da detecção", () => {
    const report = assessIsolation({ policies: [policy({})] });
    expect(report.warnings.join(" ")).toContain("não é prova de correção");
  });

  it("soma órfãos de várias tabelas", () => {
    const report = assessIsolation({
      policies: [policy({}), policy({ table_name: "risks", qual: "public.owns_entity(entity_id)" })],
      orphans: [
        { table_name: "assets", tenant_column: "entity_id", orphan_rows: 2 },
        { table_name: "risks", tenant_column: "entity_id", orphan_rows: 3 },
        { table_name: "documents", tenant_column: "entity_id", orphan_rows: 0 },
      ],
      expectedTables: ["assets", "risks"],
    });
    expect(report.totals.orphanRows).toBe(5);
  });
});
