import { describe, expect, it } from "bun:test";
import {
  JARVIS_TOOLS,
  TOOL_BY_NAME,
  runTool,
  toolResultsToPrompt,
  toolsToPrompt,
  type JarvisToolData,
} from "@/lib/jarvis/tools";
import { datasetsFor, inferArgs, normalize, routeQuestion } from "@/lib/jarvis/router";
import type { PortfolioBriefing } from "@/lib/jarvis/types";

const briefing: PortfolioBriefing = {
  generatedAt: "2026-10-30T12:00:00.000Z",
  userEmail: "gestor@patrium.test",
  totals: {
    aum: 1_000_000,
    assets: 3,
    entities: 1,
    members: 2,
    risksOpen: 2,
    risksCritical: 1,
    documentsExpiring: 3,
    documentsOverdue: 1,
    insightsOpen: 1,
    income6m: 0,
    expense6m: 0,
  },
  entities: [],
  topAssets: [],
  assetsByType: [],
  risks: [
    { title: "Concentração em imóveis", severity: "critical", status: "aberto", dueDate: null, entity: null, asset: null },
    { title: "Contrato vencendo", severity: "medium", status: "aberto", dueDate: null, entity: null, asset: null },
  ],
  documentsExpiring: [
    { title: "Matrícula 12.345", type: "matricula", expiryDate: "2026-11-10", daysToExpire: 11, status: "vencendo", asset: "Fazenda A" },
    { title: "Certidão negativa", type: "certidao", expiryDate: "2026-09-01", daysToExpire: -59, status: "vencido", asset: null },
    { title: "Seguro", type: "seguro", expiryDate: "2027-06-01", daysToExpire: 214, status: "ok", asset: null },
  ],
  insights: [],
  categories: [],
};

const data: JarvisToolData = {
  briefing,
  posicoes: [
    { name: "CDB", asset_class: "renda_fixa", quantity: 1000, unit_price: 100, currency: "BRL", liquidity: "d1" },
    { name: "Ações", asset_class: "renda_variavel", quantity: 200, unit_price: 100, currency: "BRL", liquidity: "d1" },
  ],
  passivos: [
    { name: "CCB", kind: "emprestimo", outstanding: 50000, rate_annual: 12, amortization: "sac", term_months: 60 },
  ],
  registrais: [{ current_value: 400000 }],
  juridico: [
    {
      id: "c1",
      case_number: "0001",
      title: "Trabalhista de ex-funcionário",
      type: "trabalhista",
      status: "em_andamento",
      risk_level: "high",
      value_at_stake: 200000,
      polarity: "passivo",
      probability: 0.7,
      phase: "instrucao",
      expected_settlement: "2027-10-30",
    },
    {
      id: "c2",
      case_number: "0002",
      title: "Cobrança contra fornecedor",
      type: "civel",
      status: "em_andamento",
      risk_level: "medium",
      value_at_stake: 100000,
      polarity: "ativo",
      probability: 0.6,
      phase: "conhecimento",
      expected_settlement: "2027-04-30",
    },
  ],
  agro: {
    fields: [
      { name: "Talhão 1", area_ha: 500, crop: "soja", productivity_sc_ha: 60, cost_per_ha: 7000 },
    ],
    leases: [],
    barters: [],
    environments: [],
  },
};

describe("roteador de ferramentas", () => {
  it("normaliza acento e caixa", () => {
    expect(normalize("  Imóveis  CAÍREM 20% ")).toBe("imoveis cairem 20%");
  });

  it("manda pergunta de choque imobiliário para stress_cenario", () => {
    const route = routeQuestion("E se os imóveis caírem 20%?");
    expect(route.tools).toContain("stress_cenario");
    expect(route.empty).toBe(false);
  });

  it("infere o choque negativo e a classe", () => {
    const args = inferArgs("E se imóveis caírem 20%?");
    expect(args.choque_percentual).toBe(-20);
    expect(args.classe).toBe("imoveis");
  });

  it("não inventa choque quando a pergunta não tem percentual", () => {
    const args = inferArgs("Como está o contencioso?");
    expect(args.choque_percentual).toBeUndefined();
  });

  it("manda pergunta de processo para contencioso", () => {
    expect(routeQuestion("Qual o risco dos processos trabalhistas?").tools).toContain("contencioso");
  });

  it("manda pergunta de safra para agro_margem", () => {
    expect(routeQuestion("Qual a margem da soja e do milho?").tools).toContain("agro_margem");
  });

  it("aciona ferramentas de resumo em pergunta de panorama", () => {
    const route = routeQuestion("Me dê um panorama geral");
    expect(route.tools.length).toBeGreaterThan(0);
    expect(route.tools).toContain("patrimonio_resumo");
  });

  it("devolve vazio quando não há correspondência", () => {
    const route = routeQuestion("Bom dia, tudo bem?");
    expect(route.empty).toBe(true);
    expect(route.reason).toContain("briefing");
  });

  it("declara os datasets necessários, sem carregar o banco inteiro", () => {
    const route = routeQuestion("Qual a margem da fazenda?");
    expect(route.datasets).toContain("agro");
    expect(route.datasets).not.toContain("juridico");
  });

  it("deduplica datasets de ferramentas diferentes", () => {
    expect(datasetsFor(["patrimonio_resumo", "risco_mercado"]).sort()).toEqual([
      "passivos",
      "posicoes",
      "registrais",
    ]);
  });

  it("respeita maxTools", () => {
    const route = routeQuestion("patrimônio, risco e contencioso", { maxTools: 1 });
    expect(route.tools).toHaveLength(1);
  });
});

describe("ferramentas", () => {
  it("patrimônio: PL = ativo − dívida", () => {
    const result = runTool("patrimonio_resumo", data);
    expect(result.ok).toBe(true);
    // 100.000 + 20.000 + 400.000 = 520.000 de ativo; 50.000 de dívida
    expect(result.data.assets).toMatchObject({ financial: 120000, registered: 400000, total: 520000 });
    expect(result.data.netWorth).toBe(470000);
    expect(result.summary).toContain("R$");
  });

  it("patrimônio declarou as três fontes", () => {
    const result = runTool("patrimonio_resumo", data);
    expect(result.sources.map((s) => s.label)).toContain("Posições");
    expect(result.sources).toHaveLength(3);
  });

  it("risco: VaR positivo e medido no PL", () => {
    const result = runTool("risco_mercado", data);
    expect(result.ok).toBe(true);
    const varData = result.data.var as { amount: number; percentageOfEquity: number };
    expect(varData.amount).toBeGreaterThan(0);
    expect(varData.percentageOfEquity).toBeGreaterThan(0);
  });

  it("risco: sem posição, declara em vez de mostrar zero", () => {
    const result = runTool("risco_mercado", { briefing, posicoes: [], registrais: [], passivos: [] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Não há posição");
  });

  it("choque aplica o percentual sobre a classe e reflete no PL", () => {
    const result = runTool("stress_cenario", data, { classe: "imoveis", choque_percentual: -20 });
    expect(result.data.classValue).toBe(400000);
    expect(result.data.delta).toBe(-80000);
    expect(result.data.equityAfter).toBe(390000);
  });

  it("choque em classe vazia não inventa número", () => {
    const result = runTool("stress_cenario", data, { classe: "cripto", choque_percentual: -30 });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Não há exposição");
  });

  it("contencioso reconhece provisão do caso provável passivo", () => {
    const result = runTool("contencioso", data);
    const provision = result.data.provision as number;
    expect(provision).toBeGreaterThan(0);
    // 200.000 × 0,7 = 140.000 — só o passivo provável entra
    expect(provision).toBeCloseTo(140000, -2);
  });

  it("contencioso soma tudo a partir do PL do balanço", () => {
    const result = runTool("contencioso", data);
    const cases = result.data.cases as { title: string; provision: number }[];
    expect(cases[0]?.title).toContain("Trabalhista");
    expect(result.summary).toContain("PL ajustado ao risco");
  });

  it("contencioso sem processo explica o que cadastrar", () => {
    const result = runTool("contencioso", { briefing, juridico: [] });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Não há processo");
  });

  it("agro devolve margem e margem por hectare", () => {
    const result = runTool("agro_margem", data);
    expect(result.ok).toBe(true);
    expect(result.data.margin).toBeDefined();
    expect(result.data.marginPerHa).toBeDefined();
  });

  it("agro sem talhão não calcula margem fantasma", () => {
    const result = runTool("agro_margem", { briefing });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Não há talhão");
  });

  it("documentos filtra pela janela de dias", () => {
    const result = runTool("documentos_vencendo", data, { dias: 60 });
    expect(result.data.total).toBe(2); // 11 dias e o vencido de −59
    expect(result.data.overdue).toEqual(["Certidão negativa"]);
  });

  it("documentos respeita janela maior", () => {
    const result = runTool("documentos_vencendo", data, { dias: 365 });
    expect(result.data.total).toBe(3);
  });

  it("riscos abertos conta severidade alta e crítica", () => {
    const result = runTool("riscos_abertos", data);
    expect(result.data.total).toBe(2);
    expect(result.data.criticalCount).toBe(1);
  });

  it("metodologia explica o tema pedido", () => {
    const varNote = runTool("explicar_metodologia", data, { tema: "var" });
    expect(varNote.summary).toContain("VaR");
    const generic = runTool("explicar_metodologia", data, {});
    expect(generic.data.topic).toBe("geral");
  });

  it("propor_acao cria proposta pendente de aprovação", () => {
    const result = runTool("propor_acao", data, {
      tipo: "criar_risco",
      titulo: "Reservar caixa para o trabalhista",
      justificativa: "Provisão de R$ 140 mil e liquidez apertada.",
      severidade: "high",
    });
    expect(result.proposal?.requiresApproval).toBe(true);
    expect(result.proposal?.kind).toBe("criar_risco");
    expect(result.summary).toContain("Requer aprovação humana");
    expect(result.proposal?.payload.severity).toBe("high");
  });

  it("propor_acao usa plano de ação como padrão", () => {
    const result = runTool("propor_acao", data, { titulo: "Negociar acordo" });
    expect(result.proposal?.kind).toBe("criar_plano_acao");
  });

  it("propor_acao exige processo ao lançar provisão", () => {
    const result = runTool("propor_acao", data, { tipo: "lancar_provisao", valor: 50000 });
    expect(result.proposal?.kind).toBe("lancar_provisao");
    expect(result.proposal?.payload.case_id).toBeNull();
  });

  it("ferramenta desconhecida devolve erro tratado", () => {
    const result = runTool("nao_existe" as never, data);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("desconhecida");
  });

  it("ferramenta que quebra não derruba a conversa", () => {
    // `fields` nulo (dado corrompido / migration no meio) faz a ferramenta lançar.
    const broken = { ...data, agro: { fields: null as never, leases: [], barters: [], environments: [] } };
    const result = runTool("agro_margem", broken);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Não consegui executar");
  });
});

describe("entrada de prompt", () => {
  it("lista todas as ferramentas com nome e gatilhos", () => {
    const prompt = toolsToPrompt();
    for (const tool of JARVIS_TOOLS) expect(prompt).toContain(tool.name);
  });

  it("resume execuções com rótulo e dados", () => {
    const block = toolResultsToPrompt([runTool("patrimonio_resumo", data)]);
    expect(block).toContain("### Resumo patrimonial");
    expect(block).toContain("Dados:");
  });

  it("sem execução, não gera bloco de prompt", () => {
    expect(toolResultsToPrompt([])).toBe("");
  });

  it("o registro de ferramentas é único por nome", () => {
    expect(TOOL_BY_NAME.size).toBe(JARVIS_TOOLS.length);
  });

  it("só existe uma ferramenta com poder de proposta", () => {
    const writers = JARVIS_TOOLS.filter((tool) => tool.name === "propor_acao");
    expect(writers).toHaveLength(1);
  });
});
