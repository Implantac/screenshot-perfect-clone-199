import { describe, expect, test } from "bun:test";
import {
  PORTAL_SECTIONS,
  ROLE_PRESETS,
  redactAmount,
  redactPercent,
  resolvePortalAccess,
  summarizeGrants,
  type PortalGrant,
} from "@/lib/portal/access";

const base: PortalGrant = {
  id: "g1",
  full_name: "Marina Almeida",
  email: "marina@almeida.com",
  role: "herdeiro",
  sections: ["resumo", "alocacao", "atribuicao", "metas", "sucessao"],
  visibility: "faixas",
  status: "ativo",
  can_export: false,
  can_see_liabilities: false,
  can_see_documents: false,
  require_mfa: true,
  expires_at: "2027-12-31",
};

const today = new Date("2026-11-03T12:00:00Z");

describe("resolução de acesso", () => {
  test("herdeiro vê o consolidado e não vê dívida detalhada", () => {
    const access = resolvePortalAccess(base, today);
    expect(access.allowedSections).toEqual(["resumo", "alocacao", "atribuicao", "metas", "sucessao"]);
    const balanco = access.sections.find((section) => section.id === "balanco")!;
    expect(balanco.allowed).toBe(false);
    expect(balanco.reason).toContain("não concedida");
  });

  test("seção concedida mas sem permissão de passivo é negada com motivo próprio", () => {
    const access = resolvePortalAccess(
      { ...base, sections: [...base.sections, "balanco"], can_see_liabilities: false },
      today,
    );
    const balanco = access.sections.find((section) => section.id === "balanco")!;
    expect(balanco.allowed).toBe(false);
    expect(balanco.reason).toContain("passivo");
    expect(access.warnings.some((warning) => warning.includes("Herdeiro com acesso"))).toBe(false);
  });

  test("documentos exigem permissão própria", () => {
    const access = resolvePortalAccess(
      { ...base, role: "contador", sections: ["resumo", "documentos"], can_see_documents: false },
      today,
    );
    expect(access.sections.find((section) => section.id === "documentos")!.reason).toContain("documentos");
  });

  test("grant vencido zera tudo, independentemente do status gravado", () => {
    const access = resolvePortalAccess({ ...base, status: "ativo", expires_at: "2026-10-01" }, today);
    expect(access.expired).toBe(true);
    expect(access.status).toBe("revogado");
    expect(access.allowedSections).toEqual([]);
    expect(access.sections.every((section) => !section.allowed)).toBe(true);
  });

  test("suspenso e revogado negam com motivo legível", () => {
    const suspenso = resolvePortalAccess({ ...base, status: "suspenso" }, today);
    expect(suspenso.allowedSections).toEqual([]);
    expect(suspenso.sections[0].reason).toContain("suspenso");
    const revogado = resolvePortalAccess({ ...base, status: "revogado" }, today);
    expect(revogado.sections[0].reason).toContain("revogado");
  });

  test("vencimento próximo e acesso sem prazo geram aviso", () => {
    const proximo = resolvePortalAccess({ ...base, expires_at: "2026-11-20" }, today);
    expect(proximo.daysToExpiry).toBe(17);
    expect(proximo.warnings.some((warning) => warning.includes("vence em"))).toBe(true);

    const semPrazo = resolvePortalAccess({ ...base, expires_at: null }, today);
    expect(semPrazo.daysToExpiry).toBeNull();
    expect(semPrazo.warnings.some((warning) => warning.includes("sem prazo"))).toBe(true);
  });

  test("terceiro sem MFA gera aviso; titular sem MFA não", () => {
    expect(
      resolvePortalAccess({ ...base, require_mfa: false }, today).warnings.some((warning) =>
        warning.includes("segundo fator"),
      ),
    ).toBe(true);
    expect(
      resolvePortalAccess(
        { ...base, role: "titular", require_mfa: false, sections: PORTAL_SECTIONS.map((section) => section.id) },
        today,
      ).warnings.some((warning) => warning.includes("segundo fator")),
    ).toBe(false);
  });

  test("exportar com valor exato e balanço é sinalizado", () => {
    const access = resolvePortalAccess(
      {
        ...base,
        role: "socio",
        sections: ["resumo", "alocacao", "balanco"],
        can_see_liabilities: true,
        can_export: true,
        visibility: "completo",
      },
      today,
    );
    expect(access.warnings.some((warning) => warning.includes("Exporta PDF"))).toBe(true);
  });

  test("gestor externo com sucessão é sinalizado", () => {
    const access = resolvePortalAccess(
      { ...base, role: "gestor", sections: ["resumo", "sucessao"] },
      today,
    );
    expect(access.warnings.some((warning) => warning.includes("Gestor externo"))).toBe(true);
  });

  test("convite antigo nunca aceito aparece como aviso", () => {
    const access = resolvePortalAccess(
      { ...base, status: "convite_pendente", invited_at: "2026-09-01T10:00:00Z" },
      today,
    );
    expect(access.warnings.some((warning) => warning.includes("nunca aceito"))).toBe(true);
  });

  test("exposição cresce com seções e com o peso das sensíveis", () => {
    const minimo = resolvePortalAccess({ ...base, sections: ["resumo"] }, today);
    const total = resolvePortalAccess(
      { ...base, sections: PORTAL_SECTIONS.map((section) => section.id), can_see_liabilities: true, can_see_documents: true },
      today,
    );
    expect(minimo.exposure).toBeGreaterThan(0);
    expect(minimo.exposure).toBeLessThan(total.exposure);
    expect(total.exposure).toBe(100);
  });

  test("pacotes de persona fazem sentido: titular vê tudo, gestor vê pouco", () => {
    const titular = resolvePortalAccess(
      { ...base, role: "titular", ...ROLE_PRESETS.titular.extras, sections: ROLE_PRESETS.titular.sections } as PortalGrant,
      today,
    );
    expect(titular.allowedSections.length).toBe(PORTAL_SECTIONS.length);

    const gestor = resolvePortalAccess(
      { ...base, role: "gestor", ...ROLE_PRESETS.gestor.extras, sections: ROLE_PRESETS.gestor.sections } as PortalGrant,
      today,
    );
    expect(gestor.allowedSections).toEqual(["resumo", "alocacao", "atribuicao"]);
    // o pacote padrão do gestor não deve nascer com pendência de segurança
    expect(gestor.warnings).toEqual([]);
  });

  test("todos os pacotes referenciam seções existentes", () => {
    const ids = new Set(PORTAL_SECTIONS.map((section) => section.id));
    for (const preset of Object.values(ROLE_PRESETS)) {
      for (const section of preset.sections) expect(ids.has(section)).toBe(true);
    }
  });
});

describe("redação de valores", () => {
  test("completo mostra o centavo, resumido mostra a ordem, faixas mostra a banda", () => {
    expect(redactAmount(63_386_946, "completo")).toBe("R$ 63.386.946");
    expect(redactAmount(63_386_946, "resumido")).toBe("R$ 63,4 mi");
    expect(redactAmount(63_386_946, "faixas")).toBe("R$ 60 mi–70 mi");
  });

  test("faixas funcionam em ordens menores e com negativo", () => {
    expect(redactAmount(128_989, "faixas")).toBe("R$ 100 mil–200 mil");
    expect(redactAmount(-4_200, "faixas")).toBe("-R$ 4 mil–5 mil");
    expect(redactAmount(0, "faixas")).toBe("R$ 0");
  });

  test("percentual nunca é redigido — sem ele o relatório não comunica", () => {
    expect(redactPercent(3.4269)).toBe("+3,43%");
    expect(redactPercent(-0.73)).toBe("-0,73%");
  });

  test("faixa não entrega o valor exato: o texto não contém o número", () => {
    const exato = 63_386_946;
    const faixa = redactAmount(exato, "faixas");
    expect(faixa).not.toContain("386");
    expect(faixa).not.toContain("63,4");
  });
});

describe("saúde do conjunto de acessos", () => {
  test("conta ativos, pendentes e vencendo", () => {
    const summary = summarizeGrants(
      [
        base,
        { ...base, id: "g2", email: "joao@almeida.com", status: "convite_pendente" },
        { ...base, id: "g3", email: "velho@almeida.com", expires_at: "2026-10-01" },
        { ...base, id: "g4", email: "quase@almeida.com", expires_at: "2026-11-25" },
      ],
      today,
    );
    expect(summary.grants).toBe(4);
    expect(summary.active).toBe(2); // base + g4
    expect(summary.pending).toBe(1);
    expect(summary.expiringSoon).toBe(1); // só g4 vence em até 30 dias
    expect(summary.warnings.length).toBeGreaterThan(0);
  });

  test("portal fechado avisa que ninguém lê além do dono", () => {
    const summary = summarizeGrants([], today);
    expect(summary.grants).toBe(0);
    expect(summary.warnings[0]).toContain("portal está fechado");
  });

  test("sem titular cadastrado há aviso de continuidade", () => {
    const summary = summarizeGrants([{ ...base, role: "contador" }], today);
    expect(summary.warnings.some((warning) => warning.includes("Nenhum titular"))).toBe(true);
  });

  test("acessos sem MFA e sem prazo são contados", () => {
    const summary = summarizeGrants(
      [
        { ...base, id: "a", email: "a@x.com", require_mfa: false },
        { ...base, id: "b", email: "b@x.com", expires_at: null },
      ],
      today,
    );
    expect(summary.withoutMfa).toBe(1);
    expect(summary.warnings.some((warning) => warning.includes("sem prazo"))).toBe(true);
  });
});
