import { useMemo, useState } from "react";
import { ArrowLeftRight, CheckCircle2, Loader2, PlusCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  reconcile,
  suggestFlowKind,
  type ReconciliationFlow,
  type ReconciliationResult,
  type ReconciliationTransaction,
} from "@/lib/reconciliation";
import { useCreateCashFlow } from "@/hooks/useCrud";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const dateBr = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

const KIND_LABELS: Record<string, string> = {
  aporte: "Aporte",
  resgate: "Resgate",
  provento: "Provento",
  taxa: "Taxa",
  imposto: "Imposto",
};

type TransactionRow = {
  id: string;
  entity_id: string | null;
  title: string;
  amount: number | string;
  type: string | null;
  category: string | null;
  transaction_date: string | null;
  import_batch_id?: string | null;
};

type FlowRow = {
  id: string;
  entity_id: string;
  kind: string;
  amount: number | string;
  flow_date: string;
  description: string | null;
};

type EntityRow = { id: string; name: string };

type Props = {
  transactions: TransactionRow[];
  flows: FlowRow[];
  entities: EntityRow[];
  entityFilter: string;
};

/**
 * Conciliação extrato × custódia (aba de `/custodia`).
 *
 * Roda o casamento **por entidade**: comparar a carteira inteira misturaria
 * extratos de holdings diferentes e produziria pares falsos.
 */
export function ReconciliationPanel({ transactions, flows, entities, entityFilter }: Props) {
  const createFlow = useCreateCashFlow();
  const [creating, setCreating] = useState<string | null>(null);

  const results = useMemo(() => {
    const targetEntities =
      entityFilter === "todas" ? entities.map((entity) => entity.id) : [entityFilter];

    return targetEntities.map((entityId) => {
      const entityTransactions: ReconciliationTransaction[] = transactions
        .filter((transaction) => transaction.entity_id === entityId && transaction.transaction_date)
        .map((transaction) => ({
          id: transaction.id,
          date: transaction.transaction_date as string,
          amount: Math.abs(Number(transaction.amount ?? 0)),
          description: transaction.title,
          type: transaction.type === "income" ? "income" : "expense",
          imported: Boolean(transaction.import_batch_id),
        }));

      const entityFlows: ReconciliationFlow[] = flows
        .filter((flow) => flow.entity_id === entityId)
        .map((flow) => ({
          id: flow.id,
          date: flow.flow_date,
          amount: Math.abs(Number(flow.amount ?? 0)),
          description: flow.description,
          kind: flow.kind,
        }));

      return {
        entityId,
        entityName: entities.find((entity) => entity.id === entityId)?.name ?? "—",
        result: reconcile(entityTransactions, entityFlows),
        rawTransactions: transactions.filter(
          (transaction) => transaction.entity_id === entityId && transaction.transaction_date,
        ),
      };
    });
  }, [transactions, flows, entities, entityFilter]);

  const totals = results.reduce(
    (acc, item) => ({
      matched: acc.matched + item.result.stats.matched,
      transactions: acc.transactions + item.result.stats.transactionCount,
      unmatchedTransactions:
        acc.unmatchedTransactions + item.result.unmatchedTransactions.length,
      unmatchedFlows: acc.unmatchedFlows + item.result.unmatchedFlows.length,
      matchedAmount: acc.matchedAmount + item.result.stats.matchedAmount,
      unmatchedTransactionAmount:
        acc.unmatchedTransactionAmount + item.result.stats.unmatchedTransactionAmount,
      unmatchedFlowAmount: acc.unmatchedFlowAmount + item.result.stats.unmatchedFlowAmount,
    }),
    {
      matched: 0,
      transactions: 0,
      unmatchedTransactions: 0,
      unmatchedFlows: 0,
      matchedAmount: 0,
      unmatchedTransactionAmount: 0,
      unmatchedFlowAmount: 0,
    },
  );

  const matchRate = totals.transactions > 0 ? (totals.matched / totals.transactions) * 100 : 0;

  function createFlowFromTransaction(entityId: string, transactionId: string, result: ReconciliationResult) {
    const transaction = result.unmatchedTransactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    setCreating(transactionId);
    createFlow.mutate(
      {
        entity_id: entityId,
        kind: suggestFlowKind(transaction),
        amount: Math.abs(transaction.amount),
        currency: "BRL",
        flow_date: transaction.date,
        description: transaction.description.slice(0, 180),
      },
      { onSettled: () => setCreating(null) },
    );
  }

  if (transactions.length === 0 && flows.length === 0) {
    return (
      <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
        <ArrowLeftRight className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
        <p className="text-sm font-bold">Nada para conciliar ainda</p>
        <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
          Importe um extrato em <span className="font-mono">Investimentos → Importar extrato</span> e
          lance os aportes/resgates em custódia. A conciliação mostra o que casou e o que ficou sem
          lastro dos dois lados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {[
          {
            label: "Conciliados",
            value: `${totals.matched}`,
            hint: brl(totals.matchedAmount),
            tone: "text-emerald-500",
            icon: CheckCircle2,
          },
          {
            label: "Taxa de conciliação",
            value: `${matchRate.toFixed(1).replace(".", ",")}%`,
            hint: `${totals.transactions} lançamento(s) no extrato`,
            tone: matchRate >= 80 ? "text-emerald-500" : "text-amber-500",
            icon: ArrowLeftRight,
          },
          {
            label: "Extrato sem lastro",
            value: `${totals.unmatchedTransactions}`,
            hint: brl(totals.unmatchedTransactionAmount),
            tone: totals.unmatchedTransactions > 0 ? "text-amber-500" : "text-muted-foreground",
            icon: TriangleAlert,
          },
          {
            label: "Custódia sem extrato",
            value: `${totals.unmatchedFlows}`,
            hint: brl(totals.unmatchedFlowAmount),
            tone: totals.unmatchedFlows > 0 ? "text-amber-500" : "text-muted-foreground",
            icon: TriangleAlert,
          },
        ].map((card) => (
          <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              <card.icon className="h-3 w-3" /> {card.label}
            </div>
            <p className={cn("mt-2 text-xl font-black tabular-nums", card.tone)}>{card.value}</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{card.hint}</p>
          </div>
        ))}
      </div>

      {results.map(({ entityId, entityName, result }) => {
        if (result.stats.transactionCount === 0 && result.stats.flowCount === 0) return null;
        return (
          <div
            key={entityId}
            className="glass-card overflow-hidden rounded-[2rem] border border-white/5"
          >
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest">{entityName}</h3>
              <span className="text-[10px] text-muted-foreground">
                {result.stats.matched} conciliado(s) de {result.stats.transactionCount} ·{" "}
                {result.stats.flowCount} fluxo(s) de custódia
              </span>
            </div>

            {result.pairs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Extrato</th>
                      <th className="px-4 py-2">Custódia</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                      <th className="px-4 py-2">Casamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.pairs.slice(0, 40).map((pair) => (
                      <tr key={`${pair.transaction.id}-${pair.flow.id}`} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <p className="text-[11px] font-bold">{pair.transaction.description}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/60">
                            {dateBr(pair.transaction.date)} ·{" "}
                            {pair.transaction.type === "income" ? "crédito" : "débito"}
                          </p>
                        </td>
                        <td className="px-4 py-2">
                          <p className="text-[11px] font-bold">
                            {KIND_LABELS[pair.flow.kind] ?? pair.flow.kind}
                          </p>
                          <p className="text-[9px] font-mono text-muted-foreground/60">
                            {dateBr(pair.flow.date)}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                          {brl(pair.amount)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                              pair.confidence === "exata"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                            )}
                          >
                            {pair.confidence === "exata" ? "mesma data" : `D+${pair.dayDistance}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-3 text-[11px] text-muted-foreground">
                Nenhum par conciliado nesta entidade.
              </p>
            )}

            {result.unmatchedTransactions.length > 0 ? (
              <div className="border-t border-white/5">
                <p className="px-4 pt-3 text-[9px] font-black uppercase tracking-widest text-amber-400">
                  Extrato sem lastro na custódia
                </p>
                <div className="divide-y divide-white/5">
                  {result.unmatchedTransactions.slice(0, 25).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold">{transaction.description}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">
                          {dateBr(transaction.date)} · {brl(transaction.amount)}
                        </p>
                      </div>
                      <button
                        onClick={() => createFlowFromTransaction(entityId, transaction.id, result)}
                        disabled={creating === transaction.id}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all hover:bg-white/10 disabled:opacity-50"
                      >
                        {creating === transaction.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <PlusCircle className="h-3 w-3" />
                        )}
                        Criar {KIND_LABELS[suggestFlowKind(transaction)] ?? "fluxo"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result.unmatchedFlows.length > 0 ? (
              <div className="border-t border-white/5">
                <p className="px-4 pt-3 text-[9px] font-black uppercase tracking-widest text-amber-400">
                  Custódia sem extrato correspondente
                </p>
                <div className="divide-y divide-white/5">
                  {result.unmatchedFlows.slice(0, 25).map((flow) => (
                    <div key={flow.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold">
                          {KIND_LABELS[flow.kind] ?? flow.kind}
                          {flow.description ? ` — ${flow.description}` : ""}
                        </p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">
                          {dateBr(flow.date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums">
                        {brl(flow.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
