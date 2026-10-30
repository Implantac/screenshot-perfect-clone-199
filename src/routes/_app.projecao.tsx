import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePositions, useCashFlows, useEntities } from "@/hooks/usePatrimonio";
import {
  projectCashFlow,
  type ForecastFlow,
  type ForecastPosition,
} from "@/lib/forecast";

export const Route = createFileRoute("/_app/projecao")({
  component: Projecao,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brlCents = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const dateBr = (iso: string) => {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

const HORIZONS = [12, 24, 36, 60] as const;

const KIND_LABELS: Record<string, string> = {
  aporte: "Aporte",
  resgate: "Resgate",
  provento: "Provento",
  taxa: "Taxa",
  imposto: "Imposto",
};

function Projecao() {
  const { data: positions, isLoading } = usePositions();
  const { data: flows } = useCashFlows();
  const { data: entities } = useEntities();

  const [horizon, setHorizon] = useState<number>(24);
  const [annualYield, setAnnualYield] = useState<number>(11);
  const [inflation, setInflation] = useState<number>(4.5);
  const [includeD30, setIncludeD30] = useState(false);
  const [adjustToInflation, setAdjustToInflation] = useState(true);
  const [entityFilter, setEntityFilter] = useState("todas");

  const filteredPositions = useMemo(
    () =>
      (positions ?? []).filter(
        (position) => entityFilter === "todas" || position.entity_id === entityFilter,
      ),
    [positions, entityFilter],
  );

  const filteredFlows = useMemo(
    () =>
      (flows ?? []).filter(
        (flow) => entityFilter === "todas" || flow.entity_id === entityFilter,
      ),
    [flows, entityFilter],
  );

  const result = useMemo(() => {
    const forecastPositions: ForecastPosition[] = filteredPositions.map((position) => ({
      asset_class: position.asset_class,
      liquidity: position.liquidity,
      quantity: Number(position.quantity ?? 0),
      unit_price: Number(position.unit_price ?? 0),
      currency: position.currency,
    }));
    const forecastFlows: ForecastFlow[] = filteredFlows.map((flow) => ({
      date: flow.flow_date,
      amount: Number(flow.amount ?? 0),
      kind: flow.kind,
      description: flow.description,
    }));
    return projectCashFlow(
      { positions: forecastPositions, flows: forecastFlows },
      { months: horizon, annualYield, inflation, adjustRecurringToInflation: adjustToInflation, includeD30 },
    );
  }, [filteredPositions, filteredFlows, horizon, annualYield, inflation, adjustToInflation, includeD30]);

  const { stats } = result;
  const hasData = filteredPositions.length > 0 || filteredFlows.length > 0;

  const alertLabel = {
    ok: "Liquidez confortável",
    atencao: "Atenção: caixa apertando",
    critico: "Crítico: caixa fica negativo no horizonte",
  }[result.alert];

  const alertTone = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    atencao: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    critico: "border-red-500/30 bg-red-500/10 text-red-400",
  }[result.alert];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Planejamento
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Projeção de caixa
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Quanto de caixa a família terá nos próximos meses, com o que já se repete nos lançamentos
            de custódia. Só posições líquidas pagam conta — imóvel e ativo ilíquido ficam no
            patrimônio, fora da projeção.
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
        </div>
      </header>

      {/* premissas */}
      <section className="glass-card space-y-4 rounded-[2rem] border border-white/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            Horizonte
          </span>
          {HORIZONS.map((months) => (
            <button
              key={months}
              onClick={() => setHorizon(months)}
              className={cn(
                "h-8 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-all",
                horizon === months
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              {months} meses
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              Rentabilidade do caixa (% a.a.)
            </span>
            <input
              type="number"
              step="0.1"
              value={annualYield}
              onChange={(event) => setAnnualYield(Number(event.target.value))}
              className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs tabular-nums"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              Inflação (% a.a.)
            </span>
            <input
              type="number"
              step="0.1"
              value={inflation}
              onChange={(event) => setInflation(Number(event.target.value))}
              className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-xs tabular-nums"
            />
          </label>
          <label className="flex items-center gap-2 pt-4 text-[10px] font-black uppercase tracking-widest">
            <input
              type="checkbox"
              checked={adjustToInflation}
              onChange={(event) => setAdjustToInflation(event.target.checked)}
              className="h-4 w-4 rounded border-white/20"
            />
            Reajustar recorrências
          </label>
          <label className="flex items-center gap-2 pt-4 text-[10px] font-black uppercase tracking-widest">
            <input
              type="checkbox"
              checked={includeD30}
              onChange={(event) => setIncludeD30(event.target.checked)}
              className="h-4 w-4 rounded border-white/20"
            />
            Incluir D+30
          </label>
        </div>
      </section>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center gap-2 rounded-[2rem] border border-white/5 p-10 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando posições…
        </div>
      ) : !hasData ? (
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <Wallet className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-bold">Sem caixa para projetar ainda</p>
          <p className="mx-auto mt-1 max-w-lg text-[11px] text-muted-foreground">
            Cadastre posições com liquidez D+0/D+1 em <span className="font-mono">Custódia</span> e
            lance aportes, resgates e proventos. A projeção nasce daí — sem recorrência detectada,
            ela mostra apenas o rendimento do saldo.
          </p>
        </div>
      ) : (
        <>
          {/* indicadores */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Caixa líquido hoje",
                value: brl(stats.startingLiquid),
                hint: includeD30 ? "D+0, D+1 e D+30" : "D+0 e D+1",
                icon: Wallet,
                tone: "text-foreground",
              },
              {
                label: `Caixa em ${horizon} meses`,
                value: brl(stats.endingLiquid),
                hint: `rendimento ${brl(stats.totalYield)} no período`,
                icon: stats.endingLiquid >= stats.startingLiquid ? TrendingUp : TrendingDown,
                tone: stats.endingLiquid >= stats.startingLiquid ? "text-emerald-500" : "text-red-500",
              },
              {
                label: "Pior saldo do horizonte",
                value: brl(stats.minLiquid),
                hint: stats.minLiquidMonth
                  ? `em ${stats.minLiquidMonth.slice(5)}/${stats.minLiquidMonth.slice(0, 4)}`
                  : "—",
                icon: AlertTriangle,
                tone: stats.minLiquid < 0 ? "text-red-500" : "text-amber-500",
              },
              {
                label: "Runway",
                value:
                  stats.runwayMonths === null
                    ? "sem queima"
                    : `${stats.runwayMonths} ${stats.runwayMonths === 1 ? "mês" : "meses"}`,
                hint: `fluxo médio ${brl(stats.netMonthlyAverage)}/mês`,
                icon: CalendarClock,
                tone: stats.runwayMonths === null ? "text-emerald-500" : "text-amber-500",
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

          <div className={cn("flex items-center gap-2 rounded-2xl border px-4 py-3 text-[11px] font-bold", alertTone)}>
            {result.alert === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {alertLabel}
            {stats.firstNegativeMonth
              ? ` — primeiro mês negativo: ${stats.firstNegativeMonth.slice(5)}/${stats.firstNegativeMonth.slice(0, 4)} (${stats.monthsNegative} mês/meses no vermelho)`
              : ` — menor saldo projetado: ${brl(stats.minLiquid)}`}
          </div>

          {/* gráfico */}
          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest">Saldo projetado</h2>
              <span className="text-[10px] text-muted-foreground">
                entradas {brl(stats.totalIn)} · saídas {brl(stats.totalOut)}
              </span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={result.series}>
                  <defs>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.04)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(result.series.length / 12) - 1)}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value: number) => `${(value / 1_000_000).toFixed(1)}M`}
                    width={48}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [brlCents(value), name === "closingBalance" ? "Saldo" : name]}
                    labelFormatter={(label: string) => `Mês ${label}`}
                    contentStyle={{
                      backgroundColor: "oklch(0.1 0.015 250)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: "16px",
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="closingBalance"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#forecastGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* recorrências + tabela */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Recorrências detectadas
                </h2>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {result.recurring.length} fluxo(s)
                </span>
              </div>
              {result.recurring.length === 0 ? (
                <p className="py-6 text-center text-[11px] text-muted-foreground">
                  Nenhum fluxo mensal recorrente. Lance ao menos 3 aportes/resgates com o mesmo
                  rótulo, em meses seguidos, para a projeção reconhecer o padrão.
                </p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {result.recurring.map((flow) => (
                    <li key={flow.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold">{flow.description}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">
                          {KIND_LABELS[flow.kind] ?? flow.kind} · {flow.occurrences}x · regularidade{" "}
                          {(flow.regularity * 100).toFixed(0)}%
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-bold tabular-nums",
                          flow.direction === "in" ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {flow.direction === "in" ? "+" : "−"} {brl(flow.monthlyAmount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
              <div className="border-b border-white/5 p-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Mês a mês
                </h2>
              </div>
              <div className="max-h-[340px] overflow-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[oklch(0.13_0.02_250)]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Mês</th>
                      <th className="px-4 py-2 text-right">Entradas</th>
                      <th className="px-4 py-2 text-right">Saídas</th>
                      <th className="px-4 py-2 text-right">Rendimento</th>
                      <th className="px-4 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {result.series.map((month) => (
                      <tr
                        key={month.month}
                        className={cn(
                          "hover:bg-white/[0.02]",
                          month.closingBalance < 0 && "bg-red-500/5",
                        )}
                      >
                        <td className="px-4 py-1.5 text-[11px] font-mono">{month.label}</td>
                        <td className="px-4 py-1.5 text-right text-[11px] tabular-nums text-emerald-500">
                          {month.inflow > 0 ? brl(month.inflow) : "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right text-[11px] tabular-nums text-red-500">
                          {month.outflow > 0 ? brl(month.outflow) : "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                          {brl(month.yield)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-1.5 text-right text-[11px] font-bold tabular-nums",
                            month.closingBalance < 0 ? "text-red-500" : "text-foreground",
                          )}
                        >
                          {brl(month.closingBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/60">
            Projeção determinística a partir do que já está lançado: recorrências com intervalo de 25
            a 35 dias e pelo menos 3 ocorrências. Não antecipa venda de ativo, capital call novo ou
            mudança de política — e não substitui fluxo de caixa contábil. Última data considerada:{" "}
            {filteredFlows.length > 0
              ? dateBr(
                  filteredFlows
                    .map((flow) => flow.flow_date)
                    .sort()
                    .at(-1) as string,
                )
              : "—"}
            .
          </p>
        </>
      )}
    </div>
  );
}
