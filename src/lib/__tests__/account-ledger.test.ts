/**
 * Testes da conciliação de saldo por conta (wave 28).
 *
 * O cenário base é o de uma conta corrente real de family office: entradas de
 * aluguel, saídas de folha, tarifas. Cada caso muda **uma** coisa para que a
 * falha aponte para a causa, não para o cenário.
 */
import { describe, expect, test } from "bun:test";
import {
  buildAccountLedger,
  signedAmount,
  suggestAccountAssignments,
  summarizeLedgers,
  type AccountLedgerInput,
  type BalanceSnapshot,
  type LedgerTransaction,
} from "@/lib/wealth/account-ledger";
import { parseOfx } from "@/lib/import/ofx";

const tx = (
  id: string,
  date: string,
  amount: number,
  type: "income" | "expense" | null,
  description = "lançamento",
): LedgerTransaction => ({ id, date, amount, type, description });

const snapshot = (asOf: string, balance: number, source = "manual"): BalanceSnapshot => ({
  id: `b-${asOf}`,
  asOf,
  balance,
  source,
});

/** Abertura 100.000 em 30/09. Outubro: +30.000 aluguel, −18.000 folha, −250 tarifa. */
const OCTOBER: LedgerTransaction[] = [
  tx("t1", "2026-10-05", 30_000, "income", "ALUGUEL RECEBIDO"),
  tx("t2", "2026-10-15", 18_000, "expense", "FOLHA"),
  tx("t3", "2026-10-20", 250, "expense", "TARIFA"),
];
const OCTOBER_NET = 30_000 - 18_000 - 250; // 11.750
const BALANCE_OK = 100_000 + OCTOBER_NET; // 111.750

function ledger(over: Partial<AccountLedgerInput> = {}) {
  return buildAccountLedger({
    accountId: "acc-1",
    accountName: "Itaú Private — Holding",
    openingBalance: 100_000,
    openingDate: "2026-09-30",
    transactions: OCTOBER,
    snapshots: [snapshot("2026-10-31", BALANCE_OK)],
    ...over,
  });
}

describe("sinal dos lançamentos", () => {
  test("income soma, expense subtrai, tipo nulo não soma", () => {
    expect(signedAmount(tx("a", "2026-10-01", 100, "income"))).toBe(100);
    expect(signedAmount(tx("a", "2026-10-01", 100, "expense"))).toBe(-100);
    expect(signedAmount(tx("a", "2026-10-01", 100, null))).toBeNull();
  });

  test("valor negativo no campo amount recebe o tratamento do tipo (convenção da tabela)", () => {
    // `transactions.amount` é positivo por contrato; se vier negativa, o tipo manda.
    expect(signedAmount(tx("a", "2026-10-01", -100, "income"))).toBe(100);
  });
});

describe("conta que fecha", () => {
  test("saldo do banco igual ao calculado", () => {
    const result = ledger();
    expect(result.checks.length).toBe(1);
    expect(result.checks[0]).toMatchObject({
      informed: BALANCE_OK,
      expected: BALANCE_OK,
      divergence: 0,
      status: "ok",
      transactions: 3,
      inflow: 30_000,
      outflow: 18_250,
    });
    expect(result.status).toBe("ok");
    expect(result.needsBalance).toBe(false);
    expect(result.needsOpening).toBe(false);
  });

  test("centavo de arredondamento não vira divergência", () => {
    const result = ledger({ snapshots: [snapshot("2026-10-31", BALANCE_OK + 0.004)] });
    expect(result.checks[0]?.status).toBe("ok");
  });

  test("tolerância maior aceita diferença declarada", () => {
    const result = ledger({ snapshots: [snapshot("2026-10-31", BALANCE_OK + 5)], tolerance: 10 });
    expect(result.checks[0]?.status).toBe("ok");
  });
});

describe("direção da divergência (o que procurar)", () => {
  test("banco com mais dinheiro: falta lançamento de entrada", () => {
    const result = ledger({ snapshots: [snapshot("2026-10-31", BALANCE_OK + 2_000)] });
    const check = result.checks[0]!;
    expect(check.status).toBe("faltam_entradas");
    expect(check.divergence).toBe(2_000);
    expect(check.message).toContain("entrada");
    expect(check.message).toContain("2.000,00");
  });

  test("banco com menos dinheiro: falta saída ou sobrou duplicado", () => {
    const result = ledger({ snapshots: [snapshot("2026-10-31", BALANCE_OK - 1_500)] });
    const check = result.checks[0]!;
    expect(check.status).toBe("faltam_saidas");
    expect(check.divergence).toBe(-1_500);
    expect(check.message).toContain("saída");
    expect(check.message).toContain("1.500,00");
  });

  test("divergência percentual é sobre o movimento do período", () => {
    const result = ledger({ snapshots: [snapshot("2026-10-31", BALANCE_OK + 4_825)] });
    const check = result.checks[0]!;
    // movimento = 30.000 + 18.250 = 48.250 → 10%
    expect(check.divergencePct).toBeCloseTo(10, 5);
  });

  test("saldo mudou sem nenhum lançamento na janela", () => {
    const result = ledger({
      transactions: [],
      snapshots: [snapshot("2026-10-31", 100_500)],
    });
    expect(result.checks[0]?.status).toBe("saldo_sem_movimento");
    expect(result.checks[0]?.message).toContain("rendimento");
  });
});

describe("janelas e herança do saldo informado", () => {
  const twoMonths = [
    ...OCTOBER,
    tx("t4", "2026-11-10", 5_000, "income", "ALUGUEL NOVEMBRO"),
    tx("t5", "2026-11-12", 1_000, "expense", "FORNECEDOR"),
  ];
  const NOVEMBER_BALANCE = BALANCE_OK + 4_000;

  test("o segundo fechamento parte do saldo informado do primeiro", () => {
    const result = buildAccountLedger({
      accountId: "acc-1",
      accountName: "Conta",
      openingBalance: 100_000,
      openingDate: "2026-09-30",
      transactions: twoMonths,
      snapshots: [snapshot("2026-10-31", BALANCE_OK), snapshot("2026-11-30", NOVEMBER_BALANCE)],
    });

    expect(result.checks.length).toBe(2);
    const november = result.checks[1]!;
    expect(november.expected).toBe(NOVEMBER_BALANCE);
    expect(november.transactions).toBe(2);
    expect(november.status).toBe("ok");
    expect(result.totals.inflow).toBe(35_000);
    expect(result.totals.transactions).toBe(5);
  });

  test("divergência de outubro não contamina novembro", () => {
    // Outubro informado 1.000 acima do calculado; novembro fecha certo contra ele.
    const octoberInformed = BALANCE_OK + 1_000;
    const result = buildAccountLedger({
      accountId: "acc-1",
      accountName: "Conta",
      openingBalance: 100_000,
      openingDate: "2026-09-30",
      transactions: twoMonths,
      snapshots: [snapshot("2026-10-31", octoberInformed), snapshot("2026-11-30", octoberInformed + 4_000)],
    });
    expect(result.checks[0]?.status).toBe("faltam_entradas");
    expect(result.checks[1]?.status).toBe("ok");
  });

  test("lançamento no dia do fechamento entra naquela janela", () => {
    const result = ledger({
      transactions: [...OCTOBER, tx("t9", "2026-10-31", 700, "income", "JUROS")],
      snapshots: [snapshot("2026-10-31", BALANCE_OK + 700)],
    });
    expect(result.checks[0]?.transactions).toBe(4);
    expect(result.checks[0]?.status).toBe("ok");
  });

  test("lançamento no dia da abertura fica fora (o saldo já o inclui)", () => {
    const result = ledger({
      transactions: [tx("t0", "2026-09-30", 9_999, "income", "ANTES DA ABERTURA"), ...OCTOBER],
      snapshots: [snapshot("2026-10-31", BALANCE_OK)],
    });
    expect(result.checks[0]?.transactions).toBe(3);
    expect(result.totals.outOfRange).toBe(1);
  });

  test("lançamento depois do último fechamento não entra em nenhuma janela", () => {
    const result = ledger({
      transactions: [...OCTOBER, tx("t-late", "2026-12-01", 4_000, "income", "DEPOIS")],
    });
    expect(result.totals.outOfRange).toBe(1);
    expect(result.totals.inflow).toBe(30_000);
  });

  test("data inválida é descartada em vez de virar NaN", () => {
    const result = ledger({
      transactions: [...OCTOBER, tx("bad", "31/10/2026", 100, "income")],
    });
    expect(result.checks[0]?.status).toBe("ok");
    expect(result.totals.transactions).toBe(3);
  });
});

describe("casos incompletos são declarados, não escondidos", () => {
  test("conta sem nenhum saldo informado pede saldo", () => {
    const result = ledger({ openingBalance: null, openingDate: null, snapshots: [] });
    expect(result.needsBalance).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.checks).toEqual([]);
  });

  test("abertura sem nenhum fechamento: nada para conferir, e a tela sabe disso", () => {
    // Situação real de quem informou o saldo inicial e ainda não importou extrato.
    const result = ledger({ snapshots: [] });
    expect(result.needsBalance).toBe(false);
    expect(result.needsOpening).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.totals.transactions).toBe(0);
  });

  test("um único saldo não é conciliação: falta ponto de partida", () => {
    const result = ledger({ openingBalance: null, openingDate: null, snapshots: [snapshot("2026-10-31", 111_750)] });
    expect(result.needsBalance).toBe(false);
    expect(result.needsOpening).toBe(true);
    expect(result.checks[0]?.status).toBe("sem_abertura");
    expect(result.status).toBe("sem_abertura");
    expect(result.checks[0]?.message).toContain("abertura");
  });

  test("lançamento sem tipo é contado e não soma", () => {
    const result = ledger({
      transactions: [...OCTOBER, tx("tx-sem-tipo", "2026-10-22", 800, null, "TRANSFERÊNCIA")],
    });
    expect(result.checks[0]?.unknownType).toBe(1);
    expect(result.checks[0]?.status).toBe("ok");
  });

  test("pior status entre os fechamentos é o da conta", () => {
    const result = buildAccountLedger({
      accountId: "acc-1",
      accountName: "Conta",
      openingBalance: 100_000,
      openingDate: "2026-09-30",
      transactions: OCTOBER,
      snapshots: [snapshot("2026-10-31", BALANCE_OK), snapshot("2026-11-30", BALANCE_OK)],
    });
    // Novembro sem lançamento e saldo igual: fecha; outubro ok → conta ok.
    expect(result.status).toBe("ok");
  });
});

describe("resumo da carteira de contas", () => {
  test("conta conciliada, conta divergente e conta sem saldo", () => {
    const ok = ledger({ accountId: "a", accountName: "A" });
    const bad = ledger({
      accountId: "b",
      accountName: "B",
      snapshots: [snapshot("2026-10-31", BALANCE_OK + 3_000, "ofx")],
    });
    const pending = ledger({ accountId: "c", accountName: "C", openingBalance: null, openingDate: null, snapshots: [] });

    const summary = summarizeLedgers([ok, bad, pending]);
    expect(summary.accounts).toBe(3);
    expect(summary.ok).toBe(1);
    expect(summary.divergent).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.totalDivergence).toBe(3_000);
    expect(summary.worst[0]?.accountId).toBe("b");
    expect(summary.headline).toContain("1 conta(s) com divergência");
  });

  test("tudo conciliado tem frase explícita", () => {
    const summary = summarizeLedgers([ledger()]);
    expect(summary.divergent).toBe(0);
    expect(summary.headline).toContain("conciliada");
  });

  test("sem contas a tela diz o que fazer", () => {
    const summary = summarizeLedgers([]);
    expect(summary.headline).toContain("Nenhuma conta");
  });
});

describe("atribuição de conta a lançamentos órfãos", () => {
  test("só sugere quando o lote inteiro já aponta para uma conta", () => {
    const orphan = [
      { id: "1", batchId: "batch-a", date: "2026-10-01" },
      { id: "2", batchId: "batch-a", date: "2026-10-02" },
      { id: "3", batchId: "batch-b", date: "2026-10-03" },
    ];
    const assigned = new Map<string, Set<string>>([
      ["batch-a", new Set(["acc-1"])],
      ["batch-b", new Set(["acc-1", "acc-2"])],
    ]);
    const suggestions = suggestAccountAssignments(orphan, assigned);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0]?.transactionIds).toEqual(["1", "2"]);
    expect(suggestions[0]?.confident).toBe(true);
  });

  test("lançamento sem lote nunca é sugerido", () => {
    const suggestions = suggestAccountAssignments(
      [{ id: "1", batchId: null, date: "2026-10-01" }],
      new Map([["batch-a", new Set(["acc-1"])]]),
    );
    expect(suggestions).toEqual([]);
  });
});

describe("saldo de fechamento no OFX", () => {
  const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>0341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001
<DTEND>20261031
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>30000.00
<FITID>F001
<MEMO>PIX RECEBIDO ALUGUEL
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>111750.00
<DTASOF>20261031
</LEDGERBAL>
</STMTTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  test("extrai o saldo de fechamento e a data", () => {
    const statement = parseOfx(OFX);
    expect(statement.ledgerBalance).toEqual({ amount: 111_750, asOf: "2026-10-31" });
    expect(statement.periodStart).toBe("2026-10-01");
    expect(statement.periodEnd).toBe("2026-10-31");
    expect(statement.accountId).toBe("12345-6");
  });

  test("OFX sem LEDGERBAL avisa em vez de inventar saldo", () => {
    const statement = parseOfx(OFX.replace(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/, ""));
    expect(statement.ledgerBalance).toBeNull();
    expect(statement.warnings.join(" ")).toContain("não traz saldo de fechamento");
  });

  test("saldo negativo (cheque especial) é preservado", () => {
    const statement = parseOfx(OFX.replace("111750.00", "-1250.75"));
    expect(statement.ledgerBalance?.amount).toBe(-1250.75);
  });

  test("o saldo do arquivo fecha a conta quando os lançamentos batem", () => {
    const statement = parseOfx(OFX);
    const result = buildAccountLedger({
      accountId: "acc-1",
      accountName: "Itaú",
      openingBalance: 81_750,
      openingDate: "2026-09-30",
      transactions: statement.transactions.map((row, index) => ({
        id: `t${index}`,
        date: row.date,
        amount: Math.abs(row.amount),
        type: row.amount >= 0 ? ("income" as const) : ("expense" as const),
      })),
      snapshots: [
        { id: "b1", asOf: statement.ledgerBalance!.asOf!, balance: statement.ledgerBalance!.amount, source: "ofx" },
      ],
    });
    expect(result.checks[0]?.status).toBe("ok");
    expect(result.checks[0]?.source).toBe("ofx");
  });
});
