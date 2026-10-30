import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, Loader2, Calendar, FileWarning, Check, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRisks, useDocuments } from "@/hooks/usePatrimonio";
import { useResolveRisk } from "@/hooks/useCrud";

export const Route = createFileRoute("/_app/jarvis/alertas")({
  component: JarvisAlertas,
});

const SEVERITY_META: Record<string, { label: string; className: string; weight: number }> = {
  critical: { label: "Crítico", className: "bg-red-500/10 text-red-500 border-red-500/20", weight: 0 },
  high: { label: "Alto", className: "bg-orange-500/10 text-orange-500 border-orange-500/20", weight: 1 },
  medium: { label: "Médio", className: "bg-blue-500/10 text-blue-400 border-blue-500/20", weight: 2 },
  low: { label: "Baixo", className: "bg-white/5 text-muted-foreground border-white/10", weight: 3 },
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`).getTime();
  if (Number.isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86_400_000);
}

function JarvisAlertas() {
  const { data: risks, isLoading: risksLoading } = useRisks();
  const { data: documents, isLoading: docsLoading } = useDocuments();
  const resolveRisk = useResolveRisk();

  const alerts = useMemo(() => {
    const riskAlerts = (risks ?? [])
      .filter((r) => r.status !== "resolved" && r.status !== "ignored")
      .map((r) => {
        const days = daysUntil(r.due_date);
        return {
          id: r.id,
          kind: "risco" as const,
          title: r.title,
          detail: r.description ?? "",
          severity: (r.severity ?? "medium") as string,
          days,
          target: (r.entities as { name?: string } | null)?.name ?? (r.assets as { name?: string } | null)?.name ?? null,
        };
      });

    const docAlerts = (documents ?? [])
      .map((d) => {
        const days = daysUntil(d.expiry_date);
        if (days === null || days > 60) return null;
        return {
          id: d.id,
          kind: "documento" as const,
          title: d.title,
          detail: `${d.type ?? "Documento"}${(d.assets as { name?: string } | null)?.name ? ` · ${(d.assets as { name?: string } | null)?.name}` : ""}`,
          severity: days < 0 ? "critical" : days <= 15 ? "high" : days <= 30 ? "medium" : "low",
          days,
          target: (d.entities as { name?: string } | null)?.name ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return [...riskAlerts, ...docAlerts].sort((a, b) => {
      const bySeverity = (SEVERITY_META[a.severity]?.weight ?? 9) - (SEVERITY_META[b.severity]?.weight ?? 9);
      if (bySeverity !== 0) return bySeverity;
      return (a.days ?? 999) - (b.days ?? 999);
    });
  }, [risks, documents]);

  if (risksLoading || docsLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const counters = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    overdue: alerts.filter((a) => (a.days ?? 0) < 0).length,
    week: alerts.filter((a) => (a.days ?? 999) >= 0 && (a.days ?? 999) <= 7).length,
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">Monitoramento ativo</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter uppercase italic flex items-center gap-4">
            <ShieldAlert className="h-8 w-8 text-orange-500" />
            Alertas
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Consolidado de riscos abertos e documentos na janela de vencimento (60 dias), ordenado por severidade e prazo.
          </p>
        </div>
        <div className="flex gap-3">
          <Counter label="Críticos" value={counters.critical} tone="text-red-500" />
          <Counter label="Vencidos" value={counters.overdue} tone="text-orange-500" />
          <Counter label="Próx. 7 dias" value={counters.week} tone="text-primary" />
        </div>
      </div>

      <div className="glass-card rounded-[2rem] divide-y divide-white/5 overflow-hidden border-white/5">
        {alerts.map((alert) => {
          const meta = SEVERITY_META[alert.severity] ?? SEVERITY_META.medium;
          return (
            <div key={`${alert.kind}-${alert.id}`} className="p-5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
              <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center shrink-0", meta.className)}>
                {alert.kind === "risco" ? <ShieldAlert className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border", meta.className)}>
                    {meta.label}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    {alert.kind}
                  </span>
                  <h3 className="text-sm font-bold">{alert.title}</h3>
                </div>
                {alert.detail && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{alert.detail}</p>}
                {alert.target && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-widest font-bold">{alert.target}</p>
                )}
              </div>
              <div className="text-right shrink-0 space-y-2">
                <p
                  className={cn(
                    "text-xs font-black tabular-nums",
                    (alert.days ?? 0) < 0 ? "text-red-500" : (alert.days ?? 999) <= 7 ? "text-orange-500" : "text-foreground",
                  )}
                >
                  {alert.days === null
                    ? "Sem prazo"
                    : alert.days < 0
                      ? `Vencido há ${Math.abs(alert.days)}d`
                      : `${alert.days}d`}
                </p>
                {alert.kind === "risco" && (
                  <button
                    onClick={() => resolveRisk.mutate({ id: alert.id })}
                    disabled={resolveRisk.isPending}
                    title="Marcar risco como resolvido"
                    className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                  >
                    <Check className="h-3 w-3" /> Resolver
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="p-12 text-center space-y-3">
            <Check className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
            <p className="text-sm font-bold">Nenhum alerta ativo</p>
            <p className="text-xs text-muted-foreground">
              Sem riscos abertos e nenhum documento vencendo nos próximos 60 dias.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/riscos"
          className="flex-1 glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">Central de Riscos</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
        <Link
          to="/jarvis/chat"
          className="flex-1 glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">Pedir plano de ação ao JARVIS</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
      </div>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[92px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-lg font-black tabular-nums", tone)}>{value}</p>
    </div>
  );
}
