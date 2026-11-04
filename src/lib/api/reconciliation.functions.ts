/**
 * Conciliação de saldo por conta — Server Functions (wave 28).
 *
 * Três operações, todas mediadas pelo JWT do usuário (RLS decide o que ele vê):
 *   - `getAccountReconciliation`: lê contas, lançamentos e saldos e devolve o
 *     extrato conciliado por conta (motor puro em `account-ledger.ts`);
 *   - `recordAccountBalance`: grava/atualiza o saldo informado de um dia;
 *   - `assignTransactionsToAccount`: atribui conta a lançamentos órfãos.
 *
 * DECISÕES
 *  - **Nada de cálculo em SQL.** O motor é puro e testável; a função só busca e
 *    devolve. Também significa que a tela consegue mostrar o resultado antes de
 *    qualquer escrita.
 *  - **Saldo informado é sobrescrito por dia, não duplicado** (`onConflict`
 *    account_id+as_of): reimportar o extrato do mesmo mês corrige o saldo em vez
 *    de criar uma segunda contraprova contraditória.
 *  - **Atribuição em massa é explícita**: o operador escolhe os lançamentos e a
 *    conta; o servidor nunca "deduz" por texto.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAccountLedger,
  summarizeLedgers,
  type AccountLedger,
  type BalanceSnapshot,
  type LedgerSummary,
  type LedgerTransaction,
} from "@/lib/wealth/account-ledger";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

export type AccountReconciliationPayload = {
  accounts: (AccountLedger & {
    accountId: string;
    accountKind: string;
    custodian: string | null;
    isActive: boolean;
    /** Conta sem abertura informada: a tela pede o ponto de partida. */
    suggestedOpening: { asOf: string; balance: number } | null;
  })[];
  summary: LedgerSummary;
  /** `true` quando a migration 320000 ainda não foi aplicada. */
  migrationPending: string | null;
  /** Contas sem nenhum lançamento: conciliar saldo não faz sentido ainda. */
  emptyAccounts: number;
  generatedAt: string;
};

const queryInput = z
  .object({
    entity_id: z.string().uuid().optional(),
    /** Janela em dias para carregar lançamentos (padrão 400 — cobre mais de um ano). */
    days: z.coerce.number().int().min(30).max(3650).default(400),
    tolerance: z.coerce.number().min(0).max(100).default(0.01),
  })
  .default({});

export const getAccountReconciliation = authed
  .inputValidator(queryInput)
  .handler(async ({ data, context }): Promise<AccountReconciliationPayload> => {
    const empty: AccountReconciliationPayload = {
      accounts: [],
      summary: summarizeLedgers([]),
      migrationPending: null,
      emptyAccounts: 0,
      generatedAt: new Date().toISOString(),
    };

    let accountQuery = context.supabase
      .from("accounts")
      .select("id, entity_id, name, kind, currency, is_active, custodians(name)")
      .order("name");
    if (data.entity_id) accountQuery = accountQuery.eq("entity_id", data.entity_id);

    const { data: accountRows, error: accountError } = await accountQuery;
    if (accountError) {
      if (/does not exist|schema cache|relation/i.test(accountError.message)) {
        return { ...empty, migrationPending: "20261030150000_wealth_core.sql" };
      }
      throw new Error(accountError.message);
    }
    if (!accountRows || accountRows.length === 0) return empty;

    const accountIds = accountRows.map((row) => row.id);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString().slice(0, 10);

    // `account_id` só existe a partir desta wave: a consulta precisa avisar em
    // vez de estourar quando a migration não foi aplicada.
    const { data: transactionRows, error: transactionError } = await context.supabase
      .from("transactions")
      .select("id, account_id, amount, type, transaction_date, title, external_id")
      .in("account_id", accountIds)
      .gte("transaction_date", since)
      .order("transaction_date", { ascending: true });

    if (transactionError) {
      if (/account_id|does not exist|schema cache|column/i.test(transactionError.message)) {
        return { ...empty, migrationPending: "20261030320000_account_balances.sql" };
      }
      throw new Error(transactionError.message);
    }

    const { data: balanceRows, error: balanceError } = await context.supabase
      .from("account_balances")
      .select("id, account_id, as_of, balance, source")
      .in("account_id", accountIds)
      .order("as_of", { ascending: true });

    if (balanceError) {
      if (/does not exist|schema cache|relation/i.test(balanceError.message)) {
        return { ...empty, migrationPending: "20261030320000_account_balances.sql" };
      }
      throw new Error(balanceError.message);
    }

    const byAccount = new Map<string, LedgerTransaction[]>();
    for (const row of transactionRows ?? []) {
      const key = row.account_id as string;
      byAccount.set(key, [
        ...(byAccount.get(key) ?? []),
        {
          id: row.id,
          date: row.transaction_date ?? "",
          amount: Number(row.amount ?? 0),
          type: (row.type === "income" || row.type === "expense" ? row.type : null) as LedgerTransaction["type"],
          description: row.title,
          externalId: row.external_id,
        },
      ]);
    }

    const byAccountBalances = new Map<string, BalanceSnapshot[]>();
    for (const row of balanceRows ?? []) {
      const key = row.account_id as string;
      byAccountBalances.set(key, [
        ...(byAccountBalances.get(key) ?? []),
        { id: row.id, asOf: row.as_of, balance: Number(row.balance ?? 0), source: row.source },
      ]);
    }

    const ledgers = accountRows.map((row) => {
      const snapshots = byAccountBalances.get(row.id) ?? [];
      // A abertura é o primeiro saldo informado ANTES do período; se não houver,
      // o motor declara "sem abertura" em vez de somar tudo desde o início dos tempos.
      const [firstSnapshot] = snapshots;
      // Convenção declarada: o **saldo mais antigo é a abertura** e cada saldo
      // seguinte é um ponto a conferir. Com um único saldo não existe contraprova
      // — o motor marca "sem abertura" em vez de dizer que conciliou.
      const hasOpening = snapshots.length >= 2;
      const ledger = buildAccountLedger({
        accountId: row.id,
        accountName: row.name,
        currency: row.currency ?? "BRL",
        openingBalance: hasOpening ? (snapshots[0]?.balance ?? null) : null,
        openingDate: hasOpening ? (snapshots[0]?.asOf ?? null) : null,
        transactions: byAccount.get(row.id) ?? [],
        snapshots: hasOpening ? snapshots.slice(1) : snapshots,
        tolerance: data.tolerance,
      });

      const custodian = (row as { custodians?: { name?: string } | null }).custodians;
      return {
        ...ledger,
        accountKind: row.kind,
        custodian: custodian?.name ?? null,
        isActive: Boolean(row.is_active),
        suggestedOpening: firstSnapshot
          ? { asOf: firstSnapshot.asOf, balance: firstSnapshot.balance }
          : null,
      };
    });

    return {
      accounts: ledgers,
      summary: summarizeLedgers(ledgers),
      migrationPending: null,
      emptyAccounts: ledgers.filter((ledger) => ledger.totals.transactions === 0).length,
      generatedAt: new Date().toISOString(),
    };
  });

const balanceInput = z.object({
  account_id: z.string().uuid(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato aaaa-mm-dd."),
  balance: z.coerce.number().finite(),
  source: z.enum(["ofx", "manual", "api", "extrato"]).default("manual"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export type RecordBalanceResult = {
  ok: boolean;
  /** `true` quando já existia saldo para aquele dia e foi atualizado. */
  replaced: boolean;
  note?: string;
};

export const recordAccountBalance = authed
  .inputValidator(balanceInput)
  .handler(async ({ data, context }): Promise<RecordBalanceResult> => {
    const { data: account, error: accountError } = await context.supabase
      .from("accounts")
      .select("id, entity_id, currency")
      .eq("id", data.account_id)
      .maybeSingle();

    if (accountError || !account) {
      return { ok: false, replaced: false, note: "Conta não encontrada ou sem permissão." };
    }

    const { data: existing } = await context.supabase
      .from("account_balances")
      .select("id, balance")
      .eq("account_id", data.account_id)
      .eq("as_of", data.as_of)
      .maybeSingle();

    const { error } = await context.supabase.from("account_balances").upsert(
      {
        entity_id: account.entity_id,
        account_id: data.account_id,
        as_of: data.as_of,
        balance: data.balance,
        currency: account.currency ?? "BRL",
        source: data.source,
        note: data.note || null,
        created_by: context.userId,
      },
      { onConflict: "account_id,as_of" },
    );

    if (error) {
      if (/does not exist|schema cache|relation/i.test(error.message)) {
        return {
          ok: false,
          replaced: false,
          note: "Falta a migration 20261030320000_account_balances.sql.",
        };
      }
      return { ok: false, replaced: false, note: error.message };
    }

    return {
      ok: true,
      replaced: Boolean(existing),
      note: existing ? `Saldo de ${data.as_of} atualizado.` : undefined,
    };
  });

const assignInput = z.object({
  account_id: z.string().uuid(),
  transaction_ids: z.array(z.string().uuid()).min(1).max(500),
});

export type AssignResult = { updated: number; note?: string };

export const assignTransactionsToAccount = authed
  .inputValidator(assignInput)
  .handler(async ({ data, context }): Promise<AssignResult> => {
    const { error, count } = await context.supabase
      .from("transactions")
      .update({ account_id: data.account_id }, { count: "exact" })
      .in("id", data.transaction_ids);

    if (error) {
      if (/account_id|does not exist|schema cache|column/i.test(error.message)) {
        return { updated: 0, note: "Falta a migration 20261030320000_account_balances.sql." };
      }
      return { updated: 0, note: error.message };
    }
    return { updated: count ?? data.transaction_ids.length };
  });

/**
 * Lançamentos que ainda não pertencem a conta nenhuma.
 *
 * A tela precisa disso para oferecer a atribuição em massa — sem isso, o
 * histórico importado antes da wave 28 fica invisível para a conciliação.
 */
export const getUnassignedTransactions = authed
  .inputValidator(
    z.object({ entity_id: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(500).default(200) }).default({}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("transactions")
      .select("id, title, amount, type, transaction_date, import_batch_id, entity_id, account_id")
      .is("account_id", null)
      .order("transaction_date", { ascending: false })
      .limit(data.limit);

    if (data.entity_id) query = query.eq("entity_id", data.entity_id);

    const { data: rows, error } = await query;
    if (error) {
      if (/account_id|does not exist|schema cache|column/i.test(error.message)) {
        return { rows: [], total: 0, migrationPending: "20261030320000_account_balances.sql" as string | null };
      }
      throw new Error(error.message);
    }

    const mapped = (rows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      amount: Number(row.amount ?? 0),
      type: row.type,
      date: row.transaction_date,
      batchId: row.import_batch_id,
    }));

    return { rows: mapped, total: mapped.length, migrationPending: null as string | null };
  });
