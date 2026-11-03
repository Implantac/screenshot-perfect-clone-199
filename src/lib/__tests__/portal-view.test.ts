import { describe, expect, test } from "bun:test";
import { buildPortalView, formatPortalViewText, type PortalSnapshotInput } from "@/lib/portal/snapshot";
import { renderPortalPdfBytes } from "@/lib/reports/portal-pdf";
import type { PortalGrant } from "@/lib/portal/access";

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

const herdeiro: PortalGrant = {
  id: "g1",
  full_name: "Marina Almeida",
  email: "marina@almeida.com",
  role: "herdeiro",
  sections: ["resumo", "alocacao", "metas"],
  visibility: "faixas",
  status: "ativo",
  can_export: false,
  can_see_liabilities: false,
  require_mfa: true,
  expires_at: "2027-12-31",
};

const input: PortalSnapshotInput = {
  grant: herdeiro,
  entityName: "Holding Almeida",
  totals: { financial: 9_108_000, registered: 60_400_000, debt: 6_400_000 },
  classes: [
    { key: "renda_fixa", label: "Renda fixa", percentage: 52.4, value: 4_770_000 },
    { key: "renda_variavel", label: "Renda variável", percentage: 18.1, value: 1_650_000 },
    { key: "caixa", label: "Caixa", percentage: 13.2, value: 1_200_000 },
  ],
  contributions: [
    { label: "Renda fixa", returnPct: 5.99, contribution: 2.61 },
    { label: "Fundos", returnPct: -7.14, contribution: -0.97 },
  ],
  monthReturnPct: 3.4269,
  ytdReturnPct: 4.31,
  goals: [
    { name: "Reserva de liquidez", progressPct: 40, requiredMonthly: 50_443, targetDate: "2028-12-31" },
  ],
  asOf: "2026-10-31",
  today: "2026-11-03",
};

describe("visão do convidado", () => {
  test("herdeiro não recebe dívida, balanço nem contribuição", () => {
    const view = buildPortalView(input);
    expect(view.cards.map((card) => card.label)).toEqual(["Patrimônio líquido", "Retorno no mês", "Retorno no ano"]);
    expect(view.cards.some((card) => card.label === "Dívida")).toBe(false);
    expect(view.contributions).toEqual([]);
  });

  test("patrimônio líquido respeita o grão da faixa", () => {
    const view = buildPortalView(input);
    const pl = view.cards.find((card) => card.label === "Patrimônio líquido")!;
    // 9.108.000 + 60.400.000 − 6.400.000 = 63.108.000
    expect(pl.value).toBe("R$ 60 mi–70 mi");
    expect(pl.value).not.toContain("108");
  });

  test("percentuais nunca são redigidos", () => {
    const view = buildPortalView(input);
    expect(view.cards.find((card) => card.label === "Retorno no mês")!.value).toBe("+3,43%");
    expect(view.classes[0].percentage).toBe("52,4%");
  });

  test("valor absoluto da classe só aparece quando o perfil vê resumo com grão fino", () => {
    const comFaixa = buildPortalView(input);
    expect(comFaixa.classes[0].amount).toBeNull();

    const exato = buildPortalView({
      ...input,
      grant: { ...herdeiro, visibility: "completo" },
    });
    expect(exato.classes[0].amount).toBe("R$ 4.770.000");
  });

  test("seções negadas aparecem com motivo, não como bloco vazio", () => {
    const view = buildPortalView(input);
    expect(view.unavailable.map((item) => item.label)).toEqual([
      "Atribuição de retorno",
      "Balanço e dívida",
      "Documentos",
      "Contencioso",
      "Sucessão e governança",
    ]);
    expect(view.unavailable[0].reason).toContain("não concedida");
  });

  test("metas aparecem com aporte redigido e prazo em dd/mm/aaaa", () => {
    const view = buildPortalView(input);
    expect(view.goals[0].progress).toBe("40%");
    expect(view.goals[0].targetDate).toBe("31/12/2028");
    expect(view.goals[0].requiredMonthly).toBe("R$ 50 mil–60 mil");
  });

  test("exportar é bloqueado quando o grant não permite", () => {
    const view = buildPortalView(input);
    expect(view.canExport).toBe(false);
    expect(view.notes.some((note) => note.includes("exportação"))).toBe(true);
  });

  test("acesso vencido: nada é exibido e o motivo fica explícito", () => {
    const view = buildPortalView({
      ...input,
      grant: { ...herdeiro, expires_at: "2026-10-01" },
    });
    expect(view.cards).toEqual([]);
    expect(view.classes).toEqual([]);
    expect(view.canExport).toBe(false);
    expect(view.access.expired).toBe(true);
  });

  test("atribuição concedida mas não apurada vira nota, não zero", () => {
    const view = buildPortalView({
      ...input,
      grant: { ...herdeiro, sections: ["resumo", "atribuicao"] },
      contributions: [],
    });
    expect(view.contributions).toEqual([]);
    expect(view.notes.some((note) => note.includes("não foi apurada"))).toBe(true);
  });

  test("nota de privacidade acompanha o grão usado", () => {
    expect(buildPortalView(input).notes.some((note) => note.includes("faixas"))).toBe(true);
    const resumido = buildPortalView({ ...input, grant: { ...herdeiro, visibility: "resumido" } });
    expect(resumido.notes.some((note) => note.includes("milhões"))).toBe(true);
    expect(resumido.classes[0].amount).toBe("R$ 4,8 mi");
  });

  test("exportação em texto traz o que a pessoa vê e o que não vê", () => {
    const text = formatPortalViewText(buildPortalView(input));
    expect(text).toContain("PORTAL DE HOLDING ALMEIDA");
    expect(text).toContain("Marina Almeida");
    expect(text).toContain("ALOCAÇÃO");
    expect(text).toContain("NÃO DISPONÍVEL PARA O SEU PERFIL");
    expect(text).not.toContain("6.400.000");
  });
});

describe("PDF do portal", () => {
  test("gera arquivo válido com o recorte do perfil", () => {
    const raw = latin1(renderPortalPdfBytes(buildPortalView(input)));
    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw).toContain("PORTAL DO CLIENTE");
    expect(raw).toContain("HOLDING ALMEIDA");
    expect(raw).toContain("Marina Almeida");
    expect(raw).toContain("ALOCAÇÃO POR CLASSE");
    expect(raw).toContain("NÃO DISPONÍVEL PARA ESTE PERFIL");
    // sem balanço liberado, a dívida não existe no arquivo
    expect(raw).not.toContain("6.400.000");
  });

  test("perfil completo recebe dívida e nota de valores exatos", () => {
    const raw = latin1(
      renderPortalPdfBytes(
        buildPortalView({
          ...input,
          grant: {
            ...herdeiro,
            visibility: "completo",
            sections: ["resumo", "alocacao", "balanco", "atribuicao", "metas"],
            can_see_liabilities: true,
            can_export: true,
          },
        }),
      ),
    );
    expect(raw).toContain("valores exatos");
    expect(raw).toContain("R$ 6.400.000");
    expect(raw).toContain("CONTRIBUIÇÃO NO MÊS");
  });
});
