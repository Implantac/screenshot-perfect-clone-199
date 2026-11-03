import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import {
  MIGRATIONS,
  MIGRATION_COUNT,
  expectedColumns,
  expectedTables,
} from "@/lib/observability/schema-manifest";
import {
  classifySeverity,
  createEvent,
  createRateLimiter,
  eventFromError,
  fingerprintOf,
  integrationStatuses,
  scrub,
  scrubContext,
  shouldSample,
  summarizeEvents,
  type SystemEvent,
} from "@/lib/observability/telemetry";

describe("depuração de PII", () => {
  it("remove e-mail", () => {
    expect(scrub("falhou para joao.silva@familia.com.br")).toBe("falhou para [e-mail removido]");
  });

  it("remove CPF e CNPJ", () => {
    expect(scrub("CPF 123.456.789-01 inválido")).toContain("[documento removido]");
    expect(scrub("CNPJ 12.345.678/0001-90 inválido")).toContain("[documento removido]");
  });

  it("remove UUID (id de cliente não precisa aparecer no log)", () => {
    expect(scrub("registro 11111111-1111-4111-8111-111111111111 não encontrado")).toBe(
      "registro [id removido] não encontrado",
    );
  });

  it("remove token/segredo com rótulo", () => {
    expect(scrub("header authorization: bearer abc.def.ghi")).toContain("[segredo removido]");
    expect(scrub("api_key=sk-live-12345")).toContain("[segredo removido]");
  });

  it("remove valor monetário (o número identifica a família)", () => {
    expect(scrub("patrimônio de R$ 12.345.678,90 vazou")).toBe("patrimônio de [valor removido] vazou");
  });

  it("contexto numérico é preservado (é diagnóstico, não PII)", () => {
    const context = scrubContext({ status: 401, durationMs: 2310, ok: false, detail: "joao@x.com" });
    expect(context.status).toBe(401);
    expect(context.durationMs).toBe(2310);
    expect(context.ok).toBe(false);
    expect(context.detail).toBe("[e-mail removido]");
  });

  it("valor longo é truncado em vez de virar coluna gigante", () => {
    const context = scrubContext({ stack: "x".repeat(2000) });
    expect(String(context.stack).length).toBe(400);
  });
});

describe("evento", () => {
  it("cria evento com fingerprint estável", () => {
    const a = createEvent({ kind: "error", source: "jarvis.ask", message: "falhou" });
    const b = createEvent({ kind: "error", source: "jarvis.ask", message: "falhou" });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.severity).toBe("critical");
  });

  it("fingerprint muda quando muda origem ou mensagem", () => {
    const base = fingerprintOf({ kind: "error", source: "a", message: "m" });
    expect(fingerprintOf({ kind: "error", source: "b", message: "m" })).not.toBe(base);
    expect(fingerprintOf({ kind: "error", source: "a", message: "n" })).not.toBe(base);
  });

  it("mensagem do evento já sai depurada", () => {
    const event = createEvent({
      kind: "error",
      source: "portal.grant",
      message: "convite para maria@familia.com falhou",
    });
    expect(event.message).not.toContain("maria@");
    expect(event.message).toContain("[e-mail removido]");
  });

  it("erro de autorização é aviso, não crítico", () => {
    expect(classifySeverity("error", "Unauthorized: Invalid token")).toBe("warning");
    expect(classifySeverity("error", "database connection timeout")).toBe("critical");
    expect(classifySeverity("security", "acesso negado sem escopo")).toBe("critical");
    expect(classifySeverity("slow", "consolidação levou 4s")).toBe("warning");
    expect(classifySeverity("client", "tela falhou")).toBe("info");
  });

  it("converte exceção em evento sem vazar a mensagem crua", () => {
    const event = eventFromError(new Error("falhou para joao@x.com com R$ 999,00"), {
      source: "office.consolidation",
      context: { durationMs: 4200 },
    });
    expect(event.kind).toBe("error");
    expect(event.message).not.toContain("joao@");
    expect(event.message).not.toContain("R$");
    expect(event.context.durationMs).toBe(4200);
    expect(event.context.errorName).toBe("Error");
  });

  it("erro que não é Error também vira evento", () => {
    const event = eventFromError("string solta", { source: "x" });
    expect(event.context.errorName).toBe("string");
  });
});

describe("limites", () => {
  it("amostragem determinística: mesmo fingerprint, mesma decisão", () => {
    const decisions = new Set([shouldSample("a1b2c3d4", 0.5), shouldSample("a1b2c3d4", 0.5)]);
    expect(decisions.size).toBe(1);
  });

  it("taxa 1 mantém tudo, taxa 0 descarta tudo", () => {
    expect(shouldSample("00000000", 1)).toBe(true);
    expect(shouldSample("00000000", 0)).toBe(false);
  });

  it("taxa aproxima a proporção esperada", () => {
    // Fingerprints reais vêm de `fingerprintOf`, que distribui melhor que um
    // contador — testar com contador mediria o teste, não a amostragem.
    const total = 1000;
    const kept = Array.from({ length: total }, (_, index) =>
      shouldSample(fingerprintOf({ kind: "error", source: "teste", message: `falha ${index}` }), 0.25),
    ).filter(Boolean).length;
    expect(kept).toBeGreaterThan(180);
    expect(kept).toBeLessThan(320);
  });

  it("limitador de taxa respeita o teto por minuto e reabre no minuto seguinte", () => {
    let agora = 1_000_000;
    const allow = createRateLimiter(2, () => agora);
    expect(allow()).toBe(true);
    expect(allow()).toBe(true);
    expect(allow()).toBe(false);
    agora += 60_000;
    expect(allow()).toBe(true);
  });
});

describe("resumo do painel", () => {
  const event = (over: Partial<SystemEvent>): SystemEvent => ({
    kind: "error",
    severity: "critical",
    source: "jarvis.ask",
    message: "falhou ao chamar o provedor",
    context: {},
    occurredAt: "2026-11-03T12:00:00.000Z",
    fingerprint: "aaaa1111",
    ...over,
  });

  it("sem evento, estado ok e frase explícita", () => {
    const summary = summarizeEvents([]);
    expect(summary.status).toBe("ok");
    expect(summary.headline).toContain("Nenhum evento");
    expect(summary.lastEventAt).toBeNull();
  });

  it("crítico derruba o estado para fora", () => {
    const summary = summarizeEvents([event({})]);
    expect(summary.status).toBe("fora");
    expect(summary.bySeverity.critical).toBe(1);
  });

  it("só aviso é degradado, não fora", () => {
    const summary = summarizeEvents([event({ severity: "warning" })]);
    expect(summary.status).toBe("degradado");
  });

  it("só informativo é ok", () => {
    const summary = summarizeEvents([event({ severity: "info", kind: "client" })]);
    expect(summary.status).toBe("ok");
  });

  it("agrupa por fingerprint e ordena por frequência", () => {
    const summary = summarizeEvents([
      event({ fingerprint: "raro" }),
      event({ fingerprint: "comum" }),
      event({ fingerprint: "comum" }),
      event({ fingerprint: "comum" }),
    ]);
    expect(summary.top[0]?.fingerprint).toBe("comum");
    expect(summary.top[0]?.count).toBe(3);
    expect(summary.total).toBe(4);
  });

  it("mantém o lastSeen mais recente do grupo", () => {
    const summary = summarizeEvents([
      event({ fingerprint: "x", occurredAt: "2026-11-01T00:00:00.000Z" }),
      event({ fingerprint: "x", occurredAt: "2026-11-03T00:00:00.000Z" }),
    ]);
    expect(summary.top[0]?.lastSeen).toBe("2026-11-03T00:00:00.000Z");
    expect(summary.lastEventAt).toBe("2026-11-03T00:00:00.000Z");
  });

  it("conta por tipo", () => {
    const summary = summarizeEvents([
      event({ kind: "error", fingerprint: "a" }),
      event({ kind: "slow", fingerprint: "b" }),
      event({ kind: "slow", fingerprint: "c" }),
    ]);
    expect(summary.byKind[0]).toEqual({ kind: "slow", count: 2 });
  });
});

describe("status das integrações", () => {
  it("base completa: tudo ok", () => {
    const statuses = integrationStatuses({
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "chave-publica-longa",
      JARVIS_LLM_PROVIDER: "openai",
      JARVIS_LLM_API_KEY: "sk-chave-longa-o-suficiente",
      AUDIT_SIGNING_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----",
      AUDIT_SIGNING_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----",
      OBSERVABILITY_WEBHOOK_URL: "https://hooks.exemplo.com/x",
    });
    expect(statuses.every((status) => status.severity === "ok")).toBe(true);
  });

  it("sem Supabase é crítico", () => {
    const supabase = integrationStatuses({}).find((status) => status.key === "supabase");
    expect(supabase?.severity).toBe("critical");
  });

  it("sem chave de IA é aviso, não crítico (ferramentas seguem funcionando)", () => {
    const llm = integrationStatuses({ SUPABASE_URL: "https://x", SUPABASE_PUBLISHABLE_KEY: "k".repeat(20) }).find(
      (status) => status.key === "llm",
    );
    expect(llm?.severity).toBe("warning");
    expect(llm?.detail).toContain("analista local");
  });

  it("HMAC é aviso com recomendação de migrar", () => {
    const signing = integrationStatuses({ AUDIT_SIGNING_SECRET: "x".repeat(40) }).find(
      (status) => status.key === "signing",
    );
    expect(signing?.severity).toBe("warning");
    expect(signing?.detail).toContain("Migre");
  });

  it("par assimétrico é ok e diz que o auditor verifica sozinho", () => {
    const signing = integrationStatuses({
      AUDIT_SIGNING_PRIVATE_KEY: "p".repeat(30),
      AUDIT_SIGNING_PUBLIC_KEY: "p".repeat(30),
    }).find((status) => status.key === "signing");
    expect(signing?.severity).toBe("ok");
    expect(signing?.detail).toContain("verifica sozinho");
  });

  it("detecta provedor pela chave quando a variável explícita falta", () => {
    const llm = integrationStatuses({ OPENAI_API_KEY: "sk-".padEnd(40, "x") }).find((status) => status.key === "llm");
    expect(llm?.detail).toContain("openai");
  });
});

/**
 * O teste que impede o manifesto de virar documentação morta: cada arquivo em
 * `supabase/migrations` precisa ter entrada, e cada entrada precisa ter arquivo.
 */
describe("manifesto x arquivos em disco", () => {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const listed = MIGRATIONS.map((migration) => migration.file).sort();

  it("todo arquivo de migration está no manifesto", () => {
    const missing = files.filter((file) => !listed.includes(file));
    expect(missing).toEqual([]);
  });

  it("toda entrada do manifesto existe em disco", () => {
    const ghosts = listed.filter((file) => !files.includes(file));
    expect(ghosts).toEqual([]);
  });

  it("a contagem publicada no README/docs bate com o manifesto", () => {
    expect(MIGRATION_COUNT).toBe(files.length);
    expect(MIGRATION_COUNT).toBe(28);
  });

  it("as tabelas declaradas realmente aparecem no SQL da migration", () => {
    for (const migration of MIGRATIONS) {
      if (migration.tables.length === 0) continue;
      const sql = readFileSync(join(dir, migration.file), "utf8");
      for (const table of migration.tables) {
        expect(sql).toContain(table);
      }
    }
  });

  it("as colunas declaradas aparecem no SQL da migration", () => {
    for (const migration of MIGRATIONS) {
      if (migration.columns.length === 0) continue;
      const sql = readFileSync(join(dir, migration.file), "utf8");
      for (const entry of migration.columns) {
        const column = entry.split(".")[1] ?? entry;
        expect(sql).toContain(column);
      }
    }
  });

  it("nenhuma tabela criada no SQL fica fora do manifesto", () => {
    // O teste que fecha o buraco: o manifesto já nasceu incompleto (as migrations
    // da wave 1 criavam tabelas sem estarem listadas). Aqui o SQL é lido de
    // verdade e cada CREATE TABLE precisa de entrada.
    const missing: string[] = [];
    for (const migration of MIGRATIONS) {
      const sql = readFileSync(join(dir, migration.file), "utf8");
      const created = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_]+)/gi)].map(
        (match) => match[1] as string,
      );
      for (const table of created) {
        if (!migration.tables.includes(table)) missing.push(`${migration.file} → ${table}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("não há tabela esperada duplicada entre migrations", () => {
    const tables = expectedTables().map((item) => item.table);
    expect(new Set(tables).size).toBe(tables.length);
  });

  it("toda coluna esperada aponta para uma tabela conhecida", () => {
    const tables = new Set([
      ...expectedTables().map((item) => item.table),
      "audit_logs",
      "office_clients",
      "audit_anchors",
    ]);
    for (const column of expectedColumns()) {
      expect(tables.has(column.table)).toBe(true);
    }
  });

  it("a última migration do manifesto é a mais recente em disco", () => {
    expect(MIGRATIONS[MIGRATIONS.length - 1]?.file).toBe(files[files.length - 1]);
  });
});
