import { describe, expect, it } from "bun:test";
import {
  OFFICE_SCOPES,
  hasScope,
  missingScopes,
  normalizeFamilyDetail,
  parseScopes,
  summarizeAccessLog,
  validateScopeSelection,
  type AccessLogRow,
  type FamilyDetailPayload,
} from "@/lib/office/access";

describe("escopos", () => {
  it("default mínimo é só o resumo", () => {
    expect(parseScopes(null)).toEqual(["resumo"]);
    expect(parseScopes([])).toEqual(["resumo"]);
  });

  it("resumo é sempre incluído, mesmo que a seleção o omita", () => {
    expect(parseScopes(["agro"])).toEqual(["resumo", "agro"]);
  });

  it("descarta escopo desconhecido vindo do banco", () => {
    expect(parseScopes(["resumo", "tudo", "root"])).toEqual(["resumo"]);
  });

  it("lê o formato cru do Postgres (`{resumo,agro}`)", () => {
    expect(parseScopes("{resumo,agro}")).toEqual(["resumo", "agro"]);
  });

  it("mantém a ordem canônica, não a ordem de chegada", () => {
    expect(parseScopes(["riscos", "custodia", "resumo"])).toEqual(["resumo", "custodia", "riscos"]);
  });

  it("hasScope respeita o consentimento", () => {
    expect(hasScope(["resumo", "custodia"], "custodia")).toBe(true);
    expect(hasScope(["resumo"], "custodia")).toBe(false);
    expect(hasScope(null, "resumo")).toBe(true);
  });

  it("lista o que ainda pode ser concedido", () => {
    expect(missingScopes(["resumo", "custodia"])).toEqual(["contencioso", "agro", "documentos", "riscos"]);
    expect(missingScopes(OFFICE_SCOPES)).toEqual([]);
  });

  it("validação aceita seleção vazia e devolve o resumo", () => {
    const result = validateScopeSelection([]);
    expect(result.ok).toBe(true);
    expect(result.scopes).toEqual(["resumo"]);
  });

  it("validação recusa escopo desconhecido e diz qual", () => {
    const result = validateScopeSelection(["resumo", "senhas"]);
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toContain("senhas");
    expect(result.scopes).toEqual(["resumo"]);
  });

  it("validação de seleção completa não altera nada", () => {
    expect(validateScopeSelection([...OFFICE_SCOPES]).scopes).toEqual([...OFFICE_SCOPES]);
  });
});

describe("log de acesso", () => {
  const now = new Date("2026-11-03T12:00:00.000Z");
  const row = (over: Partial<AccessLogRow>): AccessLogRow => ({
    id: "1",
    office_name: "Aurora",
    reader_email: "analista@aurora.com",
    scope: "custodia",
    action: "abrir_detalhe",
    created_at: "2026-11-02T12:00:00.000Z",
    ...over,
  });

  it("resume acessos com rótulo em português e dias decorridos", () => {
    const summary = summarizeAccessLog([row({})], { now });
    expect(summary.entries[0]?.scopeLabel).toBe("Custódia e dívida");
    expect(summary.entries[0]?.daysAgo).toBe(1);
    expect(summary.totals.entries).toBe(1);
    expect(summary.totals.distinctReaders).toBe(1);
  });

  it("ordena do mais recente para o mais antigo", () => {
    const summary = summarizeAccessLog(
      [
        row({ id: "antigo", created_at: "2026-10-01T12:00:00.000Z" }),
        row({ id: "novo", created_at: "2026-11-03T10:00:00.000Z" }),
      ],
      { now },
    );
    expect(summary.entries.map((entry) => entry.id)).toEqual(["novo", "antigo"]);
  });

  it("conta acessos por leitor e por seção", () => {
    const summary = summarizeAccessLog(
      [
        row({ id: "1", scope: "custodia", reader_email: "a@x.com" }),
        row({ id: "2", scope: "custodia", reader_email: "a@x.com" }),
        row({ id: "3", scope: "agro", reader_email: "b@x.com" }),
      ],
      { now },
    );
    expect(summary.byReader[0]).toMatchObject({ reader: "a@x.com", count: 2 });
    expect(summary.byScope[0]).toMatchObject({ scope: "custodia", count: 2 });
    expect(summary.totals.distinctReaders).toBe(2);
  });

  it("levantar tentativa sem escopo é sinal, não ruído", () => {
    const summary = summarizeAccessLog(
      [row({ scope: "agro", action: "negado_sem_escopo" })],
      { now },
    );
    expect(summary.totals.denied).toBe(1);
    expect(summary.flags.join(" ")).toContain("sem escopo consentido");
  });

  it("log vazio explica que ninguém abriu", () => {
    const summary = summarizeAccessLog([], { now });
    expect(summary.totals.entries).toBe(0);
    expect(summary.flags[0]).toContain("Nenhum acesso registrado");
    expect(summary.totals.lastAccess).toBeNull();
  });

  it("acesso antigo sugere revisar o vínculo", () => {
    const summary = summarizeAccessLog([row({ created_at: "2026-01-01T00:00:00.000Z" })], { now });
    expect(summary.totals.lastAccessDays).toBeGreaterThan(90);
    expect(summary.flags.join(" ")).toContain("revise se o vínculo");
  });

  it("escopo desconhecido no log é preservado como 'outro', não descartado", () => {
    const summary = summarizeAccessLog([row({ scope: "sigiloso" })], { now });
    expect(summary.entries[0]?.scope).toBe("outro");
    expect(summary.entries[0]?.scopeLabel).toBe("sigiloso");
    expect(summary.entries).toHaveLength(1);
  });

  it("ação desconhecida não quebra a leitura do log", () => {
    const summary = summarizeAccessLog([row({ action: "exportou_pdf" })], { now });
    expect(summary.entries[0]?.action).toBe("outro");
  });
});

describe("detalhe da família", () => {
  const raw = {
    ownerUserId: "owner-1",
    label: "Família Silva",
    officeId: "office-1",
    scopes: ["resumo", "custodia", "agro"],
    generatedAt: "2026-11-03T12:00:00.000Z",
    sections: {
      resumo: { entities: "2", assetsValue: "1500000.50", lastUpdate: "2026-10-30T00:00:00.000Z" },
      custodia: {
        total: "800000",
        debt: "200000",
        byClass: [{ class: "renda_variavel", positions: "3", value: "500000" }],
      },
      // Seção não consentida: precisa ser descartada mesmo que o SQL devolva.
      contencioso: { exposure: 999999, cases: [{ title: "Processo secreto" }] },
      riscos: { open: 4, items: [{ title: "Risco não consentido" }] },
    },
  };

  it("normaliza números que vêm como string", () => {
    const detail = normalizeFamilyDetail(raw) as FamilyDetailPayload;
    expect(detail.sections.resumo?.entities).toBe(2);
    expect(detail.sections.resumo?.assetsValue).toBe(1500000.5);
    expect(detail.sections.custodia?.total).toBe(800000);
    expect(detail.sections.custodia?.byClass[0]?.value).toBe(500000);
  });

  it("descarta seção fora do escopo (defesa em profundidade)", () => {
    const detail = normalizeFamilyDetail(raw) as FamilyDetailPayload;
    expect(detail.sections.contencioso).toBeUndefined();
    expect(detail.sections.riscos).toBeUndefined();
  });

  it("inclui seção consentida", () => {
    const detail = normalizeFamilyDetail(raw) as FamilyDetailPayload;
    expect(detail.sections.agro).toBeUndefined(); // seção ausente no payload
    expect(detail.scopes).toEqual(["resumo", "custodia", "agro"]);
  });

  it("payload inválido devolve null em vez de objeto pela metade", () => {
    expect(normalizeFamilyDetail(null)).toBeNull();
    expect(normalizeFamilyDetail({})).toBeNull();
    expect(normalizeFamilyDetail({ label: "sem dono" })).toBeNull();
  });

  it("seções ausentes não viram zero inventado", () => {
    const detail = normalizeFamilyDetail({
      ownerUserId: "o",
      label: "Família",
      officeId: "of",
      scopes: ["resumo", "custodia"],
      sections: { resumo: { entities: 1 } },
    }) as FamilyDetailPayload;
    expect(detail.sections.resumo?.assetsValue).toBe(0);
    expect(detail.sections.custodia).toBeUndefined();
  });

  it("agro com campos e nulos preservados", () => {
    const detail = normalizeFamilyDetail({
      ownerUserId: "o",
      label: "Família",
      officeId: "of",
      scopes: ["resumo", "agro"],
      sections: {
        agro: {
          areaHa: "1200",
          fields: [{ name: "Talhão 1", crop: "soja", area_ha: "500", productivity_sc_ha: null, cost_per_ha: "7000" }],
        },
      },
    }) as FamilyDetailPayload;
    expect(detail.sections.agro?.areaHa).toBe(1200);
    expect(detail.sections.agro?.fields[0]?.productivity_sc_ha).toBeNull();
    expect(detail.sections.agro?.fields[0]?.cost_per_ha).toBe(7000);
  });
});
