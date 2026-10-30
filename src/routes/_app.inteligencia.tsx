import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  BrainCircuit,
  ShieldCheck,
  Zap,
  ArrowRight,
  ChevronRight,
  LineChart,
  PieChart as PieIcon,
  Loader2,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisHealth, useJarvisInsights } from "@/hooks/useJarvis";
import { useAssets, useRisks } from "@/hooks/usePatrimonio";
import { useResolveInsight } from "@/hooks/useCrud";

export const Route = createFileRoute("/_app/inteligencia")({
  component: InteligenciaIA,
});

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "border-red-500/20 bg-red-500/10 text-red-400" },
  high: { label: "Alto", className: "border-orange-500/20 bg-orange-500/10 text-orange-400" },
  medium: { label: "Médio", className: "border-primary/20 bg-primary/10 text-primary" },
  low: { label: "Baixo", className: "border-white/10 bg-white/5 text-muted-foreground" },
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function InteligenciaIA() {
  const { data: insights, isLoading: insightsLoading } = useJarvisInsights();
  const { data: health } = useJarvisHealth();
  const { data: risks } = useRisks();
  const { data: assets } = useAssets();
  const resolveInsight = useResolveInsight();

  const open = useMemo(() => (insights ?? []).filter((i) => !i.is_resolved), [insights]);

  const series = useMemo(() => {
    const rows = health ?? [];
    return rows.slice(-7).map((row, index) => ({
      label: new Date(row.recorded_at ?? Date.now()).toLocaleDateString("pt-BR", { month: "short" }),
      value: Number(row.global_score ?? 0),
      index,
    }));
  }, [health]);

  const riskAllocation = useMemo(() => {
    const list = risks ?? [];
    if (list.length === 0) return { low: 0, medium: 0, high: 0, critical: 0, total: 0, score: 0 };
    const count = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const risk of list) {
      const key = (risk.severity ?? "medium") as keyof typeof count;
      if (key in count) count[key] += 1;
    }
    const total = list.length;
    const score =
      100 -
      (count.medium * 0.15 * 100 + count.high * 0.35 * 100 + count.critical * 0.6 * 100) / total;
    return {
      ...Object.fromEntries(Object.entries(count).map(([k, v]) => [k, Math.round((v / total) * 100)])),
      total,
      score: Math.max(0, Math.round(score * 10) / 10),
    } as { low: number; medium: number; high: number; critical: number; total: number; score: number };
  }, [risks]);

  const insightsWithImpact = useMemo(() => {
    const assetValue = (assets ?? []).reduce((sum, a) => sum + Number(a.value ?? 0), 0);
    return open.map((insight) => {
      const metadata = (insight.metadata ?? {}) as Record<string, unknown>;
      const impact = metadata.impact ?? metadata.impact_estimate;
      return {
        ...insight,
        impactLabel:
          typeof impact === "number"
            ? `${brl(impact)} / ano`
            : typeof impact === "string" && impact.length > 0
              ? impact
              : assetValue > 0
                ? `base ${brl(assetValue)}`
                : "sem impacto estimado",
      };
    });
  }, [open, assets]);

  const trend = useMemo(() => {
    if (series.length < 2) return null;
    const first = series[0].value;
    const last = series[series.length - 1].value;
    if (!first) return null;
    return Math.round(((last - first) / first) * 1000) / 10;
  }, [series]);

  if (insightsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 fill-primary/20" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Sala de guerra IA</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">Inteligência Estratégica</h2>
          <p className="text-muted-foreground text-sm lg:text-base max-w-2xl">
            Insights abertos, série histórica de saúde patrimonial e alocação de risco do seu tenant.
          </p>
        </div>
        <Link
          to="/jarvis/chat"
          className="h-12 px-6 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-bold text-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
        >
          <MessageSquare className="h-4 w-4" /> Perguntar ao JARVIS
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 lg:gap-8">
        <div className="xl:col-span-3 space-y-6 lg:space-y-8">
          <div className="glass-card rounded-[2rem] p-6 lg:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Sparkles className="h-40 w-40 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-500" />
              Insights de alta prioridade
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {open.length} aberto(s)
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {insightsWithImpact.map((insight) => {
                const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.medium;
                return (
                  <div
                    key={insight.id}
                    className="p-5 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                          meta.className,
                        )}
                      >
                        {insight.type} · {meta.label}
                      </span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest truncate">
                        {insight.impactLabel}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base leading-snug">{insight.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">
                        {insight.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {new Date(insight.created_at).toLocaleDateString("pt-BR")}
                      </p>
                      <button
                        onClick={() => resolveInsight.mutate({ id: insight.id })}
                        disabled={resolveInsight.isPending}
                        className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        Marcar tratado
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {open.length === 0 && (
                <div className="md:col-span-2 p-10 text-center space-y-2">
                  <CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto opacity-70" />
                  <p className="text-sm font-bold">Nenhum insight aberto</p>
                  <p className="text-xs text-muted-foreground">
                    Todos os apontamentos do JARVIS foram tratados. Novos insights aparecem aqui conforme os dados mudam.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <div className="glass-card rounded-[2rem] p-6 lg:p-8 space-y-5">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" /> Saúde patrimonial
              </h3>
              {series.length > 0 ? (
                <>
                  <div className="h-40 flex items-end gap-2 px-1">
                    {series.map((point) => (
                      <div key={point.index} className="flex-1 flex flex-col items-center gap-2 group">
                        <span className="text-[9px] font-black tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                          {point.value.toFixed(1)}
                        </span>
                        <div
                          className="w-full bg-primary/25 rounded-t-lg group-hover:bg-primary/50 transition-all"
                          style={{ height: `${Math.max(4, Math.min(100, point.value))}%` }}
                        />
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{point.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                    {trend === null
                      ? "Série insuficiente para calcular tendência."
                      : trend >= 0
                        ? `Variação de +${trend}% no período registrado.`
                        : `Variação de ${trend}% no período registrado.`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Sem histórico de health score — o dataset de demonstração inclui a série.
                </p>
              )}
            </div>

            <div className="glass-card rounded-[2rem] p-6 lg:p-8 space-y-5">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" /> Alocação por risco
              </h3>
              {riskAllocation.total > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-5">
                    <div className="h-28 w-28 rounded-full border-[10px] border-primary/10 border-t-primary border-r-orange-500/50 border-b-red-500/50 flex items-center justify-center shrink-0">
                      <span className="text-base font-black tracking-tighter tabular-nums">{riskAllocation.score}</span>
                    </div>
                    <div className="flex-1 space-y-2.5">
                      <RiskLegend label="Baixo" color="bg-primary" perc={`${riskAllocation.low}%`} />
                      <RiskLegend label="Médio" color="bg-emerald-500" perc={`${riskAllocation.medium}%`} />
                      <RiskLegend label="Alto" color="bg-orange-500" perc={`${riskAllocation.high}%`} />
                      <RiskLegend label="Crítico" color="bg-red-500" perc={`${riskAllocation.critical}%`} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {riskAllocation.total} risco(s) registrados · score ponderado por severidade
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  Nenhum risco registrado para calcular a alocação.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1 space-y-6">
          <div className="glass-card rounded-[2rem] p-6 lg:p-8 flex flex-col border-primary/10 h-full min-h-[420px]">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">JARVIS</h4>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                  Analista do seu tenant
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p className="p-4 rounded-2xl bg-white/5 border border-white/10">
                {open.length > 0
                  ? `Há ${open.length} insight(s) aberto(s), sendo ${
                      open.filter((i) => i.severity === "critical" || i.severity === "high").length
                    } de severidade alta ou crítica.`
                  : "Nenhum insight aberto no momento."}{" "}
                {riskAllocation.total > 0
                  ? `A carteira carrega ${riskAllocation.total} risco(s) ativos (${riskAllocation.critical}% críticos).`
                  : "Nenhum risco cadastrado."}
              </p>
              <p className="p-4 rounded-2xl bg-white/5 border border-white/10">
                O JARVIS responde em linguagem natural com os números reais do seu portfólio e cita a fonte de cada
                afirmação.
              </p>
            </div>

            <Link
              to="/jarvis/chat"
              className="mt-6 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            >
              Abrir o chat
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/jarvis/alertas"
              className="mt-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="h-3 w-3" /> Ver alertas consolidados
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskLegend({ label, color, perc }: { label: string; color: string; perc: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      </div>
      <span className="text-[11px] font-black tabular-nums">{perc}</span>
    </div>
  );
}
