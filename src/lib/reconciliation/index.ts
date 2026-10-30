/**
 * Conciliação extrato × custódia.
 *
 * O problema real: o extrato diz que saíram R$ 42.100 em 09/10; a custódia diz
 * que houve um resgate de R$ 42.100 em 10/10. São o mesmo fato, olhado de dois
 * lados diferentes — e é isso que a conciliação prova.
 *
 * Regra de casamento (deliberadamente simples): **valor absoluto igual** e
 * **data dentro de uma janela** (D+0 a D+3, padrão 2). Um casamento 1:1 guloso,
 * ordenado por distância de data, resolve os casos de valores repetidos.
 *
 * Por que a direção (crédito/débito) *não* é usada como filtro rígido:
 * `cash_flows.kind` é escrito sob a óptica da custódia (aporte, resgate,
 * provento) e o extrato sob a óptica do banco. "Resgate de fundo" é saída para
 * quem olha o fundo e entrada para quem olha a conta. Usar o sinal como
 * restrição dura produziria falsos negativos em massa; o sinal fica visível na
 * tela para o operador decidir. A opção `requireSameDirection` existe para quem
 * quiser o comportamento estrito.
 */

export type ReconciliationTransaction = {
  id: string;
  date: string;
  /** Valor absoluto (o sinal vem de `type`). */
  amount: number;
  description: string;
  type?: "income" | "expense" | null;
  imported?: boolean;
};

export type ReconciliationFlow = {
  id: string;
  date: string;
  amount: number;
  description?: string | null;
  kind: string;
};

export type ReconciliationOptions = {
  /** Tolerância em dias entre a data do extrato e a do fluxo. */
  dayWindow?: number;
  /** Tolerância em centavos (0 = exato ao centavo). */
  centsTolerance?: number;
  /** Restringe o casamento a direções compatíveis (ver comentário do topo). */
  requireSameDirection?: boolean;
};

export type MatchConfidence = "exata" | "proxima";

export type MatchedPair = {
  transaction: ReconciliationTransaction;
  flow: ReconciliationFlow;
  /** Dias de diferença entre as datas (módulo). */
  dayDistance: number;
  confidence: MatchConfidence;
  amount: number;
};

export type ReconciliationResult = {
  pairs: MatchedPair[];
  unmatchedTransactions: ReconciliationTransaction[];
  unmatchedFlows: ReconciliationFlow[];
  stats: {
    /** Transações consideradas (do extrato). */
    transactionCount: number;
    flowCount: number;
    matched: number;
    /** % de transações do extrato que encontraram lastro na custódia. */
    matchRate: number;
    matchedAmount: number;
    unmatchedTransactionAmount: number;
    unmatchedFlowAmount: number;
  };
};

/** Direções consideradas compatíveis quando `requireSameDirection` está ligado. */
const KIND_DIRECTION: Record<string, "in" | "out"> = {
  aporte: "in",
  provento: "in",
  resgate: "out",
  taxa: "out",
  imposto: "out",
};

function toDays(date: string): number | null {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : Math.round(parsed / 86_400_000);
}

function directionOfTransaction(type?: "income" | "expense" | null): "in" | "out" | null {
  if (type === "income") return "in";
  if (type === "expense") return "out";
  return null;
}

/**
 * Casa extrato e custódia 1:1.
 *
 * Complexidade: O(n·m) nos pares candidatos, mas com as listas ordenadas por
 * valor o caso real (dezenas de lançamentos por mês) é instantâneo. Não vale
 * trocar legibilidade por índice para carteiras desse tamanho.
 */
export function reconcile(
  transactions: ReconciliationTransaction[],
  flows: ReconciliationFlow[],
  options: ReconciliationOptions = {},
): ReconciliationResult {
  const dayWindow = options.dayWindow ?? 2;
  const centsTolerance = options.centsTolerance ?? 0;
  const requireSameDirection = options.requireSameDirection ?? false;

  type Candidate = { transactionIndex: number; flowIndex: number; dayDistance: number };
  const candidates: Candidate[] = [];

  transactions.forEach((transaction, transactionIndex) => {
    const transactionDay = toDays(transaction.date);
    const transactionDirection = directionOfTransaction(transaction.type);
    flows.forEach((flow, flowIndex) => {
      if (transactionDay === null) return;
      const flowDay = toDays(flow.date);
      if (flowDay === null) return;
      const distance = Math.abs(transactionDay - flowDay);
      if (distance > dayWindow) return;
      const differenceInCents =
        Math.abs(Math.abs(transaction.amount) - Math.abs(flow.amount)) * 100;
      if (differenceInCents > centsTolerance + 1e-6) return;
      if (requireSameDirection) {
        const flowDirection = KIND_DIRECTION[flow.kind] ?? null;
        if (transactionDirection && flowDirection && transactionDirection !== flowDirection) return;
      }
      candidates.push({ transactionIndex, flowIndex, dayDistance: distance });
    });
  });

  // Casamento guloso: primeiro os pares com data idêntica, depois os mais próximos.
  candidates.sort((a, b) => a.dayDistance - b.dayDistance);

  const usedTransaction = new Set<number>();
  const usedFlow = new Set<number>();
  const pairs: MatchedPair[] = [];

  for (const candidate of candidates) {
    if (usedTransaction.has(candidate.transactionIndex) || usedFlow.has(candidate.flowIndex)) continue;
    usedTransaction.add(candidate.transactionIndex);
    usedFlow.add(candidate.flowIndex);
    const transaction = transactions[candidate.transactionIndex];
    const flow = flows[candidate.flowIndex];
    pairs.push({
      transaction,
      flow,
      dayDistance: candidate.dayDistance,
      confidence: candidate.dayDistance === 0 ? "exata" : "proxima",
      amount: Math.abs(transaction.amount),
    });
  }

  const unmatchedTransactions = transactions.filter((_, index) => !usedTransaction.has(index));
  const unmatchedFlows = flows.filter((_, index) => !usedFlow.has(index));

  const sum = (values: { amount: number }[]) =>
    values.reduce((total, item) => total + Math.abs(item.amount), 0);

  return {
    pairs: pairs.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date)),
    unmatchedTransactions,
    unmatchedFlows,
    stats: {
      transactionCount: transactions.length,
      flowCount: flows.length,
      matched: pairs.length,
      matchRate: transactions.length === 0 ? 0 : (pairs.length / transactions.length) * 100,
      matchedAmount: pairs.reduce((total, pair) => total + pair.amount, 0),
      unmatchedTransactionAmount: sum(unmatchedTransactions),
      unmatchedFlowAmount: sum(unmatchedFlows),
    },
  };
}

/**
 * Sugere o `kind` do fluxo de custódia ao criar um a partir de um lançamento do
 * extrato — a categoria inferida na importação já diz quase tudo.
 */
export function suggestFlowKind(transaction: {
  type?: "income" | "expense" | null;
  category?: string | null;
  description?: string | null;
}): "aporte" | "resgate" | "provento" | "taxa" | "imposto" {
  const category = (transaction.category ?? "").toLowerCase();
  const description = (transaction.description ?? "").toLowerCase();

  if (/tribut|imposto|darf|itcmd/.test(category) || /darf|itcmd|imposto/.test(description)) {
    return "imposto";
  }
  if (/encargo|tarifa/.test(category) || /tarifa|taxa banc/.test(description)) return "taxa";
  if (/provento|rendimento|dividendo/.test(category) || /dividendo|rendimento|jcp/.test(description)) {
    return "provento";
  }
  return transaction.type === "income" ? "aporte" : "resgate";
}
