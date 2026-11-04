/**
 * Conciliação de saldo por conta (wave 28).
 *
 * O QUE ESTA TELA FECHA
 * A conciliação extrato × custódia (wave 8, logo acima) prova que o mesmo fato
 * foi visto dos dois lados. Esta prova que a **soma dos lançamentos** da conta
 * chega no saldo que o banco informa. Sem ela, um extrato incompleto passa
 * despercebido: cada lançamento concilia com a custódia, e o total continua
 * errado porque falta um lançamento que ninguém importou.
 *
 * O QUE ELA NÃO FAZ
 * Não decide o que fazer com a divergência. Dá o número, a direção e a janela;
 * quem assina o balanço decide. E não "deduz" conta pelo texto do lançamento —
 * atribuição em massa é decisão explícita do operador.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Landmark,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAccountReconciliation,
  getUnassignedTransactions,
  type AccountReconciliationPayload,
} from "@/lib/api/reconciliation.functions";
import { useAssignTransactionsToAccount, useRecordAccountBalance } from "@/hooks/useCrud";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const STATUS_STYLE = {
  ok: {
    label: "conciliada",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  faltam_entradas: {
    label: "faltam entradas",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: AlertTriangle,
  },
  faltam_saidas: {
    label: "faltam saídas",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: AlertTriangle,
  },
  saldo_sem_movimento: {
    label: "saldo sem lastro",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    icon: HelpCircle,
  },
  sem_abertura: {
    label: "sem abertura",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    icon: HelpCircle,
  },
} as const;

function StatusChip({ status }: { status: keyof typeof STATUS_STYLE }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.ok;
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
        style.className,
      )}
    >
      <Icon className="h-2.5 w-2.5" /> {style.label}
    </span>
  );
}

/** Formulário de saldo, aberto dentro da linha da conta. */
function BalanceForm({
  suggestedDate,
  suggestedBalance,
  busy,
  onSubmit,
  onCancel,
}: {
  suggestedDate: string;
  suggestedBalance: number | null;
  busy: boolean;
  onSubmit: (asOf: string, balance: number) => void;
  onCancel: () => void;
}) {
  const [asOf, setAsOf] = useState(suggestedDate);
  const [value, setValue] = useState(suggestedBalance === null ? "" : String(suggestedBalance));

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Data do saldo
        <input
          type="date"
          value={asOf}
          onChange={(event) => setAsOf(event.target.value)}
          className="mt-1 block h-8 rounded-md border border-white/10 bg-background px-2 text-[11px] text-foreground"
        />
      </label>
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        Saldo informado (R$)
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="12500,00"
          className="mt-1 block h-8 w-40 rounded-md border border-white/10 bg-background px-2 text-[11px] text-foreground"
        />
      </label>
      <button
        onClick={() => {
          const parsed = Number(value.replace(/\./g, "").replace(",", "."));
          if (!asOf || !Number.isFinite(parsed)) return;
          onSubmit(asOf, parsed);
        }}
        disabled={busy || !asOf || value.trim() === ""}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Gravar
      </button>
      <button
        onClick={onCancel}
        className="h-8 rounded-lg border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      <span className="text-[10px] text-muted-foreground">o saldo vale para o fim do dia informado</span>
    </div>
  );
}

export function AccountReconciliationPanel({ entityFilter }: { entityFilter?: string }) {
  const query = useQuery({
    queryKey: ["account-reconciliation", entityFilter ?? "all"],
    queryFn: () => getAccountReconciliation({ data: entityFilter ? { entity_id: entityFilter } : {} }),
    retry: false,
    staleTime: 30_000,
  });

  const unassigned = useQuery({
    queryKey: ["unassigned-transactions", entityFilter ?? "all"],
    queryFn: () => getUnassignedTransactions({ data: entityFilter ? { entity_id: entityFilter } : {} }),
    retry: false,
    staleTime: 30_000,
  });

  const recordBalance = useRecordAccountBalance();
  const assign = useAssignTransactionsToAccount();

  const [openForm, setOpenForm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState("");

  const data: AccountReconciliationPayload | undefined = query.data;

  const today = new Date().toISOString().slice(0, 10);
  const totals = useMemo(() => {
    if (!data) return { cash: 0 };
    // Soma dos últimos saldos informados = caixa conciliado nas contas.
    return {
      cash: data.accounts.reduce((total, account) => total + (account.latest?.informed ?? 0), 0),
    };
  }, [data]);

  const orphanRows = unassigned.data?.rows ?? [];

  return (
    <section className="glass-card rounded-2xl border border-white/5 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <Wallet className="h-3.5 w-3.5 text-primary" /> Saldo por conta
        </h2>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {data.summary.accounts} conta(s) · {data.summary.ok} conciliada(s) ·{" "}
              {data.summary.divergent} com divergência · {data.summary.pending} sem saldo
            </span>
          )}
          <button
            onClick={() => {
              query.refetch();
              unassigned.refetch();
            }}
            className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("h-3 w-3", query.isFetching && "animate-spin")} /> Atualizar
          </button>
        </div>
      </div>

      <p className="mb-3 max-w-3xl text-[11px] text-muted-foreground">
        Confere <span className="text-foreground">saldo de abertura + entradas − saídas</span> contra o
        saldo que o banco informa em cada fechamento. Se o saldo do banco é maior, falta lançamento de
        entrada; se é menor, falta de saída ou sobrou duplicado — a diferença sempre tem direção.
      </p>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo contas e saldos…
        </div>
      ) : query.isError ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          {query.error instanceof Error ? query.error.message : "Falha ao ler a conciliação."}
        </p>
      ) : data?.migrationPending ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-[11px] text-amber-200">
          <p className="font-bold">Migration pendente: {data.migrationPending}</p>
          <p className="mt-1 text-muted-foreground">
            Sem ela, lançamento não tem conta e não existe saldo informado. Aplique o{" "}
            <code className="text-foreground">APLICAR-TUDO.sql</code> (21ª migration) e volte aqui.
          </p>
        </div>
      ) : data && data.accounts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma conta cadastrada. Crie a conta em <span className="text-foreground">Custódia → Posições</span>{" "}
          e importe o extrato vinculado a ela.
        </p>
      ) : data ? (
        <>
          <ul className="space-y-2">
            {data.accounts.map((account) => {
              const latest = account.latest;
              const isOpen = expanded === account.accountId;
              return (
                <li key={account.accountId} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold">
                      <Landmark className="h-3 w-3 text-muted-foreground" />
                      {account.accountName}
                    </span>
                    {account.custodian && (
                      <span className="text-[10px] text-muted-foreground">{account.custodian}</span>
                    )}
                    {account.needsBalance ? (
                      <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        sem saldo informado
                      </span>
                    ) : (
                      <StatusChip status={account.status} />
                    )}
                    <span className="ml-auto flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                      <span>{account.totals.transactions} lançamento(s)</span>
                      <span>·</span>
                      <span>
                        entradas {brl(account.totals.inflow)} · saídas {brl(account.totals.outflow)}
                      </span>
                    </span>
                  </div>

                  {latest && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Banco ({latest.asOf.split("-").reverse().join("/")})
                        </span>
                        <p className="text-[12px] font-black tabular-nums">{brl(latest.informed)}</p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Calculado
                        </span>
                        <p className="text-[12px] font-black tabular-nums">{brl(latest.expected)}</p>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg border px-2 py-1.5",
                          Math.abs(latest.divergence) <= 0.01
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-amber-500/20 bg-amber-500/5",
                        )}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Divergência
                        </span>
                        <p
                          className={cn(
                            "text-[12px] font-black tabular-nums",
                            Math.abs(latest.divergence) <= 0.01 ? "text-emerald-400" : "text-amber-300",
                          )}
                        >
                          {brl(latest.divergence)}
                          {Math.abs(latest.divergence) > 0.01 && latest.divergencePct !== 0 && (
                            <span className="ml-1 text-[9px] font-bold text-muted-foreground">
                              ({latest.divergencePct.toFixed(1).replace(".", ",")}% do movimento)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          Fechamentos
                        </span>
                        <p className="text-[12px] font-black tabular-nums">{account.checks.length}</p>
                      </div>
                    </div>
                  )}

                  {latest && (
                    <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{latest.message}</p>
                  )}
                  {account.needsOpening && !account.needsBalance && (
                    <p className="mt-1 text-[10px] text-sky-300">
                      Há só um saldo informado: sem um ponto de partida anterior não há como conferir.
                      Informe o saldo do fechamento **anterior** ou o de abertura.
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setOpenForm(openForm === account.accountId ? null : account.accountId)}
                      className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Informar saldo
                    </button>
                    {account.checks.length > 0 && (
                      <button
                        onClick={() => setExpanded(isOpen ? null : account.accountId)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
                      >
                        {isOpen ? "Ocultar" : "Ver"} fechamentos ({account.checks.length})
                      </button>
                    )}
                    {account.totals.outOfRange > 0 && (
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {account.totals.outOfRange} lançamento(s) fora das janelas
                      </span>
                    )}
                  </div>

                  {openForm === account.accountId && (
                    <BalanceForm
                      suggestedDate={today}
                      suggestedBalance={account.suggestedOpening?.balance ?? null}
                      busy={recordBalance.isPending}
                      onCancel={() => setOpenForm(null)}
                      onSubmit={(asOf, balance) => {
                        recordBalance.mutate(
                          { account_id: account.accountId, as_of: asOf, balance, source: "manual" },
                          { onSuccess: () => setOpenForm(null) },
                        );
                      }}
                    />
                  )}

                  {isOpen && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                            <th className="px-2 py-1">Fechamento</th>
                            <th className="px-2 py-1 text-right">Banco</th>
                            <th className="px-2 py-1 text-right">Calculado</th>
                            <th className="px-2 py-1 text-right">Divergência</th>
                            <th className="px-2 py-1 text-right">Lançamentos</th>
                            <th className="px-2 py-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {account.checks.map((check) => (
                            <tr key={`${account.accountId}-${check.asOf}`} className="border-b border-white/5 text-[10px]">
                              <td className="px-2 py-1 tabular-nums">
                                {check.asOf.split("-").reverse().join("/")}
                                <span className="ml-1 text-[8px] uppercase tracking-widest text-muted-foreground/60">
                                  {check.source}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">{brl(check.informed)}</td>
                              <td className="px-2 py-1 text-right tabular-nums">{brl(check.expected)}</td>
                              <td
                                className={cn(
                                  "px-2 py-1 text-right tabular-nums font-bold",
                                  Math.abs(check.divergence) <= 0.01 ? "text-emerald-400" : "text-amber-300",
                                )}
                              >
                                {brl(check.divergence)}
                              </td>
                              <td className="px-2 py-1 text-right tabular-nums">{check.transactions}</td>
                              <td className="px-2 py-1">
                                <StatusChip status={check.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[10px] text-muted-foreground">
            Caixa conciliado (soma dos últimos saldos informados):{" "}
            <span className="font-bold text-foreground tabular-nums">{brl(totals.cash)}</span> · gerado em{" "}
            {new Date(data.generatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </p>
        </>
      ) : null}

      {/* Lançamentos órfãos: sem conta não entram em nenhuma conciliação. */}
      {orphanRows.length > 0 && (
        <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-sky-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-sky-200">
              {orphanRows.length} lançamento(s) sem conta
            </span>
            <span className="text-[10px] text-muted-foreground">
              importados antes de existir vínculo com conta — não entram em nenhuma conciliação
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={assignTarget}
              onChange={(event) => setAssignTarget(event.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-background px-2 text-[10px]"
            >
              <option value="">— escolha a conta —</option>
              {(data?.accounts ?? []).map((account) => (
                <option key={account.accountId} value={account.accountId}>
                  {account.accountName}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!assignTarget) return;
                assign.mutate({
                  account_id: assignTarget,
                  transaction_ids: orphanRows.map((row) => row.id),
                });
              }}
              disabled={!assignTarget || assign.isPending}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 text-[10px] font-black uppercase tracking-widest text-sky-200 disabled:opacity-40"
            >
              {assign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Atribuir todos a esta conta
            </button>
          </div>
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-[10px] text-muted-foreground">
            {orphanRows.slice(0, 20).map((row) => (
              <li key={row.id} className="flex gap-2">
                <span className="tabular-nums">{row.date?.split("-").reverse().join("/") ?? "—"}</span>
                <span className="truncate">{row.title}</span>
                <span className="ml-auto tabular-nums">{brl(Number(row.amount ?? 0))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[9px] text-muted-foreground">
            Atribuição é decisão sua: o sistema não deduz conta pelo texto do lançamento.
          </p>
        </div>
      )}
    </section>
  );
}
