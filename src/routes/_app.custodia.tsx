import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Wallet,
  Plus,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  Droplets,
  Globe2,
  Target,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAccounts,
  useCashFlows,
  useEntities,
  usePortfolioSnapshots,
  usePositions,
  useDocuments,
  useAssets,
  useTransactions,
  isMissingTableError,
} from "@/hooks/usePatrimonio";
import {
  useCreatePosition,
  useDeletePosition,
  useRebuildSnapshots,
  useSyncQuotes,
} from "@/hooks/useCrud";
import { classifyFreshness, STALE_DAYS } from "@/lib/quotes";
import type { PositionInput } from "@/lib/validation/schemas";
import { PositionForm } from "@/components/forms/PositionForm";
import { CashFlowForm } from "@/components/forms/CashFlowForm";
import { ReconciliationPanel } from "@/components/custody/ReconciliationPanel";
import {
  summarizeAllocation,
  computeDrift,
  ASSET_CLASS_LABELS,
  LIQUIDITY_LABELS,
  positionValue,
  type PolicyTarget,
} from "@/lib/wealth/allocation";
import { summarizePerformance } from "@/lib/wealth/performance";
import { buildQualityReport } from "@/lib/wealth/quality";

export const Route = createFileRoute("/_app/custodia")({
  component: Custodia,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

const TABS = [
  { id: "visao", label: "Visão geral", icon: Layers },
  { id: "posicoes", label: "Posições", icon: Wallet },
  { id: "conciliacao", label: "Conciliação", icon: ArrowLeftRight },
  { id: "politica", label: "Política & drift", icon: Target },
  { id: "qualidade", label: "Qualidade do dado", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Custodia() {
  const { data: positions, isLoading, error } = usePositions();
  const { data: accounts } = useAccounts();
  const { data: flows } = useCashFlows();
  const { data: snapshots } = usePortfolioSnapshots();
  const { data: entities } = useEntities();
  const { data: documents } = useDocuments();
  const { data: assets } = useAssets();
  const { data: transactions } = useTransactions();
  const removePosition = useDeletePosition();
  const rebuild = useRebuildSnapshots();
  const syncQuotes = useSyncQuotes();

  const [tab, setTab] = useState<TabId>("visao");
  const [positionOpen, setPositionOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [entityFilter, setEntityFilter] = useState("todas");

  const filtered = useMemo(
    () => (positions ?? []).filter((p) => entityFilter === "todas" || p.entity_id === entityFilter),
    [positions, entityFilter],
  );

  const allocation = useMemo(() => summarizeAllocation(filtered), [filtered]);

  const performance = useMemo(
    () =>
      summarizePerformance(
        (snapshots ?? []).map((s) => ({
          as_of: s.as_of,
          market_value: Number(s.market_value ?? 0),
          cost_basis: Number(s.cost_basis ?? 0),
          net_flow: Number(s.net_flow ?? 0),
        })),
        (flows ?? []).map((f) => ({ flow_date: f.flow_date, amount: Number(f.amount ?? 0), kind: f.kind })),
      ),
    [snapshots, flows],
  );

  const quality = useMemo(
    () => buildQualityReport({ positions: filtered, documents, assets }),
    [filtered, documents, assets],
  );

  // Política-alvo padrão de um family office balanceado (editável na tela).
  const policy: PolicyTarget[] = [
    { asset_class: "caixa", target: 10 },
    { asset_class: "renda_fixa", target: 30 },
    { asset_class: "renda_variavel", target: 20 },
    { asset_class: "fundos", target: 10 },
    { asset_class: "imoveis", target: 15 },
    { asset_class: "internacional", target: 10 },
    { asset_class: "alternativos", target: 5 },
  ];
  const drift = useMemo(() => computeDrift(filtered, policy), [filtered]);
  const breaches = drift.filter((row) => row.breach).length;

  if (isLoading && !error) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-7 lg:space-y-9 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      {isMissingTableError(error) && (
        <div className="glass-card rounded-2xl p-4 border border-orange-500/25 bg-orange-500/[0.05] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold">Tabelas de custódia ainda não existem no banco</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplique a migration <span className="font-mono">20261030150000_wealth_core.sql</span> no SQL Editor.
              Enquanto isso, posições, alocação e performance ficam vazias.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">Núcleo de riqueza</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">Custódia & Performance</h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            {allocation.positionsCount} posições em {accounts?.length ?? 0} contas · {brl(allocation.total)} de
            valor de mercado · TWR e MWR calculados sobre os fechamentos reais.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-11 bg-background border border-white/10 rounded-xl px-3 text-[11px] font-bold uppercase tracking-widest focus:outline-none"
          >
            <option value="todas">Todas as holdings</option>
            {(entities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setFlowOpen(true)}
            className="h-11 px-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Droplets className="h-3.5 w-3.5" /> Aporte / resgate
          </button>
          <button
            onClick={() => setPositionOpen(true)}
            className="h-11 px-5 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus className="h-3.5 w-3.5" /> Nova posição
          </button>
        </div>
      </div>

      {/* KPIs de performance */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        <Kpi
          label="Valor de mercado"
          value={brl(allocation.total)}
          detail={`${allocation.positionsCount} posições`}
          icon={Wallet}
          tone="primary"
        />
        <Kpi
          label="TWR (período)"
          value={pct(performance.twr.cumulative)}
          detail={`${performance.twr.periods} fechamentos · ${performance.twr.spanDays} dias`}
          icon={performance.twr.cumulative >= 0 ? TrendingUp : TrendingDown}
          tone={performance.twr.cumulative >= 0 ? "emerald" : "red"}
        />
        <Kpi
          label="MWR / XIRR"
          value={performance.mwr === null ? "—" : pct(performance.mwr)}
          detail="Retorno do investidor (com fluxos)"
          icon={TrendingUp}
          tone="blue"
        />
        <Kpi
          label={`Excesso vs ${performance.benchmark.name}`}
          value={`${performance.benchmark.excess >= 0 ? "+" : ""}${pct(performance.benchmark.excess)}`}
          detail={`CDI ${pct(performance.benchmark.periodReturn)} no período`}
          icon={performance.benchmark.excess >= 0 ? ArrowUpRight : ArrowDownRight}
          tone={performance.benchmark.excess >= 0 ? "emerald" : "orange"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setTab(entry.id)}
            className={cn(
              "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
              tab === entry.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
            )}
          >
            <entry.icon className="h-3.5 w-3.5" />
            {entry.label}
            {entry.id === "qualidade" && quality.findings.length > 0 && (
              <span className="ml-1 px-1.5 rounded-full bg-red-500/20 text-red-400 text-[9px]">
                {quality.findings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "visao" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6">
          <div className="xl:col-span-2 glass-card rounded-[2rem] p-5 lg:p-7 space-y-5">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Alocação por classe
            </h3>
            <div className="space-y-3">
              {allocation.byClass.map((bucket) => (
                <div key={bucket.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold">
                      {bucket.label}{" "}
                      <span className="text-muted-foreground/60 font-normal">({bucket.count})</span>
                    </span>
                    <span className="tabular-nums font-black">
                      {brl(bucket.value)} <span className="text-muted-foreground/60 font-bold">{pct(bucket.percentage)}</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary"
                      style={{ width: `${Math.min(100, bucket.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
              {allocation.byClass.length === 0 && (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhuma posição lançada — comece por “Nova posição”.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
              <MiniMetric
                icon={Droplets}
                label="Líquido em D+1"
                value={pct(allocation.liquidPercentage)}
                hint="Disponível se precisar amanhã"
              />
              <MiniMetric
                icon={Globe2}
                label="Offshore"
                value={pct(allocation.offshorePercentage)}
                hint="Exposição fora do Brasil"
              />
            </div>
          </div>

          <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Concentração & liquidez
            </h3>
            <div className="space-y-3">
              <Row label="Índice HHI (0 = pulverizado)" value={allocation.concentration.toFixed(3)} />
              <Row
                label="Maior posição"
                value={
                  allocation.top[0]
                    ? `${allocation.top[0].name} · ${pct(allocation.top[0].percentage)}`
                    : "—"
                }
              />
              {allocation.byLiquidity.map((bucket) => (
                <Row
                  key={bucket.key}
                  label={LIQUIDITY_LABELS[bucket.key] ?? bucket.key}
                  value={`${pct(bucket.percentage)} · ${brl(bucket.value)}`}
                />
              ))}
            </div>
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                Top 5 posições
              </p>
              {allocation.top.map((position) => (
                <div key={position.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-bold">{position.name}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">{pct(position.percentage)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "posicoes" && (
        <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest">
              {filtered.length} posição(ões)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => syncQuotes.mutate({ entity_id: (entities ?? [])[0]?.id })}
                disabled={syncQuotes.isPending}
                title="Busca o preço de mercado das posições com símbolo (PETR4, HGLG11, USD/BRL) e atualiza data e preço"
                className="h-9 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", syncQuotes.isPending && "animate-spin")} />
                Atualizar cotações
              </button>
              <button
                onClick={() => rebuild.mutate((entities ?? [])[0]?.id ?? "")}
                disabled={rebuild.isPending || !entities?.length}
                className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", rebuild.isPending && "animate-spin")} />
                Reconstruir série de fechamentos
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white/[0.02]">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <th className="px-4 py-3">Posição</th>
                  <th className="px-4 py-3">Classe</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Preço</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">Ganho</th>
                  <th className="px-4 py-3">Custódia</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((position) => {
                  const value = positionValue(position);
                  const gain = value - Number(position.cost_basis ?? 0);
                  return (
                    <tr key={position.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold">{position.name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1.5">
                          {position.symbol ?? "—"} · {position.as_of}
                          {(() => {
                            const freshness = classifyFreshness(
                              position.as_of,
                              Number(position.unit_price ?? 0),
                            );
                            if (freshness === "sem-preco") {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 not-italic">
                                  sem preço
                                </span>
                              );
                            }
                            if (freshness === "defasado") {
                              return (
                                <span
                                  title={`Preço com mais de ${STALE_DAYS} dias`}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 not-italic"
                                >
                                  defasado
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest">
                          {ASSET_CLASS_LABELS[position.asset_class] ?? position.asset_class}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums">
                        {Number(position.quantity).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] tabular-nums">
                        {Number(position.unit_price).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black tabular-nums">{brl(value)}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right text-[11px] font-bold tabular-nums",
                          gain >= 0 ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {gain >= 0 ? "+" : ""}
                        {brl(gain)}
                      </td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground">
                        {(position.accounts as { name?: string } | null)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Remover "${position.name}"?`)) removePosition.mutate({ id: position.id });
                          }}
                          className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-red-400 transition-colors inline-flex items-center justify-center"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="p-10 text-center text-xs text-muted-foreground">
                Nenhuma posição neste filtro. Lance a primeira em “Nova posição” ou popule a demonstração.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "conciliacao" && (
        <ReconciliationPanel
          transactions={transactions ?? []}
          flows={flows ?? []}
          entities={entities ?? []}
          entityFilter={entityFilter}
        />
      )}

      {tab === "politica" && (
        <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Drift vs política-alvo
            </h3>
            <span
              className={cn(
                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                breaches === 0
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-orange-500/10 text-orange-500 border-orange-500/20",
              )}
            >
              {breaches === 0 ? "Dentro das bandas" : `${breaches} classe(s) fora da banda (±5 p.p.)`}
            </span>
          </div>
          <div className="space-y-3">
            {drift.map((row) => (
              <div key={row.key} className="grid grid-cols-12 items-center gap-3">
                <span className="col-span-3 text-[11px] font-bold truncate">{row.label}</span>
                <div className="col-span-6 relative h-6">
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                    <div className="h-1.5 w-full rounded-full bg-white/5 relative">
                      <div
                        className={cn(
                          "absolute top-0 h-1.5 rounded-full",
                          row.drift >= 0 ? "bg-primary" : "bg-orange-500",
                        )}
                        style={{
                          left: `${Math.min(row.actual, row.target)}%`,
                          width: `${Math.abs(row.drift)}%`,
                        }}
                      />
                      <div
                        className="absolute -top-1 h-3.5 w-0.5 bg-white/60"
                        style={{ left: `${row.target}%` }}
                        title={`Alvo ${row.target}%`}
                      />
                    </div>
                  </div>
                </div>
                <span className="col-span-3 text-right text-[10px] tabular-nums">
                  <span className="font-black">{pct(row.actual)}</span>
                  <span className="text-muted-foreground/60"> / {pct(row.target)}</span>{" "}
                  <span
                    className={cn(
                      "font-black",
                      row.breach ? (row.drift > 0 ? "text-orange-500" : "text-blue-400") : "text-muted-foreground/60",
                    )}
                  >
                    {row.drift >= 0 ? "+" : ""}
                    {row.drift.toFixed(1)}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-2 border-t border-white/5">
            Banda de tolerância de ±5 p.p. A barra mostra a diferença entre a posição atual e o alvo; o traço branco é o
            alvo. Ação sugerida: {drift.filter((r) => r.action !== "manter").map((r) => `${r.action} ${r.label}`).join(", ") || "nenhuma"}.
          </p>
        </div>
      )}

      {tab === "qualidade" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="glass-card rounded-[2rem] p-6 flex flex-col items-center justify-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Score de dados</p>
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-white/5" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(quality.score / 100) * 264} 264`}
                  className={
                    quality.score >= 75 ? "text-emerald-500" : quality.score >= 50 ? "text-orange-500" : "text-red-500"
                  }
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black tabular-nums">{quality.score}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  nota {quality.grade}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              {quality.findings.length === 0
                ? "Nenhum achado: base consistente."
                : `${quality.findings.length} achado(s) acionável(is).`}
            </p>
          </div>

          <div className="lg:col-span-2 glass-card rounded-[2rem] divide-y divide-white/5 overflow-hidden">
            {quality.findings.map((finding) => (
              <div key={finding.id} className="p-4 flex items-start gap-3">
                <div
                  className={cn(
                    "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 text-[10px] font-black",
                    finding.severity === "critical"
                      ? "bg-red-500/10 border-red-500/20 text-red-500"
                      : finding.severity === "high"
                        ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                        : finding.severity === "medium"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          : "bg-white/5 border-white/10 text-muted-foreground",
                  )}
                >
                  -{finding.weight}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold">{finding.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{finding.detail}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 shrink-0">
                  {finding.category}
                </span>
              </div>
            ))}
            {quality.findings.length === 0 && (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold">Base consistente</p>
                <p className="text-xs text-muted-foreground">
                  Nenhuma posição sem preço, preço velho, documento vencido ou duplicidade detectada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <PositionForm open={positionOpen} onClose={() => setPositionOpen(false)} />
      <CashFlowForm open={flowOpen} onClose={() => setFlowOpen(false)} />
    </div>
  );
}

function Kpi({ label, value, detail, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  };
  return (
    <div className="glass-card p-4 lg:p-5 rounded-2xl space-y-3">
      <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center", tones[tone] ?? tones.primary)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
        <p className="text-xl lg:text-2xl font-black tabular-nums mt-0.5">{value}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function MiniMetric({ icon: Icon, label, value, hint }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
        <p className="text-lg font-black tabular-nums">{value}</p>
        <p className="text-[9px] text-muted-foreground/50">{hint}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums truncate">{value}</span>
    </div>
  );
}
