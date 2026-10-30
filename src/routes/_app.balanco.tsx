import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Loader2,
  Plus,
  Scale,
  Target,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAssets,
  useEntities,
  useGoals,
  useLiabilities,
  usePositions,
  isMissingTableError,
} from "@/hooks/usePatrimonio";
import {
  useCreateGoal,
  useCreateLiability,
  useDeleteGoal,
  useDeleteLiability,
} from "@/hooks/useCrud";
import {
  buildBalanceSheet,
  evaluateGoals,
  prepaymentAdvantage,
  type Goal,
  type Liability,
} from "@/lib/wealth/balance";

export const Route = createFileRoute("/_app/balanco")({
  component: Balanco,
});

const brl = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: digits });
const pct = (value: number) => `${value.toFixed(1).replace(".", ",")}%`;
const dateBr = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

const LIABILITY_LABELS: Record<string, string> = {
  financiamento_imobiliario: "Financiamento imobiliário",
  credito_rural: "Crédito rural",
  emprestimo: "Empréstimo",
  consignado: "Consignado",
  cartao: "Cartão",
  debenture: "Debênture",
  divida_societaria: "Dívida societária",
  outro: "Outro",
};

const GOAL_LABELS: Record<string, string> = {
  liquidez: "Liquidez",
  sucessao: "Sucessão",
  imovel: "Imóvel",
  educacao: "Educação",
  filantropia: "Filantropia",
  reserva_oportunidade: "Reserva de oportunidade",
  meta_patrimonial: "Meta patrimonial",
  outro: "Outro",
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  concluida: { label: "concluída", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  no_prazo: { label: "no prazo", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  atencao: { label: "atenção", className: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  em_risco: { label: "em risco", className: "border-red-500/30 bg-red-500/10 text-red-400" },
  vencida: { label: "vencida", className: "border-red-500/30 bg-red-500/10 text-red-400" },
};

function Balanco() {
  const [tab, setTab] = useState<"balanco" | "metas">("balanco");
  const { data: entities } = useEntities();
  const positions = usePositions();
  const assets = useAssets();
  const liabilities = useLiabilities();
  const goals = useGoals();

  const createLiability = useCreateLiability();
  const deleteLiability = useDeleteLiability();
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();

  const [entityFilter, setEntityFilter] = useState("todas");
  const [liabilityOpen, setLiabilityOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const filteredLiabilities = useMemo(
    () =>
      ((liabilities.data ?? []) as Liability[]).filter(
        (item) => entityFilter === "todas" || item.entity_id === entityFilter,
      ),
    [liabilities.data, entityFilter],
  );

  const filteredGoals = useMemo(
    () =>
      ((goals.data ?? []) as Goal[]).filter(
        (item) => entityFilter === "todas" || item.entity_id === entityFilter,
      ),
    [goals.data, entityFilter],
  );

  const filteredPositions = useMemo(
    () =>
      (positions.data ?? []).filter(
        (item) => entityFilter === "todas" || item.entity_id === entityFilter,
      ),
    [positions.data, entityFilter],
  );

  const filteredAssets = useMemo(
    () =>
      (assets.data ?? []).filter(
        (item) => entityFilter === "todas" || item.entity_id === entityFilter,
      ),
    [assets.data, entityFilter],
  );

  const sheet = useMemo(
    () =>
      buildBalanceSheet({
        positions: filteredPositions.map((position) => ({
          quantity: position.quantity,
          unit_price: position.unit_price,
        })),
        registeredAssets: filteredAssets.map((asset) => ({
          current_value: (asset as { current_value?: number | null }).current_value ?? 0,
        })),
        liabilities: filteredLiabilities,
      }),
    [filteredPositions, filteredAssets, filteredLiabilities],
  );

  const goalSummary = useMemo(() => evaluateGoals(filteredGoals), [filteredGoals]);

  const missingSchema =
    (liabilities.error && isMissingTableError(liabilities.error)) ||
    (goals.error && isMissingTableError(goals.error));

  const { totals } = sheet;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Posição patrimonial
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Balanço & metas
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Patrimônio líquido é ativo − passivo. Sem o passivo, a alocação esconde metade da
            verdade: uma carteira de R$ 50 milhões com R$ 40 milhões de dívida não é uma carteira de
            R$ 50 milhões.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={entityFilter}
            onChange={(event) => setEntityFilter(event.target.value)}
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest"
          >
            <option value="todas">Todas as holdings</option>
            {(entities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => (tab === "balanco" ? setLiabilityOpen(true) : setGoalOpen(true))}
            disabled={!entities?.length}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {tab === "balanco" ? "Novo passivo" : "Nova meta"}
          </button>
        </div>
      </header>

      {missingSchema ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[11px]">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" /> Faltam as tabelas de balanço
          </p>
          <p className="mt-1 text-muted-foreground">
            Aplique <code>20261030200000_balance_sheet.sql</code> ou rode{" "}
            <code>bun run check:schema</code>.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {[
          { id: "balanco" as const, label: "Balanço patrimonial", icon: Scale },
          { id: "metas" as const, label: "Metas", icon: Target },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all",
              tab === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            )}
          >
            <item.icon className="h-3.5 w-3.5" /> {item.label}
          </button>
        ))}
      </div>

      {tab === "balanco" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Ativo total",
                value: brl(sheet.assets.total),
                hint: `${brl(sheet.assets.financial)} financeiro · ${brl(sheet.assets.registered)} registral`,
                icon: Building2,
                tone: "text-foreground",
              },
              {
                label: "Passivo (dívida)",
                value: brl(totals.debt),
                hint: `${sheet.liabilities.length} contrato(s) · custo ${brl(totals.annualCost)}/ano`,
                icon: Banknote,
                tone: totals.debt > 0 ? "text-red-400" : "text-emerald-500",
              },
              {
                label: "Patrimônio líquido",
                value: brl(totals.netWorth),
                hint: `alavancagem ${pct(totals.leverage)} do ativo`,
                icon: Wallet,
                tone: totals.netWorth >= 0 ? "text-emerald-500" : "text-red-500",
              },
              {
                label: "Serviço da dívida",
                value: `${brl(totals.monthlyService)}/mês`,
                hint: `taxa média ${pct(totals.weightedRate)} a.a.`,
                icon: TrendingDown,
                tone: "text-amber-500",
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

          {sheet.warnings.length > 0 ? (
            <div className="space-y-2">
              {sheet.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
                </div>
              ))}
            </div>
          ) : null}

          <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest">Passivos</h2>
              <span className="text-[10px] text-muted-foreground">
                vence em 12 meses: {brl(totals.dueIn12Months)}
              </span>
            </div>
            {liabilities.isLoading ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
              </p>
            ) : sheet.liabilities.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Scale className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm font-bold">Nenhum passivo registrado</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
                  O balanço está mostrando só o lado do ativo. Registre financiamentos, crédito rural
                  e dívidas societárias para ver o patrimônio líquido de verdade.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Dívida</th>
                      <th className="px-4 py-2">Tipo</th>
                      <th className="px-4 py-2 text-right">Saldo devedor</th>
                      <th className="px-4 py-2 text-right">Taxa</th>
                      <th className="px-4 py-2 text-right">Prestação</th>
                      <th className="px-4 py-2 text-right">Custo/ano</th>
                      <th className="px-4 py-2">Garantia</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sheet.liabilities.map((item) => {
                      const advantage = prepaymentAdvantage(
                        item.outstanding,
                        Number(item.liability.rate_annual ?? 0),
                        8,
                      );
                      return (
                        <tr key={item.liability.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2">
                            <p className="text-[11px] font-bold">{item.liability.name}</p>
                            <p className="text-[9px] font-mono text-muted-foreground/60">
                              {item.liability.creditor ?? "—"}
                              {item.liability.due_date ? ` · vence ${dateBr(item.liability.due_date)}` : ""}
                            </p>
                          </td>
                          <td className="px-4 py-2 text-[10px] text-muted-foreground">
                            {LIABILITY_LABELS[item.liability.kind] ?? item.liability.kind}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums text-red-400">
                            {brl(item.outstanding)}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] tabular-nums">
                            {pct(Number(item.liability.rate_annual ?? 0))}
                            <span className="ml-1 text-[9px] text-muted-foreground">
                              {item.liability.amortization}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] tabular-nums">
                            {brl(item.monthlyPayment)}
                          </td>
                          <td className="px-4 py-2 text-right text-[11px] tabular-nums text-amber-500">
                            {brl(item.annualCost)}
                            {advantage > 0 ? (
                              <span className="ml-1 text-[9px] text-emerald-500">
                                quitar rende {brl(advantage)}
                              </span>
                            ) : null}
                          </td>
                          <td className="max-w-[160px] truncate px-4 py-2 text-[10px] text-muted-foreground">
                            {item.liability.collateral || "sem garantia"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => {
                                if (!window.confirm(`Remover "${item.liability.name}" do balanço?`)) return;
                                deleteLiability.mutate({ id: item.liability.id });
                              }}
                              className="rounded-lg border border-white/10 p-1 hover:bg-white/10"
                              aria-label="Remover passivo"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Alvo somado",
                value: brl(goalSummary.totals.target),
                hint: `${goalSummary.goals.length} meta(s) ativa(s)`,
                tone: "text-foreground",
              },
              {
                label: "Já alocado",
                value: brl(goalSummary.totals.allocated),
                hint:
                  goalSummary.totals.target > 0
                    ? `${pct((goalSummary.totals.allocated / goalSummary.totals.target) * 100)} do alvo`
                    : "—",
                tone: "text-emerald-500",
              },
              {
                label: "Falta",
                value: brl(goalSummary.totals.missing),
                hint: "sem contar rendimento",
                tone: "text-amber-500",
              },
              {
                label: "Aporte necessário",
                value: `${brl(goalSummary.totals.requiredMonthly)}/mês`,
                hint: "somando todas as metas, com o retorno esperado",
                tone: "text-primary",
              },
            ].map((card) => (
              <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  {card.label}
                </p>
                <p className={cn("mt-2 text-xl font-black tabular-nums", card.tone)}>{card.value}</p>
                <p className="text-[10px] text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>

          {goalSummary.goals.length === 0 ? (
            <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
              <Target className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-bold">Nenhuma meta cadastrada</p>
              <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
                Uma meta é alvo + prazo + prioridade. O sistema calcula o aporte mensal necessário
                com o retorno esperado da carteira — e mostra o que acontece se você não aportar.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {goalSummary.goals.map((item) => {
                const style = STATUS_STYLE[item.status];
                return (
                  <div key={item.goal.id} className="glass-card rounded-[1.5rem] border border-white/5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-bold">{item.goal.name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">
                          {GOAL_LABELS[item.goal.kind] ?? item.goal.kind} · prazo{" "}
                          {dateBr(item.goal.target_date)} · P{item.goal.priority}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                          style.className,
                        )}
                      >
                        {style.label}
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.progressPct >= 100
                            ? "bg-emerald-500"
                            : item.progressPct >= 60
                              ? "bg-primary"
                              : "bg-amber-500",
                        )}
                        style={{ width: `${Math.min(100, item.progressPct)}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-muted-foreground/70">Alocado / alvo</p>
                        <p className="font-bold tabular-nums">
                          {brl(item.allocated)} / {brl(item.target)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/70">Falta</p>
                        <p className="font-bold tabular-nums text-amber-500">{brl(item.missing)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/70">Aporte necessário</p>
                        <p className="font-bold tabular-nums text-primary">
                          {brl(item.requiredMonthly)}/mês
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/70">
                          Sem aportar, chega a {item.monthsLeft} m
                        </p>
                        <p
                          className={cn(
                            "font-bold tabular-nums",
                            item.projectedAtDeadline >= item.target
                              ? "text-emerald-500"
                              : "text-red-400",
                          )}
                        >
                          {brl(item.projectedAtDeadline)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => {
                          if (!window.confirm(`Remover a meta "${item.goal.name}"?`)) return;
                          deleteGoal.mutate({ id: item.goal.id });
                        }}
                        className="rounded-lg border border-white/10 p-1 hover:bg-white/10"
                        aria-label="Remover meta"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {liabilityOpen ? (
        <LiabilityForm
          entities={entities ?? []}
          pending={createLiability.isPending}
          onClose={() => setLiabilityOpen(false)}
          onSubmit={(payload) =>
            createLiability.mutate(payload as never, { onSuccess: () => setLiabilityOpen(false) })
          }
        />
      ) : null}

      {goalOpen ? (
        <GoalForm
          entities={entities ?? []}
          pending={createGoal.isPending}
          onClose={() => setGoalOpen(false)}
          onSubmit={(payload) =>
            createGoal.mutate(payload as never, { onSuccess: () => setGoalOpen(false) })
          }
        />
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------- forms

const inputClass =
  "h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-foreground outline-none focus:border-primary/50";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[1.5rem] border border-white/10 bg-[oklch(0.14_0.02_250)] p-5 shadow-2xl">
        <h2 className="mb-4 text-[11px] font-black uppercase tracking-widest">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function LiabilityForm({
  entities,
  pending,
  onClose,
  onSubmit,
}: {
  entities: { id: string; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    entity_id: entities[0]?.id ?? "",
    name: "",
    kind: "credito_rural",
    creditor: "",
    principal: "",
    outstanding: "",
    rate_annual: "8.5",
    amortization: "price",
    term_months: "120",
    collateral: "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Shell title="Novo passivo">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Descrição</span>
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Financiamento Fazenda Boa Vista" />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Holding</span>
          <select className={inputClass} value={form.entity_id} onChange={(e) => set("entity_id", e.target.value)}>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Tipo</span>
          <select className={inputClass} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {Object.entries(LIABILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Saldo devedor (R$)</span>
          <input type="number" className={inputClass} value={form.outstanding} onChange={(e) => set("outstanding", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Taxa (% a.a.)</span>
          <input type="number" step="0.1" className={inputClass} value={form.rate_annual} onChange={(e) => set("rate_annual", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Sistema</span>
          <select className={inputClass} value={form.amortization} onChange={(e) => set("amortization", e.target.value)}>
            <option value="price">Price (parcela fixa)</option>
            <option value="sac">SAC (amortização fixa)</option>
            <option value="bullet">Bullet (juros + principal no fim)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Prazo (meses)</span>
          <input type="number" className={inputClass} value={form.term_months} onChange={(e) => set("term_months", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Credor</span>
          <input className={inputClass} value={form.creditor} onChange={(e) => set("creditor", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Garantia</span>
          <input className={inputClass} value={form.collateral} onChange={(e) => set("collateral", e.target.value)} placeholder="Hipoteca da fazenda" />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="h-9 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest">
          Cancelar
        </button>
        <button
          onClick={() =>
            onSubmit({
              ...form,
              principal: Number(form.principal || form.outstanding),
              outstanding: Number(form.outstanding),
              rate_annual: Number(form.rate_annual),
              term_months: Number(form.term_months),
            })
          }
          disabled={pending || !form.name || !form.entity_id || !Number(form.outstanding)}
          className="h-9 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Registrar"}
        </button>
      </div>
    </Shell>
  );
}

function GoalForm({
  entities,
  pending,
  onClose,
  onSubmit,
}: {
  entities: { id: string; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    entity_id: entities[0]?.id ?? "",
    name: "",
    kind: "meta_patrimonial",
    target_amount: "",
    allocated: "0",
    target_date: new Date(Date.now() + 3 * 365 * 86_400_000).toISOString().slice(0, 10),
    priority: "2",
    expected_return: "8",
  });
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Shell title="Nova meta">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Nome</span>
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Reserva para oportunidade" />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Holding</span>
          <select className={inputClass} value={form.entity_id} onChange={(e) => set("entity_id", e.target.value)}>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Tipo</span>
          <select className={inputClass} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {Object.entries(GOAL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Alvo (R$)</span>
          <input type="number" className={inputClass} value={form.target_amount} onChange={(e) => set("target_amount", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Já alocado (R$)</span>
          <input type="number" className={inputClass} value={form.allocated} onChange={(e) => set("allocated", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Data-alvo</span>
          <input type="date" className={inputClass} value={form.target_date} onChange={(e) => set("target_date", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Prioridade</span>
          <select className={inputClass} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="1">1 · inegociável</option>
            <option value="2">2 · importante</option>
            <option value="3">3 · desejável</option>
          </select>
        </label>
        <label className="sm:col-span-2 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Retorno esperado da carteira (% a.a.)
          </span>
          <input type="number" step="0.1" className={inputClass} value={form.expected_return} onChange={(e) => set("expected_return", e.target.value)} />
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="h-9 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest">
          Cancelar
        </button>
        <button
          onClick={() =>
            onSubmit({
              ...form,
              target_amount: Number(form.target_amount),
              allocated: Number(form.allocated),
              priority: Number(form.priority),
              expected_return: Number(form.expected_return),
            })
          }
          disabled={pending || !form.name || !form.entity_id || !Number(form.target_amount)}
          className="h-9 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Criar meta"}
        </button>
      </div>
    </Shell>
  );
}
