/**
 * Analista local do JARVIS — motor de regras determinístico.
 *
 * Usado quando NÃO há provedor de LLM configurado. Não é um texto de enfeite:
 * cada resposta é montada a partir dos números reais do briefing do usuário,
 * com as mesmas fontes que seriam enviadas ao modelo. Assim a tela continua
 * útil (e honesta sobre o modo) mesmo sem chave de API.
 */
import type { PortfolioBriefing } from "./types";
import { DEFAULT_STATE, ITCMD_TABLE, simulateSuccession } from "@/lib/wealth/succession";

export type LocalAnalysis = {
  answer: string;
  followUps: string[];
};

const money = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const pct = (v: number, total: number): string =>
  total > 0 ? `${Math.round((v / total) * 100)}%` : "0%";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "crítico",
  high: "alto",
  medium: "médio",
  low: "baixo",
};

const TYPE_LABEL: Record<string, string> = {
  rural: "rural",
  urbano: "urbano",
  veiculo: "veículo",
  outro: "outro",
};

function riskSection(b: PortfolioBriefing): LocalAnalysis {
  const { risksOpen, risksCritical } = b.totals;
  if (risksOpen === 0) {
    return {
      answer:
        "Não há riscos abertos no seu portfólio neste momento. A central de riscos está limpa — mantenho o monitoramento de vencimentos de documentos e obrigações ativo.",
      followUps: ["Quais documentos vencem nos próximos 60 dias?", "Como está meu compliance?"],
    };
  }

  const lines =
    `**${risksOpen} risco(s) aberto(s)**, sendo **${risksCritical} crítico(s)**. ` +
    `Exposição está concentrada nos itens abaixo, em ordem de severidade e prazo:\n`;

  const top = b.risks.slice(0, 5).map((r, i) => {
    const due = r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "sem prazo";
    return `${i + 1}. **${r.title}** — severidade ${SEVERITY_LABEL[r.severity] ?? r.severity}, vence em ${due}${
      r.entity ? ` (${r.entity})` : ""
    }`;
  });

  const overdue = b.risks.filter((r) => r.dueDate && new Date(r.dueDate) < new Date()).length;

  return {
    answer:
      lines +
      top.join("\n") +
      (overdue
        ? `\n\n⚠️ **${overdue} risco(s) já com prazo vencido** — priorize a regularização antes de qualquer nova aquisição.`
        : "\n\nNenhum prazo vencido até agora: o trabalho é de antecipação, não de contenção."),
    followUps: [
      "Quais documentos vencem nos próximos 60 dias?",
      "Monte um plano de ação para o risco crítico",
    ],
  };
}

function documentSection(b: PortfolioBriefing): LocalAnalysis {
  const overdue = b.documentsExpiring.filter((d) => (d.daysToExpire ?? 0) < 0);
  const soon = b.documentsExpiring.filter(
    (d) => (d.daysToExpire ?? 0) >= 0 && (d.daysToExpire ?? 0) <= 30,
  );

  if (b.documentsExpiring.length === 0) {
    return {
      answer:
        "Nenhum documento entra na janela de vencimento de 60 dias. O cofre digital está em dia para os documentos cadastrados.",
      followUps: ["Como está meu compliance?", "Resumo do patrimônio"],
    };
  }

  const list = b.documentsExpiring.slice(0, 6).map((d) => {
    const days = d.daysToExpire ?? 0;
    const when = days < 0 ? `vencido há ${Math.abs(days)} dia(s)` : `vence em ${days} dia(s)`;
    return `- **${d.title}** (${d.type ?? "sem tipo"}) — ${when} · status ${d.status}`;
  });

  return {
    answer:
      `Tenho **${b.documentsExpiring.length} documento(s)** dentro da janela de 60 dias` +
      (overdue.length ? `, dos quais **${overdue.length} já estão vencidos**` : "") +
      (soon.length ? ` e **${soon.length} vencem em até 30 dias**` : "") +
      ":\n\n" +
      list.join("\n") +
      "\n\nPrioridade de execução: regularize primeiro os vencidos (bloqueiam averbação, venda e crédito) e depois os de 30 dias.",
    followUps: ["Quais são meus riscos críticos?", "Como está meu compliance?"],
  };
}

function patrimonySection(b: PortfolioBriefing): LocalAnalysis {
  const t = b.totals;
  const byType = b.assetsByType
    .map((a) => `${TYPE_LABEL[a.type] ?? a.type}: ${money(a.value)} (${pct(a.value, t.aum)})`)
    .join(" · ");

  const top = b.topAssets
    .slice(0, 4)
    .map((a) => `- ${a.name} — ${money(a.value)} (${TYPE_LABEL[a.type] ?? a.type})`)
    .join("\n");

  return {
    answer:
      `Seu patrimônio consolidado é de **${money(t.aum)}**, distribuído em ${t.assets} ativo(s) sob ${t.entities} entidade(s).\n\n` +
      `**Alocação por classe:** ${byType || "sem ativos cadastrados"}.\n\n` +
      `**Maiores posições:**\n${top || "—"}\n\n` +
      `Ponto de atenção de concentração: a maior posição isolada representa ${pct(
        b.topAssets[0]?.value ?? 0,
        t.aum,
      )} do portfólio.`,
    followUps: ["Quais são meus riscos críticos?", "Como está a estrutura das holdings?"],
  };
}

function complianceSection(b: PortfolioBriefing): LocalAnalysis {
  if (b.entities.length === 0) {
    return {
      answer: "Não há holdings cadastradas para calcular o compliance.",
      followUps: ["Resumo do patrimônio"],
    };
  }
  const avg = b.entities.reduce((s, e) => s + e.compliance, 0) / b.entities.length;
  const worst = [...b.entities].sort((a, c) => a.compliance - c.compliance)[0];
  const list = b.entities
    .map((e) => `- ${e.name}: **${e.compliance}%** (${e.assets} ativo(s), ${money(e.value)})`)
    .join("\n");

  return {
    answer:
      `Compliance médio do grupo: **${avg.toFixed(1)}%**.\n\n${list}\n\n` +
      `A entidade com maior exposição é **${worst.name}** (${worst.compliance}%)` +
      (b.totals.risksCritical > 0
        ? `, e há ${b.totals.risksCritical} risco(s) crítico(s) que puxam o score para baixo.`
        : "."),
    followUps: ["Quais são meus riscos críticos?", "Quais documentos vencem nos próximos 60 dias?"],
  };
}

function financeSection(b: PortfolioBriefing): LocalAnalysis {
  const { income6m, expense6m } = b.totals;
  const net = income6m - expense6m;
  const topExpense = b.categories.filter((c) => c.type === "expense").slice(0, 4);
  const topIncome = b.categories.filter((c) => c.type === "income").slice(0, 4);

  return {
    answer:
      `Nos últimos 6 meses: **${money(income6m)}** de entradas e **${money(expense6m)}** de saídas — resultado de **${money(net)}**` +
      `${income6m > 0 ? ` (margem de ${pct(net, income6m)})` : ""}.\n\n` +
      `**Principais entradas:**\n${topIncome.map((c) => `- ${c.category}: ${money(c.total)}`).join("\n") || "—"}\n\n` +
      `**Principais saídas:**\n${topExpense.map((c) => `- ${c.category}: ${money(c.total)}`).join("\n") || "—"}`,
    followUps: ["Resumo do patrimônio", "Como está meu compliance?"],
  };
}

function structureSection(b: PortfolioBriefing): LocalAnalysis {
  if (b.entities.length === 0) {
    return { answer: "Nenhuma holding cadastrada ainda.", followUps: ["Resumo do patrimônio"] };
  }
  const list = b.entities
    .map(
      (e) =>
        `- **${e.name}** (${e.type ?? "sem tipo"}) — ${money(e.value)} · ${e.assets} ativo(s) · compliance ${e.compliance}%`,
    )
    .join("\n");
  return {
    answer:
      `Sua estrutura tem **${b.entities.length} entidade(s)** e **${b.totals.members} pessoa(s)** vinculada(s):\n\n` +
      list +
      `\n\nTotal consolidado: **${money(b.totals.aum)}**.`,
    followUps: ["Como está meu compliance?", "Quais são meus riscos críticos?"],
  };
}

function overviewSection(b: PortfolioBriefing): LocalAnalysis {
  const t = b.totals;
  return {
    answer:
      `**Panorama do portfólio** (${new Date().toLocaleDateString("pt-BR")})\n\n` +
      `- Patrimônio consolidado: **${money(t.aum)}** em ${t.assets} ativo(s) e ${t.entities} entidade(s)\n` +
      `- Riscos abertos: **${t.risksOpen}** (críticos: ${t.risksCritical})\n` +
      `- Documentos vencidos: **${t.documentsOverdue}** · vencendo em 60 dias: ${t.documentsExpiring}\n` +
      `- Insights não tratados: **${t.insightsOpen}**\n` +
      `- Resultado 6 meses: ${money(t.income6m - t.expense6m)}\n\n` +
      (t.risksCritical > 0
        ? `Ação recomendada agora: tratar os ${t.risksCritical} risco(s) crítico(s) — eles são o gargalo do seu compliance.`
        : "Nenhum risco crítico aberto: momento de revisar alocação e planejamento sucessório."),
    followUps: [
      "Quais são meus riscos críticos?",
      "Quais documentos vencem nos próximos 60 dias?",
      "Resumo do patrimônio",
    ],
  };
}

type Intent =
  | "risco"
  | "documento"
  | "patrimonio"
  | "performance"
  | "sucessao"
  | "compliance"
  | "financeiro"
  | "estrutura"
  | "geral";

/** Custódia + performance: TWR/MWR, líquidez, offshore e concentração. */
function performanceSection(b: PortfolioBriefing): LocalAnalysis {
  const custody = b.custody;
  if (!custody) {
    return {
      answer:
        "Ainda não há posições financeiras cadastradas, então não consigo calcular rentabilidade. " +
        "Lance as posições em **Custódia & Performance** (ou popule a demonstração) que eu passo a responder TWR, MWR e comparação com o CDI.",
      followUps: ["Como lançar minhas posições?", "Qual é o meu patrimônio total?"],
    };
  }

  const classes = custody.byClass
    .map((bucket) => `${bucket.asset_class}: ${money(bucket.value)} (${bucket.percentage.toFixed(1)}%)`)
    .join(" · ");

  const twr = custody.twr === null ? "sem série de fechamentos" : `${custody.twr.toFixed(2)}%`;
  const mwr = custody.mwr === null ? "não calculável (sem fluxos)" : `${custody.mwr.toFixed(2)}% a.a.`;
  const excess =
    custody.benchmarkExcess === null
      ? "sem base de comparação"
      : `${custody.benchmarkExcess >= 0 ? "+" : ""}${custody.benchmarkExcess.toFixed(2)} p.p. vs CDI`;

  return {
    answer:
      `Seu patrimônio **financeiro** é de **${money(custody.financialValue)}** em ${custody.positions} posição(ões).\n\n` +
      `**Retorno:** TWR ${twr} (estratégia, já descontando aportes) · MWR ${mwr} (seu retorno como investidor) · ${excess}.\n\n` +
      `**Alocação:** ${classes || "sem classes"}.\n\n` +
      `**Liquidez:** ${custody.liquidPercentage.toFixed(1)}% disponível em até D+1 · ` +
      `${custody.offshorePercentage.toFixed(1)}% offshore · concentração (HHI) ${custody.concentration.toFixed(3)}` +
      (custody.topPosition
        ? ` · maior posição: ${custody.topPosition.name} (${custody.topPosition.percentage.toFixed(1)}%).`
        : "."),
    followUps: ["Como estou em relação ao CDI?", "Quanto tenho disponível em D+1?"],
  };
}

/** Sucessão: ordem de grandeza do custo de transmissão, sem substituir o simulador. */
function successionSection(b: PortfolioBriefing): LocalAnalysis {
  const custody = b.custody;
  const base = custody?.financialValue ?? b.totals.aum;
  if (base <= 0) {
    return {
      answer:
        "Não tenho patrimônio consolidado para simular sucessão. Cadastre posições ou ativos e eu estimo o custo de transmissão.",
      followUps: ["O que é ITCMD?", "Como funciona a holding familiar?"],
    };
  }

  const simulation = simulateSuccession({
    patrimony: base,
    regime: "comunhao_parcial",
    state: DEFAULT_STATE,
    heirs: Math.max(1, b.totals.members),
  });

  return {
    answer:
      `Com **${money(base)}** e comunhão parcial de bens em ${ITCMD_TABLE[DEFAULT_STATE].name}, o espólio seria de ` +
      `${money(simulation.estate)} e o custo total de transmissão (ITCMD + inventário + honorários) cerca de ` +
      `**${money(simulation.totalCost)}** — ${simulation.effectiveCost.toFixed(1)}% do patrimônio (alíquota efetiva de ITCMD: ` +
      `${simulation.itcmd.effectiveRate.toFixed(2)}%).\n\n` +
      `Sobram aproximadamente ${money(simulation.perHeir)} por herdeiro (${Math.max(1, b.totals.members)} considerados).\n\n` +
      `Rode a comparação completa em **Sucessão & Tributação** para ver doação em vida e holding familiar lado a lado. ` +
      `Não substitui parecer jurídico.`,
    followUps: ["Quanto custa doar em vida?", "Vale a pena a holding familiar?"],
  };
}

function detectIntent(question: string): Intent {
  const q = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/(sucess|heranca|herdeir|itcmd|inventario|doacao|testamento)/.test(q)) return "sucessao";
  if (/(rentabilidade|performance|twr|mwr|xirr|cdi|benchmark|retorno|drawdown|liquidez|offshore)/.test(q))
    return "performance";
  if (/(risco|riscos|critico|criticos|alerta|urgencia|exposicao)/.test(q)) return "risco";
  if (/(document|venc|prazo|matricula|certidao|car\b|itr|cnd)/.test(q)) return "documento";
  if (/(compliance|conformidade|score|governanca)/.test(q)) return "compliance";
  if (/(fluxo|caixa|financeir|receita|despesa|entrada|saida|dividendo|resultado|lucro)/.test(q))
    return "financeiro";
  if (/(holding|estrutura|societar|entidade|sucess|familia|socio)/.test(q)) return "estrutura";
  if (/(patrimonio|ativo|imovel|fazenda|valor|aum|carteira|alocacao|concentracao)/.test(q))
    return "patrimonio";
  return "geral";
}

/** Responde a pergunta usando apenas os dados do briefing. */
export function analyzeLocally(question: string, briefing: PortfolioBriefing): LocalAnalysis {
  // Tenant vazio de verdade: nem posição financeira, nem ativo registral.
  const hasCustody = (briefing.custody?.positions ?? 0) > 0;
  if (briefing.totals.assets === 0 && briefing.totals.entities === 0 && !hasCustody) {
    return {
      answer:
        "Ainda não há patrimônio cadastrado na sua conta, então não tenho base para analisar. Popule a demonstração (ou cadastre sua primeira holding e seus ativos) e eu passo a responder com números reais.",
      followUps: ["Como cadastrar minha primeira holding?"],
    };
  }

  switch (detectIntent(question)) {
    case "risco":
      return riskSection(briefing);
    case "documento":
      return documentSection(briefing);
    case "patrimonio":
      return patrimonySection(briefing);
    case "performance":
      return performanceSection(briefing);
    case "sucessao":
      return successionSection(briefing);
    case "compliance":
      return complianceSection(briefing);
    case "financeiro":
      return financeSection(briefing);
    case "estrutura":
      return structureSection(briefing);
    default:
      return overviewSection(briefing);
  }
}
