/**
 * Roteador de ferramentas do JARVIS.
 *
 * O problema do agente "só LLM" é que ele precisa de chave para funcionar — e
 * mesmo com chave, decidir qual número consultar pode falhar silenciosamente.
 * Aqui a decisão de **qual ferramenta rodar** é lexical e determinística: se a
 * pergunta fala de fazenda, chama a ferramenta do agro; se fala de processo,
 * chama o contencioso. O LLM (quando existe) recebe o resultado pronto e escreve.
 *
 * Vantagens concretas:
 *   - funciona **sem chave** — o analista local responde com o número calculado;
 *   - é auditável: a execução registra qual ferramenta rodou e por quê;
 *   - é testável: pergunta → ferramenta esperada, sem rede.
 *
 * Limite declarado: roteamento lexical erra em pergunta ambígua ("como está
 * tudo?"). Nesse caso devolve várias ferramentas de resumo, nunca uma escolha
 * silenciosa errada.
 */

import type { DatasetKey, JarvisTool, JarvisToolName } from "@/lib/jarvis/tools";
import { JARVIS_TOOLS } from "@/lib/jarvis/tools";

export type RouteMatch = {
  tool: JarvisToolName;
  score: number;
  matched: string[];
};

export type RouteResult = {
  tools: JarvisToolName[];
  matches: RouteMatch[];
  datasets: DatasetKey[];
  /** Nenhuma ferramenta passou do corte: o assistente responde do briefing. */
  empty: boolean;
  reason: string;
};

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Perguntas de "panorama" acionam as ferramentas de resumo, de propósito. */
const OVERVIEW = ["panorama", "visao geral", "visão geral", "como esta tudo", "como está tudo", "resumo geral", "situacao", "situação", "diagnostico", "diagnóstico"];
const OVERVIEW_TOOLS: JarvisToolName[] = ["patrimonio_resumo", "riscos_abertos", "documentos_vencendo"];

function scoreTool(tool: JarvisTool, question: string): RouteMatch {
  const matched: string[] = [];
  let score = 0;
  for (const trigger of tool.triggers) {
    const needle = normalize(trigger);
    if (!needle) continue;
    if (question.includes(needle)) {
      matched.push(trigger);
      // Frase longa vale mais que palavra solta: "risco de mercado" > "risco".
      score += needle.includes(" ") ? needle.split(" ").length * 2 : 1;
    }
  }
  return { tool: tool.name, score, matched };
}

export type RouteOptions = {
  /** Quantas ferramentas executar no máximo (custo e ruído). */
  maxTools?: number;
  /** Pontuação mínima para considerar a ferramenta relevante. */
  minScore?: number;
};

export function routeQuestion(question: string, options: RouteOptions = {}): RouteResult {
  const maxTools = options.maxTools ?? 2;
  const minScore = options.minScore ?? 1;
  const normalized = normalize(question);

  if (!normalized) {
    return { tools: [], matches: [], datasets: [], empty: true, reason: "Pergunta vazia." };
  }

  const matches = JARVIS_TOOLS.map((tool) => scoreTool(tool, normalized))
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score || a.tool.localeCompare(b.tool));

  let tools = matches.slice(0, maxTools).map((match) => match.tool);

  if (tools.length === 0 && OVERVIEW.some((term) => normalized.includes(normalize(term)))) {
    tools = OVERVIEW_TOOLS.slice(0, maxTools);
    return {
      tools,
      matches: [],
      datasets: datasetsFor(tools),
      empty: false,
      reason: "Pergunta de panorama: acionando as ferramentas de resumo.",
    };
  }

  return {
    tools,
    matches,
    datasets: datasetsFor(tools),
    empty: tools.length === 0,
    reason:
      tools.length === 0
        ? "Nenhuma ferramenta corresponde à pergunta: respondendo com o briefing."
        : `Ferramentas escolhidas por correspondência lexical: ${tools.join(", ")}.`,
  };
}

export function datasetsFor(tools: JarvisToolName[]): DatasetKey[] {
  const keys = new Set<DatasetKey>();
  for (const name of tools) {
    const tool = JARVIS_TOOLS.find((item) => item.name === name);
    for (const dataset of tool?.datasets ?? []) keys.add(dataset);
  }
  return Array.from(keys);
}

/**
 * Argumentos inferidos da pergunta.
 *
 * Só o que dá para inferir com honestidade: choque percentual numa classe
 * ("e se imóveis caírem 20%?") e janela de dias ("próximos 90 dias"). O resto
 * fica no default da ferramenta — chutar argumento seria pior que usar o padrão.
 */
export function inferArgs(question: string): Record<string, unknown> {
  const normalized = normalize(question);
  const args: Record<string, unknown> = {};

  const shock = normalized.match(/(?:cair|cai|queda|desvaloriz|choque|recuo)[^\d]{0,20}(\d{1,2})\s*%?/);
  const percent = normalized.match(/(-?\d{1,3})\s*%/);
  if (shock) args.choque_percentual = -Math.abs(Number(shock[1]));
  else if (percent && /(cair|queda|desvaloriz|choque)/.test(normalized)) {
    args.choque_percentual = -Math.abs(Number(percent[1]));
  }

  if (/(imoveis|imovel|imóveis|imóvel|terra|fazenda)/.test(normalized)) args.classe = "imoveis";
  else if (/(renda variavel|renda variável|acoes|ações|bolsa)/.test(normalized)) args.classe = "renda_variavel";
  else if (/(renda fixa|cri|cra|titulo|título)/.test(normalized)) args.classe = "renda_fixa";
  else if (/(fundo|fundos|fii)/.test(normalized)) args.classe = "fundos";
  else if (/(dolar|dólar|internacional|exterior)/.test(normalized)) args.classe = "internacional";
  else if (/(cripto|bitcoin|btc)/.test(normalized)) args.classe = "cripto";

  const days = normalized.match(/(\d{1,3})\s*dias/);
  if (days) args.dias = Number(days[1]);

  return args;
}
