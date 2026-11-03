import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Activity,
  ArrowDownRight,
  Banknote,
  Droplets,
  Gauge,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssets, useLiabilities, usePositions } from "@/hooks/usePatrimonio";
import { computeRisk } from "@/lib/wealth/risk";

export const Route = createFileRoute("/_app/risco-mercado")({
  component: RiscoMercado,
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
const signedPct = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits).replace(".", ",")}%`;

const HORIZONS = [
  { days: 1, label: "1 dia" },
  { days: 21, label: "21 dias" },
  { days: 63, label: "3 meses" },
] as const;

function RiscoMercado() {
  const { data: positions } = usePositions();
  const { data: liabilities } = useLiabilities();
  const { data: assets } = useAssets();

  const [confidence, setConfidence] = useState<95 | 99>(95);
  const [horizonDays, setHorizonDays] = useState<number>(21);

  const risk = useMemo(
    () =>
      computeRisk({
        positions: (positions ?? []).map((position) => ({
          ...position,
          asset_class: position.asset_class,
          currency: position.currency,
        })),
        liabilities: (liabilities ?? []).map((liability) => ({
          ...liability,
          outstanding: Number(liability.outstanding ?? 0),
        })),
        registeredAssets: (assets ?? []).map((asset) => ({
          current_value: Number(asset.value ?? 0),
          asset_class: "imoveis",
        })),
        confidence,
        horizonDays,
      }),
    [positions, liabilities, assets, confidence, horizonDays],
  );

  const worst = risk.scenarios[0];
  const totalAssets = risk.assets.total;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Análise de risco
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Risco de mercado</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            VaR mede o dia ruim <strong>normal</strong>; o stress test mede o dia ruim que já aconteceu.
            Nos dois casos o impacto é lido no <strong>patrimônio líquido</strong> — com dívida, a queda
            do PL é maior que a queda do ativo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[95, 99].map((level) => (
            <button
              key={level}
              onClick={() => setConfidence(level as 95 | 99)}
              className={cn(
                "h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all",
                confidence === level
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              VaR {level}%
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-white/10" />
          {HORIZONS.map((horizon) => (
            <button
              key={horizon.days}
              onClick={() => setHorizonDays(horizon.days)}
              className={cn(
                "h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-widest transition-all",
                horizonDays === horizon.days
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              {horizon.label}
            </button>
          ))}
        </div>
      </header>

      {totalAssets === 0 ? (
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <Gauge className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-bold">Sem ativos para medir</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Cadastre posições em Custódia (e ativos registrais em Holdings) — VaR e stress dependem
            do tamanho e da composição da carteira.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: `VaR ${risk.var.confidence}% · ${risk.var.horizonDays} d`,
                value: compact(risk.var.amount),
                hint: `${pct(risk.var.percentage)} do ativo`,
                icon: ShieldAlert,
                tone: "text-foreground",
              },
              {
                label: "VaR sobre o PL",
                value: pct(risk.var.percentageOfEquity),
                hint: `σ anual da carteira ${pct(risk.var.portfolioVolatility)}`,
                icon: Activity,
                tone: risk.var.percentageOfEquity > 5 ? "text-amber-500" : "text-emerald-500",
              },
              {
                label: "Pior cenário",
                value: worst ? signedPct(worst.equityDrawdown) : "—",
                hint: worst?.label ?? "—",
                icon: ArrowDownRight,
                tone: "text-red-500",
              },
              {
                label: "PL depois do pior cenário",
                value: compact(worst?.equityAfter ?? 0),
                hint: `de ${compact(risk.equity)} hoje`,
                icon: Banknote,
                tone: (worst?.equityAfter ?? 0) < 0 ? "text-red-500" : "text-foreground",
              },
            ].map((card) => (
              <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <card.icon className="h-3 w-3" /> {card.label}
                </div>
                <p className={cn("mt-2 truncate text-xl font-black tabular-nums", card.tone)}>{card.value}</p>
                <p className="truncate text-[10px] text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>

          {risk.warnings.length > 0 ? (
            <div className="space-y-2">
              {risk.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
            <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest">Stress test</h2>
                <span className="text-[10px] text-muted-foreground">
                  impacto no PL, não no ativo
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Cenário</th>
                      <th className="px-4 py-2 text-right">Δ ativo</th>
                      <th className="px-4 py-2 text-right">Δ PL</th>
                      <th className="px-4 py-2 text-right">PL depois</th>
                      <th className="px-4 py-2 text-right">Alavancagem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {risk.scenarios.map((scenario) => (
                      <tr key={scenario.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <p className="text-[11px] font-bold">{scenario.label}</p>
                          <p className="max-w-[380px] text-[9px] text-muted-foreground/70">
                            {scenario.rationale}
                          </p>
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] tabular-nums text-muted-foreground">
                          {compact(scenario.assetDelta)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-2 text-right text-[11px] font-bold tabular-nums",
                            scenario.equityDrawdown < 0 ? "text-red-500" : "text-emerald-500",
                          )}
                        >
                          {signedPct(scenario.equityDrawdown)}
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] tabular-nums">
                          {compact(scenario.equityAfter)}
                        </td>
                        <td className="px-4 py-2 text-right text-[11px] tabular-nums text-muted-foreground">
                          {pct(scenario.leverageAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-4">
              <section className="glass-card rounded-[2rem] border border-white/5 p-4">
                <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest">
                  Quem carrega o risco
                </h2>
                <div className="space-y-2.5">
                  {risk.classes.map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold">{item.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {pct(item.weight)} do ativo ·{" "}
                          <span className="text-foreground">{pct(item.riskShare)} do risco</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            item.riskShare > item.weight * 1.5 ? "bg-red-500" : "bg-primary",
                          )}
                          style={{ width: `${Math.min(100, item.riskShare)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] text-muted-foreground/60">
                        vol. {pct(item.volatility)} a.a. · σ no horizonte {compact(item.standaloneRisk)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-card rounded-[2rem] border border-white/5 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <Droplets className="h-3 w-3" /> Dívida e liquidez
                </h2>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Juros +{pct(risk.debtShock.rateShockBps / 100)}</span>
                    <span className="font-bold tabular-nums">
                      +{brl(risk.debtShock.annualCostDelta)}/ano
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prestação depois</span>
                    <span className="font-bold tabular-nums">
                      {brl(risk.debtShock.monthlyServiceAfter)}/mês
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1.5">
                    <span className="text-muted-foreground">Liquidez D0/D1</span>
                    <span className="font-bold tabular-nums">{compact(risk.liquidity.liquid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meses de serviço cobertos</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        (risk.liquidity.cashBufferMonths ?? 99) < 6 ? "text-red-500" : "text-emerald-500",
                      )}
                    >
                      {risk.liquidity.cashBufferMonths === null
                        ? "sem dívida"
                        : `${risk.liquidity.cashBufferMonths.toString().replace(".", ",")} m`}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/60">
            VaR paramétrico normal (z = {risk.var.z}) com volatilidades e correlações declaradas em{" "}
            <code>src/lib/wealth/risk.ts</code> — quem discordar da premissa troca a tabela e o número
            muda. O VaR não modela cauda: os cenários de stress existem exatamente para isso. Choques
            incidem sobre posições com classe definida; ativo registral entra como imóvel.
          </p>
        </>
      )}
    </div>
  );
}
