import { describe, expect, test } from "bun:test";
import {
  callsToScheduled,
  daysUntil,
  effectiveDate,
  estimatedAnnualCall,
  isSettled,
  summarizeCommitment,
  summarizePortfolio,
  type CapitalEvent,
  type Commitment,
} from "@/lib/private-markets";

const TODAY = new Date("2026-10-30T00:00:00Z");

const fund = (over: Partial<Commitment> = {}): Commitment => ({
  id: "c1",
  entity_id: "e1",
  name: "Fundo Alencar PE IV",
  manager: "Alencar Asset",
  strategy: "private_equity",
  committed: 50_000_000,
  vintage: 2024,
  term_years: 10,
  nav: 12_000_000,
  is_active: true,
  ...over,
});

const event = (over: Partial<CapitalEvent>): CapitalEvent => ({
  id: Math.random().toString(36),
  commitment_id: "c1",
  entity_id: "e1",
  kind: "call",
  due_date: "2026-10-01",
  amount: 5_000_000,
  status: "pago",
  paid_at: "2026-10-01",
  ...over,
});

describe("datas e liquidação", () => {
  test("dias até o vencimento, positivo e negativo", () => {
    expect(daysUntil("2026-11-09", TODAY)).toBe(10);
    expect(daysUntil("2026-10-20", TODAY)).toBe(-10);
    expect(daysUntil("data-ruim", TODAY)).toBeNaN();
  });

  test("pago por status ou por data de pagamento", () => {
    expect(isSettled(event({ status: "pago" }))).toBe(true);
    expect(isSettled(event({ status: "previsto", paid_at: "2026-10-05" }))).toBe(true);
    expect(isSettled(event({ status: "previsto", paid_at: null }))).toBe(false);
    expect(isSettled(event({ status: "atrasado", paid_at: null }))).toBe(false);
  });

  test("data efetiva prefere o pagamento", () => {
    expect(effectiveDate(event({ due_date: "2026-10-01", paid_at: "2026-10-03" }))).toBe("2026-10-03");
    expect(effectiveDate(event({ due_date: "2026-10-01", paid_at: null }))).toBe("2026-10-01");
  });
});

describe("resumo por compromisso", () => {
  const events = [
    event({ id: "a", amount: 10_000_000, due_date: "2025-03-10", paid_at: "2025-03-10" }),
    event({ id: "b", amount: 8_000_000, due_date: "2026-02-10", paid_at: "2026-02-10" }),
    event({ id: "c", kind: "distribution", amount: 3_000_000, due_date: "2026-06-15", paid_at: "2026-06-15" }),
  ];

  test("unfunded, DPI, TVPI e percentual chamado", () => {
    const summary = summarizeCommitment(fund(), events, TODAY);
    expect(summary.called).toBe(18_000_000);
    expect(summary.unfunded).toBe(32_000_000);
    expect(summary.distributed).toBe(3_000_000);
    expect(summary.dpi).toBeCloseTo(3 / 18, 6);
    expect(summary.tvpi).toBeCloseTo((3 + 12) / 18, 6);
    expect(summary.calledPct).toBeCloseTo(36, 6);
  });

  test("capital call avisado reduz o unfunded mesmo antes de ser pago", () => {
    const withNotice = [
      ...events,
      event({ id: "d", amount: 4_000_000, due_date: "2026-12-15", status: "previsto", paid_at: null }),
    ];
    const summary = summarizeCommitment(fund(), withNotice, TODAY);
    expect(summary.called).toBe(22_000_000);
    expect(summary.unfunded).toBe(28_000_000);
    expect(summary.upcomingCalls).toBe(4_000_000);
    expect(summary.nextCallDate).toBe("2026-12-15");
  });

  test("chamada vencida é contada como atrasada e não como próxima", () => {
    const overdue = [
      ...events,
      event({ id: "e", amount: 2_000_000, due_date: "2026-10-20", status: "previsto", paid_at: null }),
    ];
    const summary = summarizeCommitment(fund(), overdue, TODAY);
    expect(summary.overdueCalls).toBe(2_000_000);
    expect(summary.upcomingCalls).toBe(0);
    expect(summary.nextCallDate).toBeNull();
  });

  test("evento cancelado não conta em nada", () => {
    const cancelled = [
      ...events,
      event({ id: "f", amount: 9_000_000, status: "cancelado", paid_at: null }),
    ];
    expect(summarizeCommitment(fund(), cancelled, TODAY).called).toBe(18_000_000);
  });

  test("compromisso sem chamada não divide por zero", () => {
    const summary = summarizeCommitment(fund({ nav: 0 }), [], TODAY);
    expect(summary.dpi).toBe(0);
    expect(summary.tvpi).toBe(0);
    expect(summary.unfunded).toBe(50_000_000);
  });

  test("chamado acima do compromisso não gera unfunded negativo", () => {
    const over = [event({ amount: 60_000_000 })];
    expect(summarizeCommitment(fund(), over, TODAY).unfunded).toBe(0);
  });
});

describe("resumo da carteira de privados", () => {
  const commitments = [
    fund({ id: "c1", name: "Fundo Alencar PE IV", committed: 50_000_000 }),
    fund({ id: "c2", name: "Agro Fund II", strategy: "agro", committed: 20_000_000, nav: 4_000_000 }),
    fund({ id: "c3", name: "Fundo encerrado", committed: 10_000_000, is_active: false }),
  ];

  const events = [
    event({ id: "1", commitment_id: "c1", amount: 10_000_000, due_date: "2025-01-10" }),
    event({ id: "2", commitment_id: "c1", kind: "distribution", amount: 2_000_000, due_date: "2026-05-10" }),
    event({ id: "3", commitment_id: "c2", amount: 8_000_000, due_date: "2026-03-10" }),
    event({ id: "4", commitment_id: "c1", amount: 3_000_000, due_date: "2026-11-20", status: "previsto", paid_at: null }),
    event({ id: "5", commitment_id: "c2", amount: 1_500_000, due_date: "2026-10-15", status: "previsto", paid_at: null }),
    event({ id: "6", commitment_id: "c2", kind: "distribution", amount: 500_000, due_date: "2026-12-01", status: "previsto", paid_at: null }),
    event({ id: "7", commitment_id: "c3", amount: 10_000_000, due_date: "2024-01-10" }),
  ];

  test("só compromissos ativos entram nos totais", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    expect(summary.commitments).toHaveLength(2);
    expect(summary.totals.committed).toBe(70_000_000);
    expect(summary.totals.called).toBe(10_000_000 + 8_000_000 + 3_000_000 + 1_500_000);
  });

  test("unfunded total separa o que ainda vai sair do bolso", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    // c1: 50M − 13M = 37M | c2: 20M − 9,5M = 10,5M
    expect(summary.totals.unfunded).toBe(47_500_000);
  });

  test("agenda de chamadas ordenada, com atraso identificado", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    expect(summary.schedule).toHaveLength(2);
    expect(summary.schedule[0].commitmentName).toBe("Agro Fund II");
    expect(summary.schedule[0].overdue).toBe(true);
    expect(summary.schedule[0].daysUntil).toBe(-15);
    expect(summary.schedule[1].daysUntil).toBe(21);
    expect(summary.totals.overdueCalls).toBe(1_500_000);
    expect(summary.totals.upcomingCalls30).toBe(3_000_000);
  });

  test("aviso prioriza o atraso", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    expect(summary.warning).toContain("capital call(s) vencido(s)");
  });

  test("sem atraso, o aviso fala do que vence em 30 dias", () => {
    const clean = events.filter((item) => item.id !== "5");
    const summary = summarizePortfolio(commitments, clean, TODAY);
    expect(summary.warning).toContain("até 30 dias");
  });

  test("distribuições previstas aparecem separadas", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    expect(summary.expectedDistributions).toHaveLength(1);
    expect(summary.expectedDistributions[0].commitmentName).toBe("Agro Fund II");
  });

  test("carteira vazia devolve zeros sem quebrar", () => {
    const summary = summarizePortfolio([], [], TODAY);
    expect(summary.totals.committed).toBe(0);
    expect(summary.totals.dpi).toBe(0);
    expect(summary.warning).toBeNull();
  });

  test("estimativa de chamada anual usa prazo do fundo", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    const c1 = summary.commitments.find((item) => item.commitment.id === "c1")!;
    // unfunded 37M / 10 anos
    expect(estimatedAnnualCall(c1.commitment, c1)).toBeCloseTo(3_700_000, 2);
    expect(estimatedAnnualCall(fund({ term_years: null }), c1)).toBe(0);
  });

  test("chamadas previstas viram saídas agendadas para a projeção", () => {
    const summary = summarizePortfolio(commitments, events, TODAY);
    const scheduled = callsToScheduled(summary);
    expect(scheduled).toHaveLength(2);
    expect(scheduled.every((item) => item.direction === "out")).toBe(true);
    // atrasada entra no mês corrente
    expect(scheduled[0].date).toBe(new Date().toISOString().slice(0, 10));
    expect(scheduled[1].date).toBe("2026-11-20");
    expect(scheduled[1].label).toContain("Fundo Alencar");
  });
});
