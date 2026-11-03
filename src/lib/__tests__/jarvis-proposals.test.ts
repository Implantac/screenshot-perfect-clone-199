import { describe, expect, it } from "bun:test";
import { asClient, FakeDatabase } from "@/lib/__tests__/helpers/fakeSupabase";
import {
  applyProposal,
  createProposal,
  decideProposal,
  listProposals,
  proposalStatusLabel,
} from "@/lib/jarvis/proposals.server";
import type { JarvisProposal } from "@/lib/jarvis/tools";

const OWNER = "11111111-1111-4111-8111-111111111111";

const riskProposal: JarvisProposal = {
  kind: "criar_risco",
  title: "Reservar caixa para o trabalhista",
  rationale: "Provisão de R$ 140 mil com liquidez curta.",
  payload: { title: "Reservar caixa para o trabalhista", severity: "high", status: "aberto", due_date: "2026-12-01" },
  effect: 'Cria um risco "Reservar caixa para o trabalhista" com vencimento em 2026-12-01.',
  requiresApproval: true,
};

describe("ciclo de vida da proposta", () => {
  it("cria sempre como pendente", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "e o trabalhista?", tool: "propor_acao" });
    expect(created?.status).toBe("pending");
    expect(db.rows("jarvis_proposals")[0]?.status).toBe("pending");
  });

  it("grava a trilha na criação", async () => {
    const db = new FakeDatabase();
    await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    const logs = db.rows("audit_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("jarvis.proposal.created");
    expect(logs[0]?.owner_user_id).toBe(OWNER);
    // A cadeia é do trigger, nunca do cliente.
    expect(logs[0]?.sequence).toBeNull();
    expect(logs[0]?.entry_hash).toBeNull();
  });

  it("não cria nada além do pedido: nenhuma escrita no módulo de destino", async () => {
    const db = new FakeDatabase();
    await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    expect(db.rows("risks")).toHaveLength(0);
  });

  it("devolve null (sem lançar) quando o insert falha", async () => {
    const db = new FakeDatabase({ failInsertOn: "jarvis_proposals" });
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    expect(created).toBeNull();
  });

  it("aprova uma vez só", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    const approved = await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    expect(approved?.status).toBe("approved");
    expect(approved?.decidedAt).not.toBeNull();
  });

  it("segunda decisão é recusada", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    expect(decideProposal(asClient(db), OWNER, { id: created!.id, decision: "rejected" })).rejects.toThrow(/já decidida/);
  });

  it("rejeitar registra a trilha e não aplica", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "rejected", note: "não faz sentido" });
    expect(db.rows("jarvis_proposals")[0]?.status).toBe("rejected");
    expect(db.rows("audit_logs").map((row) => row.action)).toContain("jarvis.proposal.rejected");
    expect(applyProposal(asClient(db), OWNER, created!.id)).rejects.toThrow(/aprovada/);
  });

  it("não aplica proposta pendente", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    expect(applyProposal(asClient(db), OWNER, created!.id)).rejects.toThrow(/aprovada antes/);
  });

  it("aplica só depois de aprovada, criando o registro real", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    const result = await applyProposal(asClient(db), OWNER, created!.id);
    expect(result.ok).toBe(true);
    expect(db.rows("risks")).toHaveLength(1);
    expect(db.rows("risks")[0]?.title).toBe(riskProposal.title);
    expect(db.rows("jarvis_proposals")[0]?.status).toBe("applied");
  });

  it("aplicar de novo não duplica", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    await applyProposal(asClient(db), OWNER, created!.id);
    const second = await applyProposal(asClient(db), OWNER, created!.id);
    expect(second.message).toContain("já aplicada");
    expect(db.rows("risks")).toHaveLength(1);
  });

  it("guarda o id do registro criado e a trilha da aplicação", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, riskProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    await applyProposal(asClient(db), OWNER, created!.id);
    const applied = db.rows("jarvis_proposals")[0];
    expect(applied?.applied_record_id).toBe(db.rows("risks")[0]?.id);
    expect(db.rows("audit_logs").map((row) => row.action)).toContain("jarvis.proposal.applied");
  });
});

describe("efeitos por tipo", () => {
  const planProposal: JarvisProposal = {
    kind: "criar_plano_acao",
    title: "Negociar acordo",
    rationale: "Reduzir exposição.",
    payload: { title: "Negociar acordo", priority: "alta", status: "pendente", due_date: "2026-11-20" },
    effect: "Cria plano de ação.",
    requiresApproval: true,
  };

  it("plano de ação vai para jarvis_action_plans", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(asClient(db), OWNER, planProposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    const result = await applyProposal(asClient(db), OWNER, created!.id);
    expect(result.ok).toBe(true);
    expect(db.rows("jarvis_action_plans")[0]?.title).toBe("Negociar acordo");
    expect(db.rows("jarvis_action_plans")[0]?.priority).toBe("alta");
  });

  it("provisão sem processo falha declarando o motivo", async () => {
    const db = new FakeDatabase();
    const proposal: JarvisProposal = {
      kind: "lancar_provisao",
      title: "Constituir provisão",
      rationale: "Caso provável.",
      payload: { case_id: null, kind: "constituicao", amount: 140000, occurred_on: "2026-10-30" },
      effect: "Lança provisão.",
      requiresApproval: true,
    };
    const created = await createProposal(asClient(db), OWNER, proposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    const result = await applyProposal(asClient(db), OWNER, created!.id);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("case_id");
    expect(db.rows("jarvis_proposals")[0]?.status).toBe("failed");
    expect(db.rows("legal_provisions")).toHaveLength(0);
  });

  it("provisão com valor zero é recusada", async () => {
    const db = new FakeDatabase();
    const proposal: JarvisProposal = {
      kind: "lancar_provisao",
      title: "Constituir provisão",
      rationale: "x",
      payload: { case_id: "abc", kind: "constituicao", amount: 0, occurred_on: "2026-10-30" },
      effect: "Lança provisão.",
      requiresApproval: true,
    };
    const created = await createProposal(asClient(db), OWNER, proposal, { question: "q", tool: "propor_acao" });
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    const result = await applyProposal(asClient(db), OWNER, created!.id);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("positivo");
  });

  it("tipo desconhecido falha em vez de gravar qualquer coisa", async () => {
    const db = new FakeDatabase();
    const created = await createProposal(
      asClient(db),
      OWNER,
      { ...riskProposal, kind: "apagar_tudo" as never },
      { question: "q", tool: "propor_acao" },
    );
    await decideProposal(asClient(db), OWNER, { id: created!.id, decision: "approved" });
    const result = await applyProposal(asClient(db), OWNER, created!.id);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("desconhecido");
  });
});

describe("listagem e rótulos", () => {
  it("lista propostas mesmo sem tabela migrada", async () => {
    const db = new FakeDatabase();
    expect(await listProposals(asClient(db))).toEqual([]);
  });

  it("rótulos em português", () => {
    expect(proposalStatusLabel("pending")).toBe("Aguardando aprovação");
    expect(proposalStatusLabel("applied")).toBe("Aplicada");
    expect(proposalStatusLabel("outro")).toBe("outro");
  });
});
