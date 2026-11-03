import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  FileWarning,
  Gavel,
  Loader2,
  Plus,
  Scale,
  ShieldQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMissingTableError,
  useAssets,
  useLegalCases,
  useLegalProvisionEntries,
  useLiabilities,
  usePositions,
} from "@/hooks/usePatrimonio";
import { useCreateProvisionEntry } from "@/hooks/useCrud";
import { buildBalanceSheet } from "@/lib/wealth/balance";
import {
  BAND_LABELS,
  LEGAL_TYPE_LABELS,
  PHASE_LABELS,
  buildProvisionReport,
  type LegalCaseLike,
} from "@/lib/legal/provision";

export const Route = createFileRoute("/_app/contencioso")({
  component: Contencioso,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return brl(value);
};
const pct = (value: number, digits = 1) => `${value.toFixed(digits).replace(".", ",")}%`;
const pts = (value: number) => `${(value * 100).toFixed(0)}%`;

const BAND_TONE: Record<string, string> = {
  provavel: "bg-red-500/10 text-red-400 border-red-500/20",
  possivel: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  remota: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const ENTRY_KINDS = [
  { value: "constituicao", label: "Constituição (+)" },
  { value: "atualizacao", label: "Atualização monetária (+)" },
  { value: "reversao", label: "Reversão (−)" },
  { value: "baixa", label: "Baixa / pagamento (−)" },
] as const;

function Contencioso() {
  const { data: cases, error: casesError, isLoading } = useLegalCases();
  const { data: entries } = useLegalProvisionEntries();
  const { data: positions } = usePositions();
  const { data: assets } = useAssets();
  const { data: liabilities } = useLiabilities();
  const createEntry = useCreateProvisionEntry();

  const [form, setForm] = useState({
    case_id: "",
    kind: "constituicao",
    amount: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const balance = useMemo(
    () =>
      buildBalanceSheet({
        positions: (positions ?? []).map((position) => ({
          quantity: position.quantity,
          unit_price: position.unit_price,
        })),
        registeredAssets: (assets ?? []).map((asset) => ({ current_value: asset.value })),
        liabilities: (liabilities ?? []).map((liability) => ({
          ...liability,
          outstanding: Number(liability.outstanding ?? 0),
        })),
      }),
    [positions, assets, liabilities],
  );

  const liquid = useMemo(
    () =>
      (positions ?? [])
        .filter((position) => position.asset_class === "caixa" || position.liquidity === "d0" || position.liquidity === "d1")
        .reduce((sum, position) => sum + Number(position.quantity ?? 0) * Number(position.unit_price ?? 0), 0),
    [positions],
  );

  const report = useMemo(
    () =>
      buildProvisionReport({
        cases: (cases ?? []).map(
          (item): LegalCaseLike => ({
            id: item.id,
            case_number: item.case_number,
            title: item.title,
            type: item.type,
            status: item.status,
            risk_level: item.risk_level,
            value_at_stake: item.value_at_stake,
            polarity: item.polarity ?? "passivo",
            probability: item.probability ?? null,
            phase: item.phase ?? null,
            expected_settlement: item.expected_settlement ?? null,
          }),
        ),
        entries: (entries ?? []).map((entry) => ({
          case_id: entry.case_id,
          kind: entry.kind,
          amount: entry.amount,
          occurred_on: entry.occurred_on,
        })),
        netWorth: balance.totals.netWorth,
        liquid,
      }),
    [cases, entries, balance.totals.netWorth, liquid],
  );

  const submitEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.case_id || !form.amount) return;
    createEntry.mutate(
      {
        case_id: form.case_id,
        kind: form.kind as "constituicao",
        amount: form.amount,
        occurred_on: form.occurred_on,
        note: form.note,
      },
      {
        onSuccess: () => setForm((current) => ({ ...current, amount: "", note: "" })),
      },
    );
  };

  if (isMissingTableError(casesError)) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="glass-card rounded-[2rem] border border-amber-500/20 p-8">
          <FileWarning className="mb-3 h-6 w-6 text-amber-400" />
          <h1 className="font-display text-xl font-black uppercase tracking-tight">
            Falta aplicar a migration
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            A tabela de processos ainda não existe neste projeto. Rode{" "}
            <code className="rounded bg-white/10 px-1">supabase/APLICAR-TUDO.sql</code> e recarregue.
          </p>
        </div>
      </div>
    );
  }

  const passiveCases = report.cases.filter((item) => item.polarity === "passivo");
  const activeCases = report.cases.filter((item) => item.polarity === "ativo");

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Passivo contingente
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Contencioso</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Valor da causa não é dívida. Aqui cada processo vira <strong>provisão</strong> (reduz o
            PL hoje), <strong>divulgação</strong> (pode reduzir) ou <strong>nada</strong> — pela régua
            do CPC 25: provável &gt; 50%, possível 10–50%, remota abaixo de 10%.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-muted-foreground">
          <Scale className="h-3.5 w-3.5" />
          PL da wave 11: <strong className="text-foreground">{compact(report.equity.netWorth)}</strong>
        </div>
      </header>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center rounded-[2rem] border border-white/5 p-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : report.cases.length === 0 ? (
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <Gavel className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-bold">Nenhum processo cadastrado</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Cadastre em Assessoria jurídica: com valor da causa, probabilidade e fase, o passivo
            contingente entra no balanço sozinho.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Provisão reconhecida",
                value: compact(report.totals.provision),
                hint: `${pct(report.equity.provisionToEquity)} do PL · ${report.totals.probableCases} processo(s) provável(is)`,
                icon: BadgeDollarSign,
                tone: "text-red-400",
              },
              {
                label: "Passivo possível (divulgado)",
                value: compact(report.totals.disclosed),
                hint: `${report.totals.possibleCases} processo(s) entre 10% e 50%`,
                icon: ShieldQuestion,
                tone: "text-amber-400",
              },
              {
                label: "PL ajustado ao risco",
                value: compact(report.equity.adjustedNetWorth),
                hint: `pior caso (provisão + possíveis): ${compact(report.equity.worstCaseNetWorth)}`,
                icon: Banknote,
                tone: "text-foreground",
              },
              {
                label: "Recuperação esperada",
                value: compact(report.totals.expectedRecovery),
                hint: `${report.totals.activeCases} causa(s) ativa(s) · só divulgada`,
                icon: Gavel,
                tone: "text-emerald-400",
              },
            ].map((card) => (
              <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <card.icon className="h-3 w-3" /> {card.label}
                </div>
                <p className={cn("mt-2 truncate text-xl font-black tabular-nums", card.tone)}>
                  {card.value}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>

          {report.warnings.length > 0 ? (
            <div className="space-y-2">
              {report.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Processos e provisão
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  {passiveCases.length} passivos · {activeCases.length} ativos · {report.totals.neutralCases} sem contingência
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Processo</th>
                      <th className="px-4 py-2 text-right">Causa</th>
                      <th className="px-4 py-2 text-right">Prob.</th>
                      <th className="px-4 py-2 text-right">Faixa</th>
                      <th className="px-4 py-2 text-right">Provisão</th>
                      <th className="px-4 py-2 text-right">Prazo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {report.cases.map((item) => (
                      <tr key={item.id} className="text-[11px] hover:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <p className="font-bold">{item.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.typeLabel}
                            {item.phase ? ` · ${PHASE_LABELS[item.phase]}` : ""}
                            {item.polarity === "ativo" ? " · causa ativa" : ""}
                            {item.probabilitySource === "premissa" ? " · prob. estimada" : ""}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {item.valueAtStake > 0 ? compact(item.valueAtStake) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {item.polarity === "neutro" ? "—" : pts(item.probability)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.polarity === "neutro" ? (
                            <span className="inline-flex rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                              Sem contingência
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                BAND_TONE[item.band],
                              )}
                            >
                              {BAND_LABELS[item.band]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">
                          {item.provision > 0 ? (
                            brl(item.provision)
                          ) : item.disclosed > 0 ? (
                            <span className="text-amber-400/80" title="Divulgado, não reconhecido">
                              {brl(item.disclosed)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {item.settlementMonths >= 12
                            ? `${(item.settlementMonths / 12).toFixed(1).replace(".", ",")} a`
                            : `${Math.round(item.settlementMonths)} m`}
                          {item.settlementEstimated ? "*" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground">
                * prazo estimado (sem data de desembolso informada). Provisão acima de 12 meses é
                trazida a valor presente por {pct(report.assumptions.discountRateAnnual * 100, 0)} a.a.
              </p>
            </section>

            <div className="space-y-4">
              <section className="glass-card rounded-[2rem] border border-white/5 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-black uppercase tracking-widest">
                    De onde vem a provisão
                  </h2>
                  <span className="text-[10px] text-muted-foreground">por tipo</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {report.byType.map((row) => (
                    <div key={row.type}>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="font-bold">{LEGAL_TYPE_LABELS[row.type]}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {compact(row.provision)} · {pct(row.shareOfProvision)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-red-500/70"
                          style={{ width: `${Math.min(100, row.shareOfProvision)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/70">
                        {row.cases} processo(s) · causa de {compact(row.atStake)}
                        {row.disclosed > 0 ? ` · divulgado ${compact(row.disclosed)}` : ""}
                      </p>
                    </div>
                  ))}
                  {report.byType.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Sem provisão reconhecida.</p>
                  ) : null}
                </div>
              </section>

              <section className="glass-card rounded-[2rem] border border-white/5 p-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Se a probabilidade mudar 10 p.p.
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  É o número que mais move a provisão — e o que o jurídico consegue refinar.
                </p>
                <div className="mt-3 space-y-2">
                  {report.sensitivity.map((row) => (
                    <div key={row.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                      <p className="truncate text-[11px] font-bold">{row.title}</p>
                      <div className="mt-1 flex items-center justify-between text-[10px] tabular-nums text-muted-foreground">
                        <span>
                          {pct(row.probability, 0)} → {brl(row.provisionNow)}
                        </span>
                        <span className="text-amber-400">
                          +10 p.p. → {brl(row.provisionPlus10)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {report.sensitivity.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      Nenhum processo provável para sensibilizar.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          </div>

          <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4">
              <div>
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Rollforward da provisão
                </h2>
                <p className="text-[10px] text-muted-foreground">
                  Saldo inicial + constituições + atualização − reversões − baixas = saldo escriturado
                </p>
              </div>
              <span
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest",
                  Math.abs(report.rollforward.closing - report.totals.provision) <=
                    Math.max(1000, report.totals.provision * 0.02)
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-400",
                )}
              >
                {Math.abs(report.rollforward.closing - report.totals.provision) <=
                Math.max(1000, report.totals.provision * 0.02)
                  ? "Saldo concilia"
                  : "Saldo diverge"}
              </span>
            </div>
            <div className="grid gap-px bg-white/5 md:grid-cols-6">
              {[
                { label: "Saldo inicial", value: report.rollforward.opening },
                { label: "+ Constituições", value: report.rollforward.additions },
                { label: "+ Atualização", value: report.rollforward.monetaryUpdate },
                { label: "− Reversões", value: -report.rollforward.reversals },
                { label: "− Baixas", value: -report.rollforward.settlements },
                { label: "= Saldo escriturado", value: report.rollforward.closing },
              ].map((item, index) => (
                <div key={item.label} className="bg-background/60 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 truncate text-sm font-black tabular-nums",
                      index === 5 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {compact(item.value)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/5 p-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                Registrar lançamento
              </p>
              <form onSubmit={submitEntry} className="grid gap-2 md:grid-cols-[2fr_1.4fr_1fr_1fr_auto]">
                <select
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px]"
                  value={form.case_id}
                  onChange={(event) => setForm({ ...form, case_id: event.target.value })}
                >
                  <option value="">Processo…</option>
                  {report.cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <select
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px]"
                  value={form.kind}
                  onChange={(event) => setForm({ ...form, kind: event.target.value })}
                >
                  {ENTRY_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
                <input
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px]"
                  inputMode="decimal"
                  placeholder="Valor (R$)"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                />
                <input
                  type="date"
                  className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px]"
                  value={form.occurred_on}
                  onChange={(event) => setForm({ ...form, occurred_on: event.target.value })}
                />
                <button
                  type="submit"
                  disabled={createEntry.isPending || !form.case_id || !form.amount}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
                >
                  {createEntry.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Lançar
                </button>
              </form>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Provisão recalculada hoje: <strong className="text-foreground">{brl(report.totals.provision)}</strong>{" "}
                · saldo escriturado: <strong className="text-foreground">{brl(report.rollforward.closing)}</strong>.
                A diferença é o lançamento que falta (ou que passou do ponto).
              </p>
            </div>
          </section>

          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest">
              Como o número é construído
            </h2>
            <div className="mt-2 grid gap-3 text-[11px] text-muted-foreground md:grid-cols-3">
              <p>
                <strong className="text-foreground">Faixas (CPC 25).</strong> Perda provável &gt; 50%
                reconhece provisão; possível (10–50%) só divulga; remota não entra. Ganho em causa
                ativa nunca é reconhecido — só divulgado.
              </p>
              <p>
                <strong className="text-foreground">Probabilidade.</strong> O percentual do jurídico
                manda. Sem ele, o sistema estima por risco e fase processual — e marca a linha como
                estimada, para você saber onde pedir o dado.
              </p>
              <p>
                <strong className="text-foreground">Valor presente.</strong> Desembolso acima de 12
                meses é descontado a {pct(report.assumptions.discountRateAnnual * 100, 0)} a.a.
                (premissa declarada). Prazo sem data informada assume{" "}
                {report.assumptions.defaultSettlementMonths} meses.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
