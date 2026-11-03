import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Coins, Globe2, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccounts, useEntities, usePositions, useQuotes } from "@/hooks/usePatrimonio";
import {
  computeAttribution,
  currencyBreakdown,
  type AttributionPosition,
  type AttributionBucket,
} from "@/lib/wealth/attribution";

export const Route = createFileRoute("/_app/atribuicao")({
  component: Atribuicao,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits).replace(".", ",")}%`;
const plainPct = (value: number, digits = 2) => `${value.toFixed(digits).replace(".", ",")}%`;

const PERIODS = [
  { id: "ytd", label: "No ano" },
  { id: "12m", label: "12 meses" },
  { id: "6m", label: "6 meses" },
  { id: "3m", label: "3 meses" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

function periodStart(id: PeriodId, end = new Date()): string {
  const date = new Date(end);
  if (id === "ytd") return `${end.getUTCFullYear()}-01-01`;
  const months = id === "12m" ? 12 : id === "6m" ? 6 : 3;
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

function Atribuicao() {
  const { data: positions } = usePositions();
  const { data: accounts } = useAccounts();
  const { data: entities } = useEntities();
  const { data: quotes, error: quotesError } = useQuotes();

  const [period, setPeriod] = useState<PeriodId>("ytd");
  const [entityFilter, setEntityFilter] = useState("todas");

  const custodianByAccount = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts ?? []) {
      // `custodians` vem como relação aninhada do select; o tipo gerado pode não
      // conhecer a FK, então lemos de forma defensiva.
      const nested = (account as { custodians?: { name?: string } | null }).custodians;
      map.set(account.id, nested?.name ?? account.name ?? "Sem custodiante");
    }
    return map;
  }, [accounts]);

  const attribution = useMemo(() => {
    const filtered = (positions ?? []).filter(
      (position) => entityFilter === "todas" || position.entity_id === entityFilter,
    );
    const rows: AttributionPosition[] = filtered.map((position) => ({
      id: position.id,
      name: position.name,
      symbol: position.symbol,
      instrument_id: (position as { instrument_id?: string | null }).instrument_id ?? null,
      asset_class: position.asset_class,
      currency: position.currency,
      quantity: position.quantity,
      unit_price: position.unit_price,
      cost_basis: position.cost_basis,
      as_of: position.as_of,
      account_id: position.account_id,
      custodian: position.account_id ? custodianByAccount.get(position.account_id) ?? null : null,
    }));
    return computeAttribution({
      positions: rows,
      quotes: (quotes ?? []).map((quote) => ({
        symbol: quote.symbol,
        asOf: quote.as_of,
        price: Number(quote.price),
      })),
      periodStart: periodStart(period),
      periodEnd: new Date().toISOString().slice(0, 10),
    });
  }, [positions, quotes, period, entityFilter, custodianByAccount]);

  const currencies = currencyBreakdown(attribution);
  const hasPositions = attribution.positions.length > 0;

  const chartData = attribution.byClass.map((item) => ({
    name: item.label,
    contribution: Number(item.contribution.toFixed(2)),
    retorno: Number(item.returnPct.toFixed(2)),
    peso: Number(item.weight.toFixed(1)),
  }));

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Análise de retorno
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Atribuição de performance
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            O TWR diz que a carteira rendeu. Esta tela diz <strong>de onde veio</strong>: contribuição
            por classe, por custodiante e por moeda — com a cobertura de dados explícita, porque
            atribuição com metade da carteira precificada é ruído.
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
          {PERIODS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={cn(
                "h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all",
                period === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {quotesError ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Sem série de cotações (migration <code>20261030170000_quotes.sql</code> ou nenhuma
          sincronização feita). Os retornos abaixo são acumulados desde o custo de aquisição.
        </div>
      ) : null}

      {!hasPositions ? (
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <PieChart className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-bold">Sem posições para atribuir</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Cadastre posições em Custódia e rode <em>Atualizar cotações</em> por alguns dias — só a
            série de preços permite separar o que é retorno de mercado do que é aporte.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Retorno do período",
                value: pct(attribution.totals.returnPct),
                hint: `${brl(attribution.totals.gain)} sobre ${brl(attribution.totals.value)}`,
                icon: attribution.totals.returnPct >= 0 ? ArrowUpRight : ArrowDownRight,
                tone: attribution.totals.returnPct >= 0 ? "text-emerald-500" : "text-red-500",
              },
              {
                label: "Cobertura de cotações",
                value: plainPct(attribution.totals.coverage, 0),
                hint: `${brl(attribution.totals.pricedValue)} com série · ${brl(attribution.totals.unpricedValue)} no custo`,
                icon: Coins,
                tone: attribution.totals.coverage >= 70 ? "text-emerald-500" : "text-amber-500",
              },
              {
                label: "Melhor contribuinte",
                value: attribution.best[0] ? pct(attribution.best[0].contribution) : "—",
                hint: attribution.best[0]?.name ?? "—",
                icon: ArrowUpRight,
                tone: "text-emerald-500",
              },
              {
                label: "Pior contribuinte",
                value: attribution.worst[0] ? pct(attribution.worst[0].contribution) : "—",
                hint: attribution.worst[0]?.name ?? "—",
                icon: ArrowDownRight,
                tone: "text-red-500",
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

          {attribution.warnings.length > 0 ? (
            <div className="space-y-2">
              {attribution.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
                </div>
              ))}
            </div>
          ) : null}

          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest">
                Contribuição por classe (p.p.)
              </h2>
              <span className="text-[10px] text-muted-foreground">
                a soma fecha com {pct(attribution.totals.returnPct)}
              </span>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value: number) => `${value}p.p.`}
                    width={54}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      [`${value}${name === "contribuicao" ? " p.p." : "%"}`, name === "contribution" ? "Contribuição" : "Retorno"]
                    }
                    contentStyle={{
                      backgroundColor: "oklch(0.1 0.015 250)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: "16px",
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine y={0} stroke="oklch(1 0 0 / 0.25)" />
                  <Bar dataKey="contribution" radius={[6, 6, 0, 0]}>
                    {chartData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={item.contribution >= 0 ? "#10b981" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <BucketTable
              title="Por custodiante / gestor"
              icon={PieChart}
              buckets={attribution.byCustodian}
            />
            <BucketTable
              title="Por moeda"
              icon={Globe2}
              buckets={attribution.byCurrency}
              extra={currencies.map((item) =>
                item.fxReturnPct === null
                  ? null
                  : `local ${pct(item.localReturnPct ?? 0)} · câmbio ${pct(item.fxReturnPct)}`,
              )}
            />
          </div>

          <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest">
                Posição a posição
              </h2>
              <span className="text-[10px] text-muted-foreground">
                contribuição = peso × retorno
              </span>
            </div>
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[oklch(0.13_0.02_250)]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    <th className="px-4 py-2">Posição</th>
                    <th className="px-4 py-2">Classe</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Peso</th>
                    <th className="px-4 py-2 text-right">Retorno</th>
                    <th className="px-4 py-2 text-right">Contribuição</th>
                    <th className="px-4 py-2">Fonte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {attribution.positions.map((row) => (
                    <tr key={row.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <p className="text-[11px] font-bold">{row.name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">
                          {row.symbol ?? "—"} · {row.custodian}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-[10px] text-muted-foreground">
                        {attribution.byClass.find((bucket) => bucket.key === row.asset_class)?.label ??
                          row.asset_class}
                      </td>
                      <td className="px-4 py-2 text-right text-[11px] tabular-nums">{brl(row.value)}</td>
                      <td className="px-4 py-2 text-right text-[11px] tabular-nums text-muted-foreground">
                        {plainPct(row.weight, 1)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                          row.returnPct >= 0 ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {pct(row.returnPct)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                          row.contribution >= 0 ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {pct(row.contribution)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                            row.source === "cotacao"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : row.source === "custo"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border-white/10 bg-white/5 text-muted-foreground",
                          )}
                        >
                          {row.source === "cotacao" ? "cotação" : row.source === "custo" ? "custo" : "sem preço"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/60">
            Contribuição aritmética (peso × retorno), que fecha com o retorno da carteira — é a
            convenção que o operador confere na mão. Quando a posição não tem série de cotações no
            período, o retorno é o acumulado desde o custo de aquisição e vem marcado como{" "}
            <span className="font-mono">custo</span>; a cobertura acima mostra quanto do patrimônio
            está medido de verdade.
          </p>
        </>
      )}
    </div>
  );
}

function BucketTable({
  title,
  icon: Icon,
  buckets,
  extra,
}: {
  title: string;
  icon: typeof PieChart;
  buckets: AttributionBucket[];
  extra?: (string | null)[];
}) {
  return (
    <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
      <div className="flex items-center gap-2 border-b border-white/5 p-4">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-[10px] font-black uppercase tracking-widest">{title}</h2>
      </div>
      <table className="w-full text-left">
        <thead className="bg-white/[0.02]">
          <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
            <th className="px-4 py-2">Grupo</th>
            <th className="px-4 py-2 text-right">Peso</th>
            <th className="px-4 py-2 text-right">Retorno</th>
            <th className="px-4 py-2 text-right">Contribuição</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {buckets.map((bucket, index) => (
            <tr key={bucket.key} className="hover:bg-white/[0.02]">
              <td className="px-4 py-2">
                <p className="text-[11px] font-bold">{bucket.label}</p>
                <p className="text-[9px] text-muted-foreground/60">
                  {bucket.positions} posição(ões)
                  {extra?.[index] ? ` · ${extra[index]}` : ""}
                </p>
              </td>
              <td className="px-4 py-2 text-right text-[11px] tabular-nums text-muted-foreground">
                {plainPct(bucket.weight, 1)}
              </td>
              <td
                className={cn(
                  "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                  bucket.returnPct >= 0 ? "text-emerald-500" : "text-red-500",
                )}
              >
                {pct(bucket.returnPct)}
              </td>
              <td
                className={cn(
                  "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                  bucket.contribution >= 0 ? "text-emerald-500" : "text-red-500",
                )}
              >
                {pct(bucket.contribution)}
              </td>
            </tr>
          ))}
          {buckets.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-[11px] text-muted-foreground">
                Sem dados.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
