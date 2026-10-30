import { describe, expect, test } from "bun:test";
import {
  reconcile,
  suggestFlowKind,
  type ReconciliationFlow,
  type ReconciliationTransaction,
} from "@/lib/reconciliation";

const tx = (
  id: string,
  date: string,
  amount: number,
  type: "income" | "expense" = "expense",
  description = "Lançamento",
): ReconciliationTransaction => ({ id, date, amount, type, description });

const flow = (id: string, date: string, amount: number, kind = "resgate"): ReconciliationFlow => ({
  id,
  date,
  amount,
  kind,
});

describe("conciliação extrato × custódia", () => {
  test("casa mesmo valor na mesma data", () => {
    const result = reconcile([tx("t1", "2026-10-09", 42_100)], [flow("f1", "2026-10-09", 42_100)]);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].confidence).toBe("exata");
    expect(result.unmatchedTransactions).toHaveLength(0);
    expect(result.unmatchedFlows).toHaveLength(0);
    expect(result.stats.matchRate).toBe(100);
  });

  test("aceita diferença de até 2 dias (liquidação)", () => {
    const result = reconcile([tx("t1", "2026-10-09", 1_000)], [flow("f1", "2026-10-11", 1_000)]);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].dayDistance).toBe(2);
    expect(result.pairs[0].confidence).toBe("proxima");
  });

  test("fora da janela não casa", () => {
    const result = reconcile([tx("t1", "2026-10-09", 1_000)], [flow("f1", "2026-10-15", 1_000)]);
    expect(result.pairs).toHaveLength(0);
    expect(result.unmatchedTransactions).toHaveLength(1);
    expect(result.unmatchedFlows).toHaveLength(1);
    expect(result.stats.matchRate).toBe(0);
  });

  test("janela configurável amplia o alcance", () => {
    const result = reconcile([tx("t1", "2026-10-01", 1_000)], [flow("f1", "2026-10-08", 1_000)], {
      dayWindow: 7,
    });
    expect(result.pairs).toHaveLength(1);
  });

  test("valores diferentes, mesmo na mesma data, não casam", () => {
    const result = reconcile([tx("t1", "2026-10-09", 1_000)], [flow("f1", "2026-10-09", 999.99)]);
    expect(result.pairs).toHaveLength(0);
  });

  test("tolerância de centavos aceita arredondamento de tarifa", () => {
    const result = reconcile([tx("t1", "2026-10-09", 79.9)], [flow("f1", "2026-10-09", 79.89)], {
      centsTolerance: 2,
    });
    expect(result.pairs).toHaveLength(1);
  });

  test("valores repetidos casam 1:1 e o excedente fica sem lastro", () => {
    const result = reconcile(
      [
        tx("t1", "2026-10-01", 5_000),
        tx("t2", "2026-10-01", 5_000),
        tx("t3", "2026-10-01", 5_000),
      ],
      [flow("f1", "2026-10-01", 5_000), flow("f2", "2026-10-01", 5_000)],
    );
    expect(result.pairs).toHaveLength(2);
    expect(result.unmatchedTransactions.map((item) => item.id)).toEqual(["t3"]);
    expect(result.stats.unmatchedTransactionAmount).toBe(5_000);
  });

  test("prioriza data idêntica quando há concorrentes", () => {
    const result = reconcile(
      [tx("t1", "2026-10-10", 2_000)],
      [flow("f1", "2026-10-12", 2_000), flow("f2", "2026-10-10", 2_000)],
    );
    expect(result.pairs[0].flow.id).toBe("f2");
    expect(result.pairs[0].confidence).toBe("exata");
  });

  test("direção é ignorada por padrão e respeitada quando pedida", () => {
    const transactions = [tx("t1", "2026-10-09", 1_000, "income")];
    const flows = [flow("f1", "2026-10-09", 1_000, "taxa")];

    expect(reconcile(transactions, flows).pairs).toHaveLength(1);
    expect(reconcile(transactions, flows, { requireSameDirection: true }).pairs).toHaveLength(0);
  });

  test("listas vazias não quebram nem dividem por zero", () => {
    const empty = reconcile([], []);
    expect(empty.stats.matchRate).toBe(0);
    expect(empty.pairs).toHaveLength(0);

    const onlyExtract = reconcile([tx("t1", "2026-10-09", 100)], []);
    expect(onlyExtract.unmatchedTransactions).toHaveLength(1);
    expect(onlyExtract.stats.transactionCount).toBe(1);
    expect(onlyExtract.stats.flowCount).toBe(0);
  });

  test("datas inválidas são ignoradas, não derrubam o cálculo", () => {
    const result = reconcile([tx("t1", "data-ruim", 100)], [flow("f1", "2026-10-09", 100)]);
    expect(result.pairs).toHaveLength(0);
    expect(result.unmatchedTransactions).toHaveLength(1);
  });

  test("soma conciliada e não conciliada aparecem nas estatísticas", () => {
    const result = reconcile(
      [tx("t1", "2026-10-01", 1_000), tx("t2", "2026-10-02", 500)],
      [flow("f1", "2026-10-01", 1_000), flow("f2", "2026-10-20", 300)],
    );
    expect(result.stats.matchedAmount).toBe(1_000);
    expect(result.stats.unmatchedTransactionAmount).toBe(500);
    expect(result.stats.unmatchedFlowAmount).toBe(300);
    expect(result.stats.matchRate).toBe(50);
  });
});

describe("sugestão de tipo de fluxo", () => {
  test("categoria manda mais que o sinal", () => {
    expect(suggestFlowKind({ type: "expense", category: "Tributos" })).toBe("imposto");
    expect(suggestFlowKind({ type: "expense", category: "Encargos financeiros" })).toBe("taxa");
    expect(suggestFlowKind({ type: "income", category: "Proventos e rendimentos" })).toBe("provento");
  });

  test("sem categoria, decide pelo sinal", () => {
    expect(suggestFlowKind({ type: "income", category: null })).toBe("aporte");
    expect(suggestFlowKind({ type: "expense", category: null })).toBe("resgate");
  });

  test("descrição cobre quando a categoria não veio", () => {
    expect(suggestFlowKind({ type: "expense", description: "DARF IRPF QUOTA" })).toBe("imposto");
    expect(suggestFlowKind({ type: "income", description: "DIVIDENDO FII" })).toBe("provento");
  });
});
