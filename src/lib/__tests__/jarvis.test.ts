/**
 * Testes do cérebro do JARVIS e dos validadores.
 * Rodar com: bun test
 */
import { describe, expect, test } from "bun:test";
import { buildDemoDataset } from "@/lib/demo/demoData";
import { analyzeLocally } from "@/lib/jarvis/localAnalyst";
import { briefingToPrompt } from "@/lib/jarvis/briefing.server";
import { EMPTY_BRIEFING, type PortfolioBriefing } from "@/lib/jarvis/types";
import {
  assetInputSchema,
  riskInputSchema,
  transactionInputSchema,
  jarvisAskSchema,
} from "@/lib/validation/schemas";

function demoBriefing(): PortfolioBriefing {
  const demo = buildDemoDataset();
  const aum = demo.assets.reduce((s, a) => s + a.value, 0);
  return {
    ...EMPTY_BRIEFING,
    userEmail: "gestor@teste.com",
    totals: {
      aum,
      assets: demo.assets.length,
      entities: demo.entities.length,
      members: demo.members.length,
      risksOpen: demo.risks.length,
      risksCritical: demo.risks.filter((r) => r.severity === "critical").length,
      documentsExpiring: demo.documents.filter((d) => d.expiresInDays >= 0 && d.expiresInDays <= 60)
        .length,
      documentsOverdue: demo.documents.filter((d) => d.expiresInDays < 0).length,
      insightsOpen: demo.insights.length,
      income6m: demo.transactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
      expense6m: demo.transactions
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    },
    entities: demo.entities.map((e) => ({
      name: e.name,
      type: e.type,
      compliance: e.compliance_score,
      assets: demo.assets.filter((a) => a.entity === e.name).length,
      value: demo.assets.filter((a) => a.entity === e.name).reduce((s, a) => s + a.value, 0),
    })),
    risks: demo.risks.map((r) => ({
      title: r.title,
      severity: r.severity,
      status: "pending",
      dueDate: new Date(Date.now() + r.dueInDays * 86_400_000).toISOString(),
      entity: r.asset ? (demo.assets.find((a) => a.name === r.asset)?.entity ?? null) : null,
      asset: r.asset,
    })),
    documentsExpiring: demo.documents.map((d) => ({
      title: d.title,
      type: d.type,
      expiryDate: new Date(Date.now() + d.expiresInDays * 86_400_000).toISOString().slice(0, 10),
      daysToExpire: d.expiresInDays,
      status: d.status,
      asset: d.asset,
    })),
  };
}

describe("dataset de demonstração", () => {
  const demo = buildDemoDataset();

  test("tem o tamanho combinado do seed", () => {
    expect(demo.entities).toHaveLength(3);
    expect(demo.assets).toHaveLength(12);
    expect(demo.documents).toHaveLength(12);
    expect(demo.risks).toHaveLength(8);
    expect(demo.transactions).toHaveLength(24);
    expect(demo.insights).toHaveLength(6);
    expect(demo.actionPlans).toHaveLength(5);
    expect(demo.healthScores).toHaveLength(6);
  });

  test("todas as referências entre registros existem", () => {
    const assetNames = new Set(demo.assets.map((a) => a.name));
    for (const doc of demo.documents) {
      if (doc.asset) expect(assetNames.has(doc.asset)).toBe(true);
    }
    for (const risk of demo.risks) {
      if (risk.asset) expect(assetNames.has(risk.asset)).toBe(true);
      expect(demo.members.some((m) => m.full_name === risk.responsible)).toBe(true);
    }
    const insightTitles = new Set(demo.insights.map((i) => i.title));
    for (const plan of demo.actionPlans) expect(insightTitles.has(plan.insightTitle)).toBe(true);
  });

  test("percentuais de participação somam 100% por entidade", () => {
    const totals = new Map<string, number>();
    for (const member of demo.members) {
      for (const share of member.shares) {
        totals.set(share.entity, (totals.get(share.entity) ?? 0) + share.percentage);
      }
    }
    for (const [, total] of totals) expect(total).toBe(100);
  });

  test("AUM do dataset é positivo e os health scores evoluem", () => {
    expect(demo.assets.reduce((s, a) => s + a.value, 0)).toBeGreaterThan(0);
    const scores = demo.healthScores.map((h) => h.global_score);
    expect(scores[scores.length - 1]).toBeGreaterThan(scores[0]);
  });
});

describe("analista local do JARVIS", () => {
  const briefing = demoBriefing();

  test("responde riscos com os números do briefing", () => {
    const answer = analyzeLocally("Quais são meus riscos críticos?", briefing).answer;
    expect(answer).toContain(String(briefing.totals.risksOpen));
    expect(answer).toContain(String(briefing.totals.risksCritical));
  });

  test("detecta intenção de documentos, patrimônio, compliance e financeiro", () => {
    expect(analyzeLocally("quais documentos vencem?", briefing).answer.toLowerCase()).toContain(
      "documento",
    );
    expect(analyzeLocally("resumo do patrimônio", briefing).answer).toContain(
      "patrimônio consolidado",
    );
    expect(analyzeLocally("como está meu compliance?", briefing).answer).toContain(
      "Compliance médio",
    );
    expect(analyzeLocally("como está o fluxo de caixa?", briefing).answer).toContain(
      "últimos 6 meses",
    );
  });

  test("normaliza acentos e maiúsculas na detecção de intenção", () => {
    const a = analyzeLocally("QUAIS RISCOS CRÍTICOS?", briefing).answer;
    const b = analyzeLocally("quais riscos criticos?", briefing).answer;
    expect(a).toBe(b);
  });

  test("tenant vazio não inventa números", () => {
    const answer = analyzeLocally("quais são meus riscos?", EMPTY_BRIEFING).answer;
    expect(answer).toContain("não há patrimônio cadastrado");
  });
});

describe("contexto enviado ao LLM", () => {
  test("inclui os dados-chave e não vaza informação de outro tenant", () => {
    const briefing = demoBriefing();
    const prompt = briefingToPrompt(briefing);
    expect(prompt).toContain("Fazenda Santa Fé");
    expect(prompt).toContain("RISCOS ABERTOS");
    expect(prompt).toContain("HOLDINGS");
    expect(prompt).toContain("gestor@teste.com");
    expect(prompt.length).toBeGreaterThan(1000);
  });
});

describe("validadores (fonte única cliente/servidor)", () => {
  const uuid = "3f984f52-9b9b-4b1e-9f2b-2a3c4d5e6f70";

  test("ativo exige nome, entidade válida e valor numérico", () => {
    const ok = assetInputSchema.safeParse({
      name: "Fazenda Teste",
      type: "rural",
      entity_id: uuid,
      value: "1.250.000",
      status: "regular",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.value).toBe(1250000);

    expect(assetInputSchema.safeParse({ name: "X", entity_id: uuid, value: "1" }).success).toBe(
      false,
    );
    expect(
      assetInputSchema.safeParse({ name: "Fazenda", entity_id: "abc", value: "1" }).success,
    ).toBe(false);
    expect(
      assetInputSchema.safeParse({ name: "Fazenda", entity_id: uuid, value: "-5" }).success,
    ).toBe(false);
  });

  test("risco aceita ativo/responsável opcionais vazios", () => {
    const parsed = riskInputSchema.safeParse({
      title: "Risco de teste",
      severity: "high",
      entity_id: uuid,
      asset_id: "",
      responsible_id: "",
      due_date: "2026-12-01",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.asset_id).toBeUndefined();
      expect(parsed.data.responsible_id).toBeUndefined();
    }
  });

  test("transação rejeita valor zero", () => {
    expect(
      transactionInputSchema.safeParse({
        title: "Lançamento",
        entity_id: uuid,
        amount: "0",
        type: "income",
      }).success,
    ).toBe(false);
  });

  test("pergunta do JARVIS respeita limites de tamanho", () => {
    expect(jarvisAskSchema.safeParse({ message: "oi" }).success).toBe(true);
    expect(jarvisAskSchema.safeParse({ message: "a" }).success).toBe(false);
    expect(jarvisAskSchema.safeParse({ message: "a".repeat(1500) }).success).toBe(false);
    expect(
      jarvisAskSchema.safeParse({
        message: "pergunta válida",
        history: Array.from({ length: 20 }, () => ({ role: "user" as const, content: "x" })),
      }).success,
    ).toBe(false);
  });
});
