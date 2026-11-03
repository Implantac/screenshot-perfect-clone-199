/**
 * Propostas do JARVIS — escrita com aprovação humana (wave 21).
 *
 * Regra de ouro: **o agente não escreve**. Ele propõe. A proposta fica em
 * `jarvis_proposals` com status `pending`, o gestor aprova ou rejeita na tela do
 * chat, e só depois do "aprovar" a gravação acontece — com o autor real na
 * trilha de auditoria, não o modelo.
 *
 * Por que assim e não "tool que escreve":
 *  - um LLM com INSERT é um incidente esperando acontecer (duplicidade, valor
 *    errado, prazo inventado);
 *  - aprovação humana dá o que a governança exige: quem pediu, o que mudaria,
 *    quem autorizou e quando;
 *  - a transição `pending → approved → applied` é unilateral e idempotente: a
 *    gravação usa `status = 'approved'` como trava, então dois cliques não
 *    criam dois registros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { JarvisProposal } from "@/lib/jarvis/tools";
import type { JarvisProposalPayload } from "@/lib/jarvis/types";

type Client = SupabaseClient<Database>;

export type ProposalStatus = "pending" | "approved" | "rejected" | "applied" | "failed";

export type StoredProposal = {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  effect: string;
  payload: JarvisProposalPayload;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
  appliedAt: string | null;
  appliedRecordId: string | null;
  error: string | null;
};

type ProposalRow = Database["public"]["Tables"]["jarvis_proposals"]["Row"];

const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Rejeitada",
  applied: "Aplicada",
  failed: "Falhou ao aplicar",
};

export const proposalStatusLabel = (status: string) => STATUS_LABEL[status as ProposalStatus] ?? status;

function toStored(row: ProposalRow): StoredProposal {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    rationale: row.rationale ?? "",
    effect: row.effect ?? "",
    payload: (row.payload ?? {}) as unknown as JarvisProposalPayload,
    status: row.status as ProposalStatus,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    appliedAt: row.applied_at,
    appliedRecordId: row.applied_record_id,
    error: row.error,
  };
}

/** Trilha: cada passo da proposta é uma entrada encadeada em `audit_logs`. */
async function audit(
  supabase: Client,
  userId: string,
  action: string,
  recordId: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    owner_user_id: userId,
    user_id: userId,
    action,
    table_name: "jarvis_proposals",
    record_id: recordId,
    new_data: data as never,
    // A cadeia (sequence/prev_hash/entry_hash) é preenchida pelo trigger
    // `chain_audit_logs` da wave 20 — nunca pelo cliente.
    sequence: null,
    prev_hash: null,
    entry_hash: null,
  });
  // Auditoria não pode derrubar a operação principal — mas precisa gritar no log.
  if (error) console.error("[JARVIS] falha ao gravar trilha da proposta:", error.message);
}

export async function createProposal(
  supabase: Client,
  userId: string,
  proposal: JarvisProposal,
  meta: { question: string; tool: string },
): Promise<StoredProposal | null> {
  const { data, error } = await supabase
    .from("jarvis_proposals")
    .insert({
      owner_user_id: userId,
      kind: proposal.kind,
      title: proposal.title,
      rationale: proposal.rationale,
      effect: proposal.effect,
      payload: proposal.payload as never,
      status: "pending",
      tool: meta.tool,
      question: meta.question,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[JARVIS] não consegui registrar a proposta:", error?.message);
    return null;
  }

  await audit(supabase, userId, "jarvis.proposal.created", data.id, {
    kind: proposal.kind,
    title: proposal.title,
    effect: proposal.effect,
  });
  return toStored(data);
}

export async function listProposals(supabase: Client, limit = 30): Promise<StoredProposal[]> {
  const { data, error } = await supabase
    .from("jarvis_proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    // Tabela ainda não migrada não pode quebrar o chat.
    if (!/does not exist|schema cache/i.test(error.message)) {
      console.error("[JARVIS] falha ao listar propostas:", error.message);
    }
    return [];
  }
  return (data ?? []).map(toStored);
}

export async function decideProposal(
  supabase: Client,
  userId: string,
  input: { id: string; decision: "approved" | "rejected"; note?: string },
): Promise<StoredProposal | null> {
  const { data, error } = await supabase
    .from("jarvis_proposals")
    .update({
      status: input.decision,
      decided_at: new Date().toISOString(),
      decided_by: userId,
      decision_note: input.note?.slice(0, 500) ?? null,
    })
    .eq("id", input.id)
    .eq("status", "pending") // trava: só decide uma vez
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`Não consegui ${input.decision === "approved" ? "aprovar" : "rejeitar"}: ${error.message}`);
  if (!data) throw new Error("Proposta não encontrada ou já decidida.");

  await audit(supabase, userId, `jarvis.proposal.${input.decision}`, data.id, {
    kind: data.kind,
    title: data.title,
    note: input.note ?? null,
  });
  return toStored(data);
}

type ApplyResult = { recordId: string | null; message: string };

/** Grava o efeito aprovado. Chamado só depois de `approved`. */
async function applyEffect(
  supabase: Client,
  kind: string,
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  if (kind === "criar_risco") {
    const { data, error } = await supabase
      .from("risks")
      .insert({
        title: String(payload.title ?? "Risco proposto pelo JARVIS"),
        description: (payload.description as string | null) ?? null,
        severity: (payload.severity as never) ?? "medium",
        status: "aberto",
        due_date: (payload.due_date as string | null) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar o risco: ${error.message}`);
    return { recordId: data.id, message: "Risco criado." };
  }

  if (kind === "criar_plano_acao") {
    const { data, error } = await supabase
      .from("jarvis_action_plans")
      .insert({
        title: String(payload.title ?? "Plano de ação proposto pelo JARVIS"),
        suggested_resolution: (payload.suggested_resolution as string | null) ?? null,
        impact_analysis: (payload.impact_analysis as string | null) ?? null,
        priority: String(payload.priority ?? "media"),
        status: "pendente",
        due_date: (payload.due_date as string | null) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar o plano de ação: ${error.message}`);
    return { recordId: data.id, message: "Plano de ação criado." };
  }

  if (kind === "lancar_provisao") {
    const caseId = payload.case_id ? String(payload.case_id) : null;
    if (!caseId) throw new Error("Lançamento de provisão exige o processo (case_id).");
    const amount = Number(payload.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor da provisão precisa ser positivo.");
    const { data, error } = await supabase
      .from("legal_provision_entries")
      .insert({
        case_id: caseId,
        kind: (payload.kind as never) ?? "constituicao",
        amount,
        occurred_on: String(payload.occurred_on ?? new Date().toISOString().slice(0, 10)),
        note: (payload.note as string | null) ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao lançar a provisão: ${error.message}`);
    return { recordId: data.id, message: "Provisão lançada." };
  }

  throw new Error(`Tipo de proposta desconhecido: ${kind}`);
}

export async function applyProposal(
  supabase: Client,
  userId: string,
  id: string,
): Promise<{ ok: boolean; message: string; proposal: StoredProposal | null }> {
  const { data: current, error: readError } = await supabase
    .from("jarvis_proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readError) throw new Error(`Não consegui ler a proposta: ${readError.message}`);
  if (!current) throw new Error("Proposta não encontrada.");
  if (current.status === "applied") {
    return { ok: true, message: "Proposta já aplicada.", proposal: toStored(current) };
  }
  if (current.status !== "approved") {
    throw new Error("A proposta precisa ser aprovada antes de ser aplicada.");
  }

  try {
    const result = await applyEffect(supabase, current.kind, (current.payload ?? {}) as Record<string, unknown>);
    const { data: updated } = await supabase
      .from("jarvis_proposals")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        applied_record_id: result.recordId,
      })
      .eq("id", id)
      // Se outro request aplicou primeiro, este UPDATE não pega a linha.
      .eq("status", "approved")
      .select("*")
      .maybeSingle();

    await audit(supabase, userId, "jarvis.proposal.applied", id, {
      kind: current.kind,
      title: current.title,
      recordId: result.recordId,
      table:
        current.kind === "criar_risco"
          ? "risks"
          : current.kind === "criar_plano_acao"
            ? "jarvis_action_plans"
            : "legal_provision_entries",
    });

    return {
      ok: true,
      message: result.message,
      proposal: updated ? toStored(updated) : toStored(current),
    };
  } catch (error) {
    const message = (error as Error).message;
    await supabase
      .from("jarvis_proposals")
      .update({ status: "failed", error: message.slice(0, 500) })
      .eq("id", id);
    await audit(supabase, userId, "jarvis.proposal.failed", id, { kind: current.kind, error: message });
    return { ok: false, message, proposal: { ...toStored(current), status: "failed", error: message } };
  }
}
