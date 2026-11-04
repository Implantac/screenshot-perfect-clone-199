/**
 * Conciliação de saldo por conta (wave 28) — motor puro.
 *
 * A PERGUNTA
 * A wave 8 casa extrato × custódia (o mesmo fato visto dos dois lados). Esta
 * camada responde a pergunta do fechamento:
 *
 *     saldo informado pelo banco  ?=  saldo de abertura  +  entradas − saídas
 *
 * Se os dois lados batem, o extrato está completo e a carteira está fiel. Se não
 * batem, alguém está errado — e a diferença tem sinal, o que já diz **o que**
 * procurar: informado maior que o calculado = falta lançamento de **entrada**;
 * menor = falta lançamento de **saída**. É essa leitura que o operador precisa,
 * não um "divergência de R$ 4.812,33" sem direção.
 *
 * POR QUE O CÁLCULO NÃO ESTÁ EM SQL
 * O mesmo motivo da wave 27: motor puro é testável sem banco, roda antes de
 * gravar (a tela mostra o impacto antes) e não precisa ser reescrito quando a
 * policy muda. O banco guarda fatos (`transactions`, `account_balances`), o app
 * calcula.
 *
 * O QUE ESTE MOTOR **NÃO** FAZ
 * Não decide sozinho o que fazer com a divergência. Um saldo que não bate pode
 * ser lançamento faltando, lançamento duplicado, saldo digitado errado, ou
 * período em que a conta rendeu juros sem lançamento. O motor dá o número, a
 * direção e a janela; a decisão é de quem assina o balanço.
 */

export type LedgerTransactionType = "income" | "expense" | null;

export type LedgerTransaction = {
  id: string;
  /** ISO (yyyy-mm-dd). */
  date: string;
  /** Valor absoluto — o sinal vem de `type` (convenção de `transactions`). */
  amount: number;
  type: LedgerTransactionType;
  description?: string | null;
  externalId?: string | null;
};

export type BalanceSnapshot = {
  id: string;
  /** Data do saldo informado pelo banco. */
  asOf: string;
  balance: number;
  /** `ofx` | `manual` | `api` | `extrato`. */
  source: string;
};

export type AccountLedgerInput = {
  accountId: string;
  accountName: string;
  currency?: string;
  /** Saldo anterior à primeira janela. `null` = não informado (a conta não fecha). */
  openingBalance: number | null;
  /** Data do saldo de abertura (o saldo vale para o **início** deste dia). */
  openingDate: string | null;
  transactions: LedgerTransaction[];
  snapshots: BalanceSnapshot[];
  /** Tolerância em reais (padrão R$ 0,01 — centavo de arredondamento não é erro). */
  tolerance?: number;
};

export type CheckStatus =
  | "ok"
  | "faltam_entradas"
  | "faltam_saidas"
  | "sem_abertura"
  | "saldo_sem_movimento";

export type PeriodCheck = {
  asOf: string;
  source: string;
  /** Saldo que o banco informou. */
  informed: number;
  /** Abertura + fluxos do intervalo. */
  expected: number;
  /** `informed − expected`. Positivo = banco tem mais. */
  divergence: number;
  /** Divergência em % do movimento do período (0 quando não houve movimento). */
  divergencePct: number;
  inflow: number;
  outflow: number;
  transactions: number;
  /** Lançamentos do intervalo sem `type` — não entram na soma e são reportados. */
  unknownType: number;
  status: CheckStatus;
  /** Frase pronta para a tela, com direção e valor. */
  message: string;
  windowStart: string | null;
  windowEnd: string;
};

export type AccountLedger = {
  accountId: string;
  accountName: string;
  currency: string;
  checks: PeriodCheck[];
  /** Último fechamento conferido (o mais recente). */
  latest: PeriodCheck | null;
  /** Pior status entre os fechamentos — é o que a lista de contas mostra. */
  status: CheckStatus;
  /** Movimento total do período coberto (todas as janelas). */
  totals: {
    inflow: number;
    outflow: number;
    net: number;
    transactions: number;
    /** Lançamentos ignorados por estarem fora das janelas de saldo. */
    outOfRange: number;
    unknownType: number;
  };
  /** Conta sem nenhum saldo informado: nada a conciliar ainda. */
  needsBalance: boolean;
  /** Conta com saldo mas sem abertura: a conta não fecha por falta de ponto de partida. */
  needsOpening: boolean;
};

const STATUS_ORDER: Record<CheckStatus, number> = {
  faltam_entradas: 3,
  faltam_saidas: 3,
  saldo_sem_movimento: 2,
  sem_abertura: 2,
  ok: 0,
};

function toDays(date: string | null | undefined): number | null {
  if (!date) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : Math.round(parsed / 86_400_000);
}

/** Valor com sinal, na convenção da tabela (`amount` positivo + `type`). */
export function signedAmount(transaction: LedgerTransaction): number | null {
  if (transaction.type === "income") return Math.abs(transaction.amount);
  if (transaction.type === "expense") return -Math.abs(transaction.amount);
  return null;
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function isoToBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

/**
 * Monta o extrato da conta e confere cada saldo informado.
 *
 * Regra de janela (explícita, porque é a fonte de quase todo erro de conciliação):
 *  - o saldo de abertura vale para o **início** do dia `openingDate`;
 *  - cada janela vai de `anterior + 1 dia` até `asOf`, inclusive;
 *  - o saldo informado representa o **fim** do dia `asOf`.
 * Assim, um lançamento no mesmo dia do fechamento entra naquela janela — que é
 * como o extrato bancário funciona.
 */
export function buildAccountLedger(input: AccountLedgerInput): AccountLedger {
  const tolerance = input.tolerance ?? 0.01;
  const currency = input.currency ?? "BRL";

  const valid = input.transactions
    .filter((transaction) => toDays(transaction.date) !== null)
    .map((transaction) => ({ transaction, day: toDays(transaction.date) as number }))
    .sort((a, b) => a.day - b.day);

  const snapshots = [...input.snapshots]
    .filter((snapshot) => toDays(snapshot.asOf) !== null)
    .sort((a, b) => a.asOf.localeCompare(b.asOf));

  // Sem nenhuma referência: nada a conciliar ainda. Com referência, mas sem
  // abertura, a conta existe e não fecha — são situações diferentes e a tela
  // precisa distinguir "não comecei" de "comecei e não tenho ponto de partida".
  const missingOpening = input.openingBalance === null || toDays(input.openingDate) === null;
  const needsBalance = snapshots.length === 0 && missingOpening;
  const needsOpening = !needsBalance && missingOpening;

  const inAnyWindow = new Set<string>();
  const checks: PeriodCheck[] = [];

  let cursorDay = toDays(input.openingDate);
  let cursorBalance = input.openingBalance ?? 0;

  for (const snapshot of snapshots) {
    const endDay = toDays(snapshot.asOf) as number;

    // Janela sem abertura definida não soma: somaria o mundo inteiro.
    const windowTransactions = missingOpening
      ? []
      : valid.filter(({ day }) => day > (cursorDay as number) && day <= endDay);

    for (const entry of windowTransactions) inAnyWindow.add(entry.transaction.id);

    let inflow = 0;
    let outflow = 0;
    let unknownType = 0;
    for (const { transaction } of windowTransactions) {
      const signed = signedAmount(transaction);
      if (signed === null) {
        unknownType += 1;
        continue;
      }
      if (signed >= 0) inflow += signed;
      else outflow += Math.abs(signed);
    }

    const net = inflow - outflow;
    const expected = missingOpening ? snapshot.balance : cursorBalance + net;
    const informed = snapshot.balance;
    const divergence = informed - expected;

    let status: CheckStatus;
    if (missingOpening) {
      status = "sem_abertura";
    } else if (Math.abs(divergence) <= tolerance) {
      status = "ok";
    } else if (windowTransactions.length === 0) {
      // Saldo mudou sem nenhum lançamento na janela: rendimento, tarifa ou extrato ausente.
      status = "saldo_sem_movimento";
    } else if (divergence > 0) {
      status = "faltam_entradas";
    } else {
      status = "faltam_saidas";
    }

    const movement = inflow + outflow;
    const divergencePct = movement > 0 ? (divergence / movement) * 100 : 0;

    checks.push({
      asOf: snapshot.asOf,
      source: snapshot.source,
      informed,
      expected,
      divergence,
      divergencePct,
      inflow,
      outflow,
      transactions: windowTransactions.length,
      unknownType,
      status,
      message: describe(status, divergence, snapshot.asOf, windowTransactions.length),
      windowStart: cursorDay === null ? null : new Date((cursorDay + 1) * 86_400_000).toISOString().slice(0, 10),
      windowEnd: snapshot.asOf,
    });

    // O banco é a verdade: o próximo período parte do saldo informado, não do
    // calculado. Assim a divergência de um mês não contamina os seguintes —
    // cada fechamento é conferido contra o anterior informado.
    cursorDay = endDay;
    cursorBalance = informed;
  }

  let inflow = 0;
  let outflow = 0;
  let unknownType = 0;
  let outOfRange = 0;
  for (const { transaction } of valid) {
    if (!inAnyWindow.has(transaction.id)) {
      outOfRange += 1;
      continue;
    }
    const signed = signedAmount(transaction);
    if (signed === null) {
      unknownType += 1;
      continue;
    }
    if (signed >= 0) inflow += signed;
    else outflow += Math.abs(signed);
  }

  const latest = checks.length > 0 ? (checks[checks.length - 1] as PeriodCheck) : null;
  const status = needsBalance
    ? "ok"
    : checks.reduce<CheckStatus>(
        (worst, check) => (STATUS_ORDER[check.status] > STATUS_ORDER[worst] ? check.status : worst),
        "ok",
      );

  return {
    accountId: input.accountId,
    accountName: input.accountName,
    currency,
    checks,
    latest,
    status,
    totals: {
      inflow,
      outflow,
      net: inflow - outflow,
      transactions: inAnyWindow.size,
      outOfRange,
      unknownType,
    },
    needsBalance,
    needsOpening,
  };
}

function describe(status: CheckStatus, divergence: number, asOf: string, count: number): string {
  const when = isoToBr(asOf);
  switch (status) {
    case "ok":
      return `Fecha em ${when}: saldo do banco confere com os lançamentos.`;
    case "sem_abertura":
      return `Informe o saldo de abertura da conta: sem ele não há como conferir ${when}.`;
    case "faltam_entradas":
      return `Em ${when} o banco tem ${brl(divergence)} a mais que os lançamentos — procure lançamento de entrada faltando.`;
    case "faltam_saidas":
      return `Em ${when} o banco tem ${brl(Math.abs(divergence))} a menos que os lançamentos — procure lançamento de saída faltando ou duplicado.`;
    case "saldo_sem_movimento":
      return `${count === 0 ? "Nenhum lançamento" : "Lançamentos insuficientes"} na janela até ${when}, mas o saldo mudou ${brl(
        divergence,
      )} — rendimento, tarifa ou extrato não importado.`;
  }
}

export type LedgerSummary = {
  accounts: number;
  ok: number;
  divergent: number;
  /** Contas que nem começaram a conciliar (sem saldo informado). */
  pending: number;
  /** Soma das divergências absolutas do último fechamento de cada conta. */
  totalDivergence: number;
  worst: AccountLedger[];
  headline: string;
};

/**
 * Resumo para o cabeçalho da tela.
 *
 * Ordem de gravidade: divergência > sem abertura > sem saldo > ok. Conta sem
 * saldo informado não é erro — é conta que ainda não foi conciliada, e dizer
 * "ok" para ela seria mentira confortável.
 */
export function summarizeLedgers(ledgers: AccountLedger[]): LedgerSummary {
  const withBalance = ledgers.filter((ledger) => !ledger.needsBalance);
  const ok = withBalance.filter((ledger) => ledger.status === "ok").length;
  const divergent = withBalance.filter(
    (ledger) => ledger.status === "faltam_entradas" || ledger.status === "faltam_saidas",
  ).length;
  const pending = ledgers.filter((ledger) => ledger.needsBalance).length;

  const totalDivergence = withBalance.reduce(
    (total, ledger) => total + Math.abs(ledger.latest?.divergence ?? 0),
    0,
  );

  const worst = [...withBalance]
    .sort((a, b) => Math.abs(b.latest?.divergence ?? 0) - Math.abs(a.latest?.divergence ?? 0))
    .filter((ledger) => (ledger.latest?.divergence ?? 0) !== 0)
    .slice(0, 5);

  const headline =
    ledgers.length === 0
      ? "Nenhuma conta cadastrada: crie uma em Custódia para conciliar saldo."
      : divergent > 0
        ? `${divergent} conta(s) com divergência de ${brl(totalDivergence)} no último fechamento.`
        : ok > 0
          ? `${ok} conta(s) conciliada(s)${pending > 0 ? ` · ${pending} sem saldo informado` : ""}.`
          : "Nenhuma conta com saldo informado ainda.";

  return { accounts: ledgers.length, ok, divergent, pending, totalDivergence, worst, headline };
}

// ---------------------------------------------------------------------------
// Atribuição de conta a lançamentos já importados
// ---------------------------------------------------------------------------

export type AssignmentSuggestion = {
  transactionIds: string[];
  /** `true` quando todos os lançamentos do intervalo apontam para a mesma conta. */
  confident: boolean;
  reason: string;
};

/**
 * Sugere a conta de lançamentos órfãos (importados antes da wave 28).
 *
 * Premissa declarada: **não adivinha pelo texto**. "PIX RECEBIDO" não diz qual
 * conta. O que dá para afirmar com segurança é o que já veio no próprio arquivo
 * (`import_batch_id`) ou o que o operador atribuiu manualmente. Então a sugestão
 * só existe quando há um lote de importação com todos os lançamentos do mesmo
 * arquivo já atribuídos a uma conta — aí o resto do lote herda.
 */
export function suggestAccountAssignments(
  orphan: { id: string; batchId: string | null; date: string | null }[],
  assignedByBatch: Map<string, Set<string>>,
): AssignmentSuggestion[] {
  const byBatch = new Map<string, string[]>();
  for (const row of orphan) {
    if (!row.batchId) continue;
    byBatch.set(row.batchId, [...(byBatch.get(row.batchId) ?? []), row.id]);
  }

  const suggestions: AssignmentSuggestion[] = [];
  for (const [batchId, ids] of byBatch) {
    const accounts = assignedByBatch.get(batchId);
    if (!accounts || accounts.size !== 1) continue;
    const [accountId] = [...accounts];
    suggestions.push({
      transactionIds: ids,
      confident: true,
      reason: `O restante do lote ${batchId.slice(0, 8)} está todo na conta ${accountId?.slice(0, 8)}.`,
    });
  }
  return suggestions;
}
