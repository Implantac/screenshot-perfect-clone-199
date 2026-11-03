/**
 * JARVIS — Diretor Patrimonial Digital.
 *
 * Este módulo substitui a simulação (`setTimeout` + frase fixa) que existia no
 * chat por um agente real:
 *
 *  1. monta o briefing do portfólio do usuário logado (buildBriefing, RLS aplicado);
 *  2. se houver provedor de LLM configurado, envia o briefing como contexto factual
 *     e devolve a resposta do modelo;
 *  3. se não houver, responde com o analista local determinístico — mesmos números,
 *     sem inventar nada, e sinalizando o modo na interface.
 *
 * Configuração (server-side, nunca `VITE_`):
 *   JARVIS_LLM_PROVIDER = openai | anthropic | gemini   (opcional, inferido pela chave)
 *   JARVIS_LLM_API_KEY  = <chave>
 *   JARVIS_LLM_MODEL    = <modelo>                     (opcional, default por provedor)
 *   JARVIS_LLM_BASE_URL = <url>                        (opcional: gateway/proxy/Azure/mock)
 *
 * Também aceita OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { jarvisAskSchema } from "@/lib/validation/schemas";
import { buildBriefing, briefingToPrompt } from "@/lib/jarvis/briefing.server";
import { analyzeLocally } from "@/lib/jarvis/localAnalyst";
import { runJarvisTools } from "@/lib/jarvis/runner.server";
import { toolsToPrompt, toolResultsToPrompt, type ToolResult } from "@/lib/jarvis/tools";
import {
  applyProposal,
  createProposal,
  decideProposal,
  listProposals,
  type StoredProposal,
} from "@/lib/jarvis/proposals.server";
import {
  jarvisProposalApplySchema,
  jarvisProposalDecisionSchema,
} from "@/lib/validation/schemas";
import type {
  JarvisAnswer,
  JarvisProposalView,
  JarvisProvider,
  JarvisStatus,
  JarvisToolTrace,
  PortfolioBriefing,
} from "@/lib/jarvis/types";

const DEFAULT_MODELS: Record<Exclude<JarvisProvider, "local">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
};

/** Base URL configurável — permite gateway corporativo, proxy ou mock em testes. */
function baseUrl(provider: Exclude<JarvisProvider, "local">): string {
  const override = process.env.JARVIS_LLM_BASE_URL?.trim().replace(/\/$/, "");
  if (override) return override;
  if (provider === "openai") return "https://api.openai.com";
  if (provider === "anthropic") return "https://api.anthropic.com";
  return "https://generativelanguage.googleapis.com";
}

const SYSTEM_PROMPT = `Você é o JARVIS, Diretor Patrimonial Digital do PATRIUM OS.

Papel: assessor executivo de governança patrimonial no Brasil, falando com o gestor do family office/holding.
Regras invioláveis:
1. Use SOMENTE os dados do briefing fornecido. Nunca invente ativos, valores, datas ou documentos.
2. Se a informação não estiver no briefing, diga explicitamente que não há esse dado no sistema e sugira o que cadastrar.
3. Valores monetários em reais no formato R$ 12.345.678.
4. Seja direto e executivo: diagnóstico → evidência numérica → próxima ação recomendada.
5. Priorize risco e prazo. Aponte concentrações e vencimentos.
6. Português do Brasil, tom profissional, no máximo 220 palavras, use markdown simples (negrito, listas).
7. Nunca prometa resultado jurídico ou tributário; recomende validação com o responsável quando for o caso.
8. Ao final, se fizer sentido, sugira 2 ou 3 próximos passos em uma lista curta iniciada por "Próximos passos:".
9. Quando houver um bloco "FERRAMENTAS EXECUTADAS", os números dele são a fonte da verdade — use-os literalmente; não recalcule nem arredonde diferente.
10. Você não escreve no banco. Se a ação exigir gravar algo, diga que a proposta será criada para aprovação humana.`;

function resolveProvider(): {
  provider: JarvisProvider;
  apiKey: string | null;
  model: string | null;
} {
  const explicit = (process.env.JARVIS_LLM_PROVIDER ?? "").toLowerCase().trim();
  const keyFrom = (name: string): string | null => {
    const v = process.env[name];
    return v && v.trim().length > 10 ? v.trim() : null;
  };

  const openai = keyFrom("JARVIS_LLM_API_KEY") ?? keyFrom("OPENAI_API_KEY");
  const anthropic = keyFrom("ANTHROPIC_API_KEY");
  const gemini = keyFrom("GEMINI_API_KEY") ?? keyFrom("GOOGLE_API_KEY");

  let provider: JarvisProvider = "local";
  let apiKey: string | null = null;

  if (explicit === "openai" && openai) [provider, apiKey] = ["openai", openai];
  else if (explicit === "anthropic" && anthropic) [provider, apiKey] = ["anthropic", anthropic];
  else if (explicit === "gemini" && gemini) [provider, apiKey] = ["gemini", gemini];
  else if (explicit === "" || explicit === "auto") {
    if (openai) [provider, apiKey] = ["openai", openai];
    else if (anthropic) [provider, apiKey] = ["anthropic", anthropic];
    else if (gemini) [provider, apiKey] = ["gemini", gemini];
  }

  const model =
    provider === "local"
      ? null
      : (process.env.JARVIS_LLM_MODEL ??
        DEFAULT_MODELS[provider as Exclude<JarvisProvider, "local">]);

  return { provider, apiKey, model };
}

type ChatTurn = { role: "user" | "assistant"; content: string };

async function callOpenAI(
  apiKey: string,
  model: string,
  system: string,
  context: string,
  turns: ChatTurn[],
  question: string,
): Promise<string> {
  const res = await fetch(`${baseUrl("openai")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: `${system}\n\n### BRIEFING DO PORTFÓLIO\n${context}` },
        ...turns,
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI retornou resposta vazia.");
  return text;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  context: string,
  turns: ChatTurn[],
  question: string,
): Promise<string> {
  const res = await fetch(`${baseUrl("anthropic")}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.2,
      system: `${system}\n\n### BRIEFING DO PORTFÓLIO\n${context}`,
      messages: [...turns, { role: "user", content: question }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content
    ?.filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Anthropic retornou resposta vazia.");
  return text;
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  context: string,
  turns: ChatTurn[],
  question: string,
): Promise<string> {
  const res = await fetch(
    `${baseUrl("gemini")}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${system}\n\n### BRIEFING DO PORTFÓLIO\n${context}` }],
        },
        contents: [
          ...turns.map((t) => ({
            role: t.role === "assistant" ? "model" : "user",
            parts: [{ text: t.content }],
          })),
          { role: "user", parts: [{ text: question }] },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini retornou resposta vazia.");
  return text;
}

/** Extrai sugestões de "Próximos passos" para virar chips clicáveis. */
function extractFollowUps(answer: string): string[] {
  const block = answer.split(/pr[oó]ximos passos/i)[1];
  if (!block) return [];
  return block
    .split("\n")
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 6 && l.length < 120)
    .slice(0, 3);
}

function tracesFrom(results: ToolResult[], proposals: JarvisProposalView[]): JarvisToolTrace[] {
  return results.map((result) => ({
    tool: result.tool,
    label: result.label,
    ok: result.ok,
    summary: result.summary,
    sources: result.sources,
    proposalId:
      result.proposal
        ? (proposals.find((proposal) => proposal.kind === result.proposal?.kind && proposal.title === result.proposal?.title)
            ?.id ?? null)
        : null,
  }));
}

function toView(proposal: StoredProposal): JarvisProposalView {
  return {
    id: proposal.id,
    kind: proposal.kind,
    title: proposal.title,
    rationale: proposal.rationale,
    effect: proposal.effect,
    payload: proposal.payload,
    status: proposal.status,
    createdAt: proposal.createdAt,
  };
}

function sourcesFromBriefing(b: PortfolioBriefing): { label: string; value: string }[] {
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return [
    { label: "Patrimônio monitorado", value: `${brl(b.totals.aum)} · ${b.totals.assets} ativos` },
    {
      label: "Riscos abertos",
      value: `${b.totals.risksOpen} (${b.totals.risksCritical} críticos)`,
    },
    {
      label: "Documentos vencidos",
      value: `${b.totals.documentsOverdue} de ${b.totals.documentsExpiring} na janela`,
    },
    { label: "Base", value: "dados do seu tenant via RLS" },
  ];
}

// ============================================================== server functions

export const getJarvisStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<JarvisStatus> => {
    const { provider, model } = resolveProvider();
    return { provider, model, configured: provider !== "local" };
  },
);

export const askJarvis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(jarvisAskSchema)
  .handler(async ({ data, context }): Promise<JarvisAnswer> => {
    const briefing = await buildBriefing(context.supabase);
    const question = data.message;
    const turns: ChatTurn[] = (data.history ?? []).slice(-8);
    const { provider, apiKey, model } = resolveProvider();

    // 1) Ferramentas rodam ANTES do modelo: o número é calculado, não alucinado.
    const tools = await runJarvisTools(context.supabase, question, briefing);
    const warnings = [...tools.warnings];

    // 2) Proposta de escrita nunca é aplicada aqui: nasce pendente e auditada.
    const created: JarvisProposalView[] = [];
    for (const result of tools.results) {
      if (!result.proposal) continue;
      const stored = await createProposal(context.supabase, context.userId, result.proposal, {
        question,
        tool: result.tool,
      });
      if (stored) created.push(toView(stored));
      else warnings.push("Não consegui registrar a proposta (migration 20261030260000 aplicada?).");
    }

    const toolBlock = toolResultsToPrompt(tools.results);
    const traces = tracesFrom(tools.results, created);

    const fallback = (note?: string): JarvisAnswer => {
      const local = analyzeLocally(question, briefing);
      // Com ferramenta executada, o analista local devolve o número calculado —
      // é o que faz o tool-use valer alguma coisa mesmo sem chave de LLM.
      const toolText = tools.results
        .filter((result) => result.ok)
        .map((result) => `**${result.label}** — ${result.summary}`)
        .join("\n\n");
      const answer = toolText
        ? [note, toolText, local.answer].filter(Boolean).join("\n\n")
        : [note, local.answer].filter(Boolean).join("\n\n");
      return {
        answer,
        provider: "local",
        sources: [
          ...tools.results.flatMap((result) => result.sources),
          ...sourcesFromBriefing(briefing),
        ],
        followUps: local.followUps,
        generatedAt: new Date().toISOString(),
        toolCalls: traces,
        proposals: created,
        warnings,
      };
    };

    if (provider === "local" || !apiKey || !model) return fallback();

    const contextPrompt = [briefingToPrompt(briefing), toolBlock && `### FERRAMENTAS EXECUTADAS\n${toolBlock}`, `### FERRAMENTAS DISPONÍVEIS (já executadas pelo sistema)\n${toolsToPrompt()}`]
      .filter(Boolean)
      .join("\n\n");

    try {
      let answer: string;
      if (provider === "openai") {
        answer = await callOpenAI(apiKey, model, SYSTEM_PROMPT, contextPrompt, turns, question);
      } else if (provider === "anthropic") {
        answer = await callAnthropic(apiKey, model, SYSTEM_PROMPT, contextPrompt, turns, question);
      } else {
        answer = await callGemini(apiKey, model, SYSTEM_PROMPT, contextPrompt, turns, question);
      }

      return {
        answer,
        provider,
        sources: [
          ...tools.results.flatMap((result) => result.sources),
          ...sourcesFromBriefing(briefing),
        ],
        followUps: extractFollowUps(answer),
        generatedAt: new Date().toISOString(),
        toolCalls: traces,
        proposals: created,
        warnings,
      };
    } catch (error) {
      // Falha do provedor não pode virar tela quebrada: cai no analista local.
      console.error("[JARVIS] falha no provedor de LLM, usando analista local:", error);
      return fallback(
        "_Não consegui falar com o provedor de IA agora; segue a análise local sobre os seus dados._",
      );
    }
  });

// ------------------------------------------------- propostas (aprovação humana)

export const listJarvisProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JarvisProposalView[]> => {
    const proposals = await listProposals(context.supabase);
    return proposals.map(toView);
  });

export const decideJarvisProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(jarvisProposalDecisionSchema)
  .handler(async ({ data, context }): Promise<JarvisProposalView> => {
    const updated = await decideProposal(context.supabase, context.userId, data);
    if (!updated) throw new Error("Não consegui registrar a decisão.");
    return toView(updated);
  });

export const applyJarvisProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(jarvisProposalApplySchema)
  .handler(async ({ data, context }): Promise<{ ok: boolean; message: string; proposal: JarvisProposalView | null }> => {
    const result = await applyProposal(context.supabase, context.userId, data.id);
    return {
      ok: result.ok,
      message: result.message,
      proposal: result.proposal ? toView(result.proposal) : null,
    };
  });

/** Pré-visualização do briefing — usada no painel de contexto do chat. */
export const getPortfolioBriefing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortfolioBriefing> => buildBriefing(context.supabase));
