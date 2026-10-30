import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Check,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useCapitalEvents,
  useCommitments,
  useEntities,
  isMissingTableError,
} from "@/hooks/usePatrimonio";
import {
  useCreateCapitalEvent,
  useCreateCommitment,
  useDeleteCapitalEvent,
  useDeleteCommitment,
  useSettleCapitalEvent,
} from "@/hooks/useCrud";
import {
  estimatedAnnualCall,
  summarizePortfolio,
  type CapitalEvent,
  type Commitment,
} from "@/lib/private-markets";

export const Route = createFileRoute("/_app/privados")({
  component: Privados,
});

const brl = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: digits });
const pct = (value: number) => `${(value * 100).toFixed(2).replace(".", ",")}x`;
const dateBr = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

const STRATEGY_LABELS: Record<string, string> = {
  private_equity: "Private equity",
  venture_capital: "Venture capital",
  infraestrutura: "Infraestrutura",
  real_estate: "Real estate",
  agro: "Agro",
  credito_privado: "Crédito privado",
  outro: "Outro",
};

function Privados() {
  const { data: entities } = useEntities();
  const commitments = useCommitments();
  const events = useCapitalEvents();

  const createCommitment = useCreateCommitment();
  const deleteCommitment = useDeleteCommitment();
  const createEvent = useCreateCapitalEvent();
  const deleteEvent = useDeleteCapitalEvent();
  const settle = useSettleCapitalEvent();

  const [entityFilter, setEntityFilter] = useState("todas");
  const [formOpen, setFormOpen] = useState(false);
  const [noticeFor, setNoticeFor] = useState<Commitment | null>(null);

  const filteredCommitments = useMemo(
    () =>
      ((commitments.data ?? []) as Commitment[]).filter(
        (item) => entityFilter === "todas" || item.entity_id === entityFilter,
      ),
    [commitments.data, entityFilter],
  );

  const filteredEvents = useMemo(
    () =>
      ((events.data ?? []) as CapitalEvent[]).filter((item) =>
        filteredCommitments.some((commitment) => commitment.id === item.commitment_id),
      ),
    [events.data, filteredCommitments],
  );

  const summary = useMemo(
    () => summarizePortfolio(filteredCommitments, filteredEvents),
    [filteredCommitments, filteredEvents],
  );

  const missingSchema =
    (commitments.error && isMissingTableError(commitments.error)) ||
    (events.error && isMissingTableError(events.error));

  const { totals } = summary;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Alternativos
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Capital calls & privados
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Fundo fechado não é posição, é promessa: o gestor chama o capital ao longo de anos. O
            número que importa é o <strong>não integralizado</strong> — o que ainda vai sair do caixa,
            muitas vezes com 10 dias de aviso.
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
            onClick={() => setFormOpen(true)}
            disabled={!entities?.length}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Novo compromisso
          </button>
        </div>
      </header>

      {missingSchema ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[11px]">
          <p className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4" /> Faltam as tabelas de privados
          </p>
          <p className="mt-1 text-muted-foreground">
            Aplique a migration <code>20261030190000_private_markets.sql</code> (ou rode{" "}
            <code>bun run check:schema</code> para ver tudo que falta).
          </p>
        </div>
      ) : null}

      {summary.warning ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-[11px] font-bold text-red-400">
          <AlertTriangle className="h-4 w-4" /> {summary.warning}
        </div>
      ) : null}

      {/* indicadores */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Capital não integralizado",
            value: brl(totals.unfunded),
            hint: `${totals.calledPct.toFixed(1).replace(".", ",")}% de ${brl(totals.committed)} chamado`,
            icon: Wallet,
            tone: totals.unfunded > 0 ? "text-amber-500" : "text-emerald-500",
          },
          {
            label: "Chamados em 90 dias",
            value: brl(totals.upcomingCalls90),
            hint: `${brl(totals.upcomingCalls30)} em até 30 dias`,
            icon: ArrowUpFromLine,
            tone: totals.upcomingCalls30 > 0 ? "text-amber-500" : "text-muted-foreground",
          },
          {
            label: "DPI (realizado)",
            value: pct(totals.dpi),
            hint: `${brl(totals.distributed)} distribuídos`,
            icon: ArrowDownToLine,
            tone: totals.dpi >= 1 ? "text-emerald-500" : "text-foreground",
          },
          {
            label: "TVPI (total)",
            value: pct(totals.tvpi),
            hint: `NAV informado ${brl(totals.nav)}`,
            icon: TrendingUp,
            tone: totals.tvpi >= 1 ? "text-emerald-500" : "text-amber-500",
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

      {/* agenda de chamadas */}
      <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest">Capital calls no radar</h2>
          <span className="text-[10px] text-muted-foreground">
            {summary.schedule.length} aviso(s) em aberto
          </span>
        </div>
        {summary.schedule.length === 0 ? (
          <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">
            Nenhum capital call em aberto. Registre o aviso do gestor para o caixa se preparar.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/[0.02]">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <th className="px-4 py-2">Veículo</th>
                  <th className="px-4 py-2">Vencimento</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2">Situação</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summary.schedule.map((item) => (
                  <tr key={item.event.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-[11px] font-bold">{item.commitmentName}</td>
                    <td className="px-4 py-2 text-[11px] font-mono">{dateBr(item.event.due_date)}</td>
                    <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums">
                      {brl(Number(item.event.amount), 2)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                          item.overdue
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : item.daysUntil <= 30
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-white/10 bg-white/5 text-muted-foreground",
                        )}
                      >
                        {item.overdue ? `vencido há ${Math.abs(item.daysUntil)}d` : `em ${item.daysUntil}d`}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => settle.mutate({ id: item.event.id })}
                          disabled={settle.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" /> Baixa
                        </button>
                        <button
                          onClick={() => deleteEvent.mutate({ id: item.event.id })}
                          className="rounded-lg border border-white/10 p-1 hover:bg-white/10"
                          aria-label="Remover aviso"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* compromissos */}
      <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest">
            {summary.commitments.length} compromisso(s)
          </h2>
          <span className="text-[10px] text-muted-foreground">
            ritmo estimado usa o prazo do fundo
          </span>
        </div>

        {commitments.isLoading ? (
          <p className="flex items-center gap-2 px-4 py-6 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
          </p>
        ) : summary.commitments.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Building2 className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm font-bold">Nenhum compromisso registrado</p>
            <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
              Cadastre o fundo com o capital assinado. A partir daí, cada aviso do gestor (call ou
              distribuição) entra em um clique e o caixa passa a enxergar a obrigação.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/[0.02]">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <th className="px-4 py-2">Veículo</th>
                  <th className="px-4 py-2">Estratégia</th>
                  <th className="px-4 py-2 text-right">Assinado</th>
                  <th className="px-4 py-2 text-right">Chamado</th>
                  <th className="px-4 py-2 text-right">Não integralizado</th>
                  <th className="px-4 py-2 text-right">Distribuído</th>
                  <th className="px-4 py-2 text-right">DPI</th>
                  <th className="px-4 py-2 text-right">TVPI</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summary.commitments.map((item) => (
                  <tr key={item.commitment.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2">
                      <p className="text-[11px] font-bold">{item.commitment.name}</p>
                      <p className="text-[9px] font-mono text-muted-foreground/60">
                        {item.commitment.manager ?? "—"}
                        {item.commitment.vintage ? ` · ${item.commitment.vintage}` : ""}
                        {item.nextCallDate ? ` · próx. ${dateBr(item.nextCallDate)}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-[10px] text-muted-foreground">
                      {STRATEGY_LABELS[item.commitment.strategy] ?? item.commitment.strategy}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] tabular-nums">
                      {brl(item.committed)}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] tabular-nums">
                      {brl(item.called)}
                      <span className="ml-1 text-[9px] text-muted-foreground">
                        {item.calledPct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] font-bold tabular-nums text-amber-500">
                      {brl(item.unfunded)}
                      <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                        ≈{brl(estimatedAnnualCall(item.commitment, item))}/ano
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] tabular-nums text-emerald-500">
                      {brl(item.distributed)}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] tabular-nums">{pct(item.dpi)}</td>
                    <td
                      className={cn(
                        "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                        item.tvpi >= 1 ? "text-emerald-500" : "text-amber-500",
                      )}
                    >
                      {pct(item.tvpi)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setNoticeFor(item.commitment)}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-widest hover:bg-white/10"
                        >
                          <Plus className="h-3 w-3" /> Aviso
                        </button>
                        <button
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Remover "${item.commitment.name}" e todos os avisos vinculados?`,
                              )
                            )
                              return;
                            deleteCommitment.mutate({ id: item.commitment.id });
                          }}
                          className="rounded-lg border border-white/10 p-1 hover:bg-white/10"
                          aria-label="Remover compromisso"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <CommitmentForm
          entities={entities ?? []}
          pending={createCommitment.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(payload) =>
            createCommitment.mutate(payload as never, { onSuccess: () => setFormOpen(false) })
          }
        />
      ) : null}

      {noticeFor ? (
        <NoticeForm
          commitment={noticeFor}
          pending={createEvent.isPending}
          onClose={() => setNoticeFor(null)}
          onSubmit={(payload) =>
            createEvent.mutate(payload, {
              onSuccess: () => {
                setNoticeFor(null);
                toast.success("Aviso registrado — o caixa já considera a saída.");
              },
            })
          }
        />
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------- forms

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-[1.5rem] border border-white/10 bg-[oklch(0.14_0.02_250)] p-5 shadow-2xl">
        <h2 className="mb-4 text-[11px] font-black uppercase tracking-widest">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-foreground outline-none focus:border-primary/50";

function CommitmentForm({
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
    manager: "",
    strategy: "private_equity",
    committed: "",
    vintage: String(new Date().getFullYear()),
    term_years: "10",
    nav: "0",
    notice_days: "15",
  });

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Shell title="Novo compromisso">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2 space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Veículo
          </span>
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Fundo Alencar PE IV" />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Holding</span>
          <select className={inputClass} value={form.entity_id} onChange={(e) => set("entity_id", e.target.value)}>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Gestor</span>
          <input className={inputClass} value={form.manager} onChange={(e) => set("manager", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Estratégia</span>
          <select className={inputClass} value={form.strategy} onChange={(e) => set("strategy", e.target.value)}>
            {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Capital assinado (R$)</span>
          <input type="number" className={inputClass} value={form.committed} onChange={(e) => set("committed", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Safra</span>
          <input type="number" className={inputClass} value={form.vintage} onChange={(e) => set("vintage", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Prazo (anos)</span>
          <input type="number" step="0.5" className={inputClass} value={form.term_years} onChange={(e) => set("term_years", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">NAV atual (R$)</span>
          <input type="number" className={inputClass} value={form.nav} onChange={(e) => set("nav", e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Aviso prévio (dias)</span>
          <input type="number" className={inputClass} value={form.notice_days} onChange={(e) => set("notice_days", e.target.value)} />
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
              committed: Number(form.committed),
              vintage: Number(form.vintage),
              term_years: Number(form.term_years),
              nav: Number(form.nav),
              notice_days: Number(form.notice_days),
            })
          }
          disabled={pending || !form.name || !form.entity_id || !Number(form.committed)}
          className="h-9 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Registrar"}
        </button>
      </div>
    </Shell>
  );
}

function NoticeForm({
  commitment,
  pending,
  onClose,
  onSubmit,
}: {
  commitment: Commitment;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    commitment_id: string;
    kind: "call" | "distribution";
    due_date: string;
    amount: number;
    status: "previsto" | "pago";
    paid_at?: string;
  }) => void;
}) {
  const [kind, setKind] = useState<"call" | "distribution">("call");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  return (
    <Shell title={`Aviso — ${commitment.name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(["call", "distribution"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setKind(option)}
              className={cn(
                "h-9 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                kind === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              {option === "call" ? "Capital call" : "Distribuição"}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Data do vencimento
          </span>
          <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Valor (R$)
          </span>
          <input type="number" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <input
            type="checkbox"
            checked={alreadyPaid}
            onChange={(e) => setAlreadyPaid(e.target.checked)}
            className="h-4 w-4 rounded border-white/20"
          />
          Já liquidado
        </label>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="h-9 rounded-xl border border-white/10 px-3 text-[10px] font-black uppercase tracking-widest">
          Cancelar
        </button>
        <button
          onClick={() =>
            onSubmit({
              commitment_id: commitment.id,
              kind,
              due_date: dueDate,
              amount: Number(amount),
              status: alreadyPaid ? "pago" : "previsto",
              paid_at: alreadyPaid ? dueDate : undefined,
            })
          }
          disabled={pending || !Number(amount)}
          className="h-9 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Lançando…" : "Lançar aviso"}
        </button>
      </div>
    </Shell>
  );
}
