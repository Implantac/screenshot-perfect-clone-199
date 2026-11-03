/**
 * Ferramentas do JARVIS — o que ele **faz**, não só o que ele fala.
 *
 * Até a wave 20 o JARVIS respondia sobre um briefing em texto: descrevia o
 * patrimônio, mas não calculava nada além do que o briefing já tinha pronto.
 * Aqui cada ferramenta é uma função pura sobre os motores que já existem (risco,
 * contencioso, agro, trilha) — mesma conta da tela, mesmo número, mesma premissa.
 *
 * Três regras que dão sentido ao desenho:
 *
 *   1. **Determinístico primeiro.** A ferramenta roda antes do LLM. O modelo
 *      recebe o resultado já calculado e escreve texto em cima dele — nunca é a
 *      fonte do número.
 *   2. **Cada ferramenta declara de que dado precisa** (`datasets`). O servidor
 *      só carrega o que a pergunta exigir (e audita a chamada).
 *   3. **Nada de escrita silenciosa.** Ferramenta que muda o banco não existe:
 *      `propor_acao` devolve uma **proposta** que exige aprovação humana e só
 *      então é gravada, com o autor real na trilha.
 */

import { buildBalanceSheet } from "@/lib/wealth/balance";
import { computeRisk } from "@/lib/wealth/risk";
import { buildProvisionReport, type LegalCaseLike } from "@/lib/legal/provision";
import { buildAgroReport, type AgroCrop } from "@/lib/agro/agro";
import type { PortfolioBriefing } from "@/lib/jarvis/types";

export type JarvisToolName =
  | "patrimonio_resumo"
  | "risco_mercado"
  | "stress_cenario"
  | "contencioso"
  | "agro_margem"
  | "documentos_vencendo"
  | "riscos_abertos"
  | "explicar_metodologia"
  | "propor_acao";

export type DatasetKey = "posicoes" | "passivos" | "registrais" | "juridico" | "agro";

export type ToolPosition = {
  name: string;
  asset_class: string;
  currency?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  liquidity?: string | null;
};

export type ToolLiability = {
  name: string;
  kind?: string | null;
  id?: string;
  outstanding: number | string;
  rate_annual?: number | string | null;
  amortization?: string | null;
  term_months?: number | string | null;
  due_date?: string | null;
};

export type ToolRegisteredAsset = { current_value?: number | string | null };

export type JarvisToolData = {
  briefing: PortfolioBriefing;
  posicoes?: ToolPosition[];
  passivos?: ToolLiability[];
  registrais?: ToolRegisteredAsset[];
  juridico?: LegalCaseLike[];
  agro?: {
    fields: { name: string; area_ha: number | string; crop: AgroCrop; productivity_sc_ha?: number | string | null; cost_per_ha?: number | string | null }[];
    leases?: { role: "arrendador" | "arrendatario" | "parceiro_outorgante" | "parceiro_outorgado"; area_ha: number | string; payment: "dinheiro" | "sacas" | "parceria"; price_per_ha_year?: number | string | null; bags_per_ha?: number | string | null; share_percent?: number | string | null }[];
    barters?: { input_value: number | string; bags_due: number | string; bag_reference_price: number | string; months_to_delivery?: number | string | null }[];
    environments?: { total_ha: number | string; biome: "amazonia" | "cerrado" | "mata_atlantica" | "pampa" | "pantanal" | "caatinga"; in_legal_amazon?: boolean | null; legal_reserve_declared_ha?: number | string | null; app_ha?: number | string | null; car_status?: "ativo" | "pendente" | "em_analise" | "irregular" | "sem_car" | null }[];
  };
};

export type ToolResult = {
  tool: JarvisToolName;
  label: string;
  ok: boolean;
  /** Frase objetiva com os números — é o que entra no prompt e no chat. */
  summary: string;
  /** Dados estruturados para o modelo e para a UI (chips). */
  data: Record<string, unknown>;
  /** Fontes/premissas declaradas. */
  sources: { label: string; value: string }[];
  /** Só para `propor_acao`. */
  proposal?: JarvisProposal;
};

export type JarvisProposalKind = "criar_risco" | "criar_plano_acao" | "lancar_provisao";

export type JarvisProposal = {
  kind: JarvisProposalKind;
  title: string;
  rationale: string;
  /** Payload exato que será gravado após aprovação. */
  payload: Record<string, unknown>;
  /** Resumo legível do efeito. */
  effect: string;
  requiresApproval: true;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number, digits = 1) => `${value.toFixed(digits).replace(".", ",")}%`;
const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const CLASS_LABEL: Record<string, string> = {
  caixa: "Caixa",
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  fundos: "Fundos",
  imoveis: "Imóveis",
  internacional: "Internacional",
  alternativos: "Alternativos",
  cripto: "Cripto",
};

/** Passivo no formato do motor de balanço (id e kind são obrigatórios lá). */
function toLiability(liability: ToolLiability, index: number) {
  return {
    id: liability.id ?? `liability-${index}`,
    name: liability.name ?? "Dívida",
    kind: liability.kind ?? "emprestimo",
    outstanding: num(liability.outstanding),
    rate_annual: liability.rate_annual ?? 0,
    amortization: liability.amortization ?? "bullet",
    term_months: liability.term_months ?? null,
    due_date: liability.due_date ?? null,
  };
}

function dataSummary(data: JarvisToolData) {
  return buildBalanceSheet({
    positions: (data.posicoes ?? []).map((position) => ({
      quantity: position.quantity,
      unit_price: position.unit_price,
    })),
    registeredAssets: (data.registrais ?? []).map((asset) => ({ current_value: asset.current_value })),
    liabilities: (data.passivos ?? []).map(toLiability),
  });
}

// ---------------------------------------------------------------------------
// Definições
// ---------------------------------------------------------------------------

export type JarvisTool = {
  name: JarvisToolName;
  label: string;
  description: string;
  /** Palavras que fazem o roteador escolher esta ferramenta. */
  triggers: string[];
  datasets: DatasetKey[];
  run: (data: JarvisToolData, args: Record<string, unknown>) => ToolResult;
};

export const JARVIS_TOOLS: JarvisTool[] = [
  {
    name: "patrimonio_resumo",
    label: "Resumo patrimonial",
    description: "Ativo, dívida, patrimônio líquido, alavancagem e alocação por classe.",
    triggers: ["patrimonio", "patrimônio", "pl", "ativo", "divida", "dívida", "alocacao", "alocação", "resumo", "quanto tenho", "aum"],
    datasets: ["posicoes", "passivos", "registrais"],
    run: (data) => {
      const sheet = dataSummary(data);
      const byClass = new Map<string, number>();
      for (const position of data.posicoes ?? []) {
        const value = num(position.quantity) * num(position.unit_price);
        byClass.set(position.asset_class, (byClass.get(position.asset_class) ?? 0) + value);
      }
      const classes = Array.from(byClass.entries())
        .map(([key, value]) => ({
          class: key,
          label: CLASS_LABEL[key] ?? key,
          value,
          share: sheet.assets.financial > 0 ? (value / sheet.assets.financial) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value);

      const top = classes[0];
      return {
        tool: "patrimonio_resumo",
        label: "Resumo patrimonial",
        ok: true,
        summary:
          `Ativo ${brl(sheet.assets.total)} = financeiro ${brl(sheet.assets.financial)} + registral ${brl(sheet.assets.registered)}; ` +
          `dívida ${brl(sheet.totals.debt)} (alavancagem ${pct(sheet.totals.leverage)} do ativo); ` +
          `patrimônio líquido ${brl(sheet.totals.netWorth)}.` +
          (top ? ` Maior classe: ${top.label} com ${pct(top.share)} do financeiro.` : ""),
        data: {
          assets: sheet.assets,
          debt: sheet.totals.debt,
          netWorth: sheet.totals.netWorth,
          leverage: sheet.totals.leverage,
          monthlyService: sheet.totals.monthlyService,
          classes,
        },
        sources: [
          { label: "Posições", value: String((data.posicoes ?? []).length) },
          { label: "Passivos", value: String((data.passivos ?? []).length) },
          { label: "Ativos registrais", value: String((data.registrais ?? []).length) },
        ],
      };
    },
  },
  {
    name: "risco_mercado",
    label: "Risco de mercado (VaR)",
    description: "VaR a 95%/99%, pior cenário de stress e contribuição de risco por classe.",
    triggers: ["var", "risco de mercado", "risco", "volatilidade", "stress", "cenario", "cenário", "quanto posso perder"],
    datasets: ["posicoes", "passivos", "registrais"],
    run: (data) => {
      const risk = computeRisk({
        positions: (data.posicoes ?? []).map((position) => ({
          name: position.name ?? "Posição",
          asset_class: position.asset_class,
          quantity: position.quantity,
          unit_price: position.unit_price,
          liquidity: position.liquidity,
          currency: position.currency ?? "BRL",
        })),
        registeredAssets: (data.registrais ?? []).map((asset) => ({
          current_value: num(asset.current_value),
          asset_class: "imoveis",
        })),
        liabilities: (data.passivos ?? []).map((liability, index) => ({
          ...toLiability(liability, index),
        })),
        confidence: 95,
        horizonDays: 21,
      });

      const worst = risk.scenarios[0];
      return {
        tool: "risco_mercado",
        label: "Risco de mercado",
        ok: risk.assets.total > 0,
        summary:
          risk.assets.total === 0
            ? "Não há posição cadastrada suficiente para medir VaR."
            : `VaR 95% em 21 dias: ${brl(risk.var.amount)} (${pct(risk.var.percentageOfEquity)} do PL). ` +
              `Pior cenário: ${worst?.label ?? "—"} com ${pct((worst?.equityDrawdown ?? 0))} de impacto no PL. ` +
              `σ anual da carteira ${pct(risk.var.portfolioVolatility)}.`,
        data: {
          var: risk.var,
          worstScenario: worst,
          scenarios: risk.scenarios.slice(0, 3),
          classes: risk.classes.slice(0, 6),
          debtShock: risk.debtShock,
          liquidity: risk.liquidity,
          warnings: risk.warnings,
        },
        sources: [{ label: "Premissas", value: "volatilidades e correlações declaradas no módulo de risco" }],
      };
    },
  },
  {
    name: "stress_cenario",
    label: "Simulação de choque",
    description: "Aplica um choque percentual numa classe e devolve o efeito no PL.",
    triggers: ["e se", "simular", "simule", "choque", "cair", "queda", "cair 20", "desvalorizar"],
    datasets: ["posicoes", "passivos", "registrais"],
    run: (data, args) => {
      const assetClass = String(args.classe ?? "imoveis");
      const shock = Number(args.choque_percentual ?? -20);
      const sheet = dataSummary(data);

      const classValue =
        (data.posicoes ?? [])
          .filter((position) => position.asset_class === assetClass)
          .reduce((sum, position) => sum + num(position.quantity) * num(position.unit_price), 0) +
        (assetClass === "imoveis"
          ? (data.registrais ?? []).reduce((sum, asset) => sum + num(asset.current_value), 0)
          : 0);

      const delta = classValue * (shock / 100);
      const equityAfter = sheet.totals.netWorth + delta;
      const equityImpact = sheet.totals.netWorth !== 0 ? (delta / sheet.totals.netWorth) * 100 : 0;
      const label = CLASS_LABEL[assetClass] ?? assetClass;

      return {
        tool: "stress_cenario",
        label: "Simulação de choque",
        ok: classValue > 0,
        summary:
          classValue === 0
            ? `Não há exposição em ${label} para simular.`
            : `Choque de ${pct(shock, 0)} em ${label} (${brl(classValue)}): ` +
              `Δ ativo ${brl(delta)}, PL de ${brl(sheet.totals.netWorth)} para ${brl(equityAfter)} ` +
              `(${pct(equityImpact)} do PL).`,
        data: {
          class: assetClass,
          classLabel: label,
          classValue,
          shockPercent: shock,
          delta,
          equityBefore: sheet.totals.netWorth,
          equityAfter,
          equityImpact,
        },
        sources: [
          { label: "Efeito no PL", value: "com alavancagem: ΔPL = Δativo ÷ PL" },
        ],
      };
    },
  },
  {
    name: "contencioso",
    label: "Contencioso e provisão",
    description: "Provisão reconhecida, passivo possível, PL ajustado ao risco e concentração.",
    triggers: ["contencioso", "processo", "processos", "provisao", "provisão", "judicial", "acao judicial", "ação judicial", "juridico", "jurídico"],
    datasets: ["juridico", "posicoes", "passivos", "registrais"],
    run: (data) => {
      const sheet = dataSummary(data);
      const report = buildProvisionReport({
        cases: data.juridico ?? [],
        netWorth: sheet.totals.netWorth,
      });
      const largest = report.cases.find((item) => item.provision > 0);

      return {
        tool: "contencioso",
        label: "Contencioso",
        ok: (data.juridico ?? []).length > 0,
        summary:
          (data.juridico ?? []).length === 0
            ? "Não há processo cadastrado no contencioso."
            : `Provisão reconhecida ${brl(report.totals.provision)} (${pct(report.equity.provisionToEquity)} do PL); ` +
              `passivo possível divulgado ${brl(report.totals.disclosed)}; ` +
              `PL ajustado ao risco ${brl(report.equity.adjustedNetWorth)}. ` +
              `${report.totals.probableCases} processo(s) provável(is), ${report.totals.possibleCases} possível(is).` +
              (largest ? ` Maior provisão: ${largest.title}.` : ""),
        data: {
          provision: report.totals.provision,
          disclosed: report.totals.disclosed,
          adjustedNetWorth: report.equity.adjustedNetWorth,
          worstCaseNetWorth: report.equity.worstCaseNetWorth,
          provisionToEquity: report.equity.provisionToEquity,
          cases: report.cases.slice(0, 5).map((item) => ({
            title: item.title,
            type: item.typeLabel,
            probability: item.probability,
            band: item.band,
            provision: item.provision,
          })),
          warnings: report.warnings,
        },
        sources: [{ label: "Régua", value: "CPC 25: provável > 50%, possível 10–50%, remota < 10%" }],
      };
    },
  },
  {
    name: "agro_margem",
    label: "Agro",
    description: "Margem por talhão, custo por unidade, stress, barter e passivo ambiental.",
    triggers: ["agro", "fazenda", "safra", "soja", "milho", "algodao", "algodão", "talhao", "talhão", "barter", "arrendamento", "reserva legal", "car"],
    datasets: ["agro"],
    run: (data) => {
      const dataset = data.agro;
      if (!dataset || dataset.fields.length === 0) {
        return {
          tool: "agro_margem",
          label: "Agro",
          ok: false,
          summary: "Não há talhão cadastrado: sem área, cultura e custo não há margem para calcular.",
          data: {},
          sources: [],
        };
      }

      const report = buildAgroReport({
        fields: dataset.fields,
        leases: dataset.leases,
        barters: dataset.barters,
        environments: dataset.environments,
      });
      const worst = report.stress[0];

      return {
        tool: "agro_margem",
        label: "Agro",
        ok: true,
        summary:
          `Receita da safra ${brl(report.kpis.revenue)}, custo ${brl(report.margins.totals.cost)}, ` +
          `margem ${brl(report.kpis.margin)} (${brl(report.kpis.marginPerHa)}/ha em ${report.margins.totals.tradedAreaHa} ha de lavoura). ` +
          (worst ? `Pior cenário: ${worst.label} com margem de ${brl(worst.margin)}. ` : "") +
          `Barter com sobrepreço de ${brl(report.kpis.barterOvercost)} e passivo ambiental de ${brl(report.kpis.environmentalPassive)}.`,
        data: {
          revenue: report.kpis.revenue,
          cost: report.margins.totals.cost,
          margin: report.kpis.margin,
          marginPerHa: report.kpis.marginPerHa,
          areaHa: report.kpis.areaHa,
          byCrop: report.margins.byCrop,
          stress: report.stress,
          barterOvercost: report.kpis.barterOvercost,
          environmentalPassive: report.kpis.environmentalPassive,
          warnings: report.warnings,
        },
        sources: [{ label: "Premissas", value: "preços e custos do módulo agro (declarados na tela /Agro)" }],
      };
    },
  },
  {
    name: "documentos_vencendo",
    label: "Documentos a vencer",
    description: "Documentos vencidos e a vencer na janela pedida.",
    triggers: ["documento", "documentos", "vencimento", "vence", "vencendo", "matricula", "matrícula", "certidao", "certidão"],
    datasets: [],
    run: (data, args) => {
      const days = Number(args.dias ?? 60);
      const expiring = (data.briefing.documentsExpiring ?? []).filter(
        (document) => document.daysToExpire !== null && (document.daysToExpire as number) <= days,
      );
      const overdue = expiring.filter((document) => (document.daysToExpire as number) < 0);

      return {
        tool: "documentos_vencendo",
        label: "Documentos",
        ok: true,
        summary:
          expiring.length === 0
            ? `Nenhum documento vence em ${days} dias.`
            : `${expiring.length} documento(s) na janela de ${days} dias, ${overdue.length} já vencido(s): ` +
              expiring
                .slice(0, 3)
                .map((document) => `${document.title} (${document.daysToExpire} d)`)
                .join("; ") +
              ".",
        data: {
          days,
          total: expiring.length,
          overdue: overdue.map((document) => document.title),
          documents: expiring.slice(0, 8),
        },
        sources: [{ label: "Documentos cadastrados", value: String((data.briefing.documentsExpiring ?? []).length) }],
      };
    },
  },
  {
    name: "riscos_abertos",
    label: "Riscos abertos",
    description: "Riscos abertos por severidade e prazo.",
    triggers: ["risco aberto", "riscos", "critico", "crítico", "severidade", "matriz de risco"],
    datasets: [],
    run: (data) => {
      const risks = data.briefing.risks ?? [];
      const critical = risks.filter((risk) => risk.severity === "critical" || risk.severity === "high");
      return {
        tool: "riscos_abertos",
        label: "Riscos",
        ok: true,
        summary:
          risks.length === 0
            ? "Nenhum risco aberto registrado."
            : `${risks.length} risco(s) aberto(s), ${critical.length} de severidade alta ou crítica. ` +
              (critical[0] ? `Mais grave: ${critical[0].title}.` : ""),
        data: {
          total: risks.length,
          criticalCount: critical.length,
          risks: risks.slice(0, 8),
        },
        sources: [{ label: "Riscos no briefing", value: String(risks.length) }],
      };
    },
  },
  {
    name: "explicar_metodologia",
    label: "Metodologia",
    description: "Explica de onde vem um número e quais premissas ele usa.",
    triggers: ["como calcula", "como você calcula", "metodologia", "de onde vem", "premissa", "premissas", "por que esse numero", "por que esse número"],
    datasets: [],
    run: (_data, args) => {
      const topic = String(args.tema ?? "").toLowerCase();
      const notes: { key: string; text: string }[] = [
        {
          key: "var",
          text:
            "VaR paramétrico: σ da carteira com volatilidades e correlações declaradas no módulo de risco, escalado pela raiz do tempo e multiplicado pelo z-score (1,64 para 95%). O impacto é medido no patrimônio líquido, não no ativo.",
        },
        {
          key: "provisao",
          text:
            "Provisão segue o CPC 25: perda provável acima de 50% é reconhecida pelo valor esperado (probabilidade × valor), trazida a valor presente acima de 12 meses; entre 10% e 50% apenas se divulga; abaixo de 10% não entra. Ganho em causa ativa nunca é reconhecido.",
        },
        {
          key: "agro",
          text:
            "Margem é receita (área × produtividade × preço da unidade da cultura) menos custo (área × custo/ha). O ponto de equilíbrio do preço é custo ÷ unidades produzidas; o da produtividade, custo ÷ (área × preço). Barter vira taxa implícita: (valor na entrega ÷ valor à vista)^(12/meses) − 1.",
        },
        {
          key: "trilha",
          text:
            "A trilha de auditoria é encadeada: cada entrada tem SHA-256 do hash anterior mais o texto canônico da própria entrada. A âncora é o HMAC-SHA256 do manifest — se qualquer elo mudar, o hash não fecha.",
        },
        {
          key: "pl",
          text:
            "Patrimônio líquido = ativo total (financeiro + registral) − dívida. Alavancagem é dívida ÷ ativo. Nada é somado duas vezes: ativo registral entra pelo valor informado no cadastro do imóvel/veículo.",
        },
      ];
      const match = notes.find((note) => topic.includes(note.key)) ?? null;
      const text = match
        ? match.text
        : notes.map((note) => `**${note.key}** — ${note.text}`).join("\n\n");

      return {
        tool: "explicar_metodologia",
        label: "Metodologia",
        ok: true,
        summary: text,
        data: { topic: match?.key ?? "geral", notes },
        sources: [{ label: "Documentação", value: "IMPLEMENTACAO.md e telas de cada módulo" }],
      };
    },
  },
  {
    name: "propor_acao",
    label: "Proposta de ação",
    description: "Monta uma proposta (risco, plano de ação ou lançamento de provisão) que exige aprovação humana.",
    triggers: ["criar risco", "registrar risco", "criar plano", "plano de acao", "plano de ação", "propor", "sugira acao", "sugira ação", "cadastrar"],
    datasets: [],
    run: (data, args) => {
      const kind = (String(args.tipo ?? "criar_plano_acao") as JarvisProposalKind);
      const title = String(args.titulo ?? "").trim() || "Ação sugerida pelo JARVIS";
      const rationale =
        String(args.justificativa ?? "").trim() ||
        "Proposta gerada a partir do estado atual do portfólio; revise antes de aprovar.";
      const days = Number(args.prazo_dias ?? 30);
      const dueDate = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

      const proposal: JarvisProposal =
        kind === "criar_risco"
          ? {
              kind,
              title,
              rationale,
              payload: {
                title,
                description: rationale,
                severity: String(args.severidade ?? "medium"),
                status: "aberto",
                due_date: dueDate,
              },
              effect: `Cria um risco "${title}" com vencimento em ${dueDate}.`,
              requiresApproval: true,
            }
          : kind === "lancar_provisao"
            ? {
                kind,
                title,
                rationale,
                payload: {
                  case_id: args.case_id ?? null,
                  kind: String(args.lancamento ?? "constituicao"),
                  amount: Number(args.valor ?? 0),
                  occurred_on: new Date().toISOString().slice(0, 10),
                  note: rationale,
                },
                effect: `Lança ${brl(Number(args.valor ?? 0))} na provisão do processo indicado.`,
                requiresApproval: true,
              }
            : {
                kind: "criar_plano_acao",
                title,
                rationale,
                payload: {
                  title,
                  suggested_resolution: rationale,
                  impact_analysis: String(args.impacto ?? "Impacto estimado pelo JARVIS a partir do estado atual."),
                  priority: String(args.prioridade ?? "media"),
                  status: "pendente",
                  due_date: dueDate,
                },
                effect: `Cria um plano de ação "${title}" com prazo em ${dueDate}.`,
                requiresApproval: true,
              };

      return {
        tool: "propor_acao",
        label: "Proposta",
        ok: true,
        summary: `${proposal.effect} Requer aprovação humana antes de gravar.`,
        data: { proposal },
        sources: [{ label: "Aprovação", value: "obrigatória — nenhuma escrita automática" }],
        proposal,
      };
    },
  },
];

export const TOOL_BY_NAME = new Map(JARVIS_TOOLS.map((tool) => [tool.name, tool]));

/** Descrição das ferramentas para o prompt do LLM (nomes, para quê servem e quando usar). */
export function toolsToPrompt(): string {
  return JARVIS_TOOLS.map(
    (tool) => `- ${tool.name}: ${tool.description} (use quando a pergunta falar de: ${tool.triggers.slice(0, 6).join(", ")})`,
  ).join("\n");
}

export function runTool(
  name: JarvisToolName,
  data: JarvisToolData,
  args: Record<string, unknown> = {},
): ToolResult {
  const tool = TOOL_BY_NAME.get(name);
  if (!tool) {
    return {
      tool: name,
      label: name,
      ok: false,
      summary: `Ferramenta desconhecida: ${name}.`,
      data: {},
      sources: [],
    };
  }
  try {
    return tool.run(data, args);
  } catch (error) {
    // Ferramenta que quebra não pode derrubar a conversa.
    return {
      tool: name,
      label: tool.label,
      ok: false,
      summary: `Não consegui executar ${tool.label}: ${(error as Error).message}.`,
      data: {},
      sources: [],
    };
  }
}

/** Resume as execuções para o prompt do modelo (texto curto e factual). */
export function toolResultsToPrompt(results: ToolResult[]): string {
  if (results.length === 0) return "";
  return results
    .map((result) => `### ${result.label} (${result.tool})\n${result.summary}\nDados: ${JSON.stringify(result.data).slice(0, 1200)}`)
    .join("\n\n");
}
