import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Landmark,
  Search,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarDays,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/hooks/usePatrimonio";
import { useUpdateDocument } from "@/hooks/useCrud";
import { DocumentForm } from "@/components/forms/DocumentForm";

export const Route = createFileRoute("/_app/regularizacao")({
  component: Regularizacao,
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  regular: { label: "Regular", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  pendente: { label: "Pendente", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  alerta: { label: "Alerta", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  critico: { label: "Crítico", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const STATUS_OPTIONS = ["regular", "pendente", "alerta", "critico"] as const;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`).getTime();
  if (Number.isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86_400_000);
}

function Regularizacao() {
  const { data: documents, isLoading } = useDocuments();
  const update = useUpdateDocument();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [formOpen, setFormOpen] = useState(false);

  const stats = useMemo(() => {
    const list = documents ?? [];
    const overdue = list.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days < 0;
    });
    const soon = list.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    });
    return {
      total: list.length,
      regular: list.filter((d) => d.status === "regular").length,
      overdue: overdue.length,
      soon: soon.length,
      compliance: list.length
        ? Math.round((list.filter((d) => d.status === "regular").length / list.length) * 100)
        : 0,
    };
  }, [documents]);

  const visible = useMemo(() => {
    const term = query.toLowerCase();
    return (documents ?? []).filter((d) => {
      const matchesStatus = statusFilter === "todos" || d.status === statusFilter;
      const matchesTerm =
        !term ||
        `${d.title} ${d.type ?? ""} ${(d.entities as { name?: string } | null)?.name ?? ""} ${(d.assets as { name?: string } | null)?.name ?? ""}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [documents, query, statusFilter]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Regularização</h2>
          <p className="text-muted-foreground mt-2 text-sm lg:text-base">
            Cofre documental: matrículas, averbações, licenças e prazos — atualizados no banco.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <FileText className="h-4 w-4" /> Arquivar documento
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <Metric label="Documentos" value={String(stats.total)} detail="No acervo" icon={FileText} tone="primary" />
        <Metric label="Regulares" value={String(stats.regular)} detail={`${stats.compliance}% de conformidade`} icon={CheckCircle2} tone="emerald" />
        <Metric label="Vencidos" value={String(stats.overdue)} detail="Ação imediata" icon={AlertTriangle} tone="red" />
        <Metric label="Vencem em 30d" value={String(stats.soon)} detail="Renovação preventiva" icon={Clock} tone="blue" />
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
        <div className="p-5 lg:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar documento, tipo, entidade…"
              className="w-full bg-background border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {["todos", ...STATUS_OPTIONS].map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  statusFilter === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
                )}
              >
                {value === "todos" ? "Todos" : STATUS_META[value].label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {visible.map((doc) => {
            const meta = STATUS_META[doc.status ?? "pendente"] ?? STATUS_META.pendente;
            const days = daysUntil(doc.expiry_date);
            return (
              <div key={doc.id} className="p-5 lg:p-6 hover:bg-white/[0.02] transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", meta.className)}>
                        {meta.label}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {doc.type ?? "Documento"}
                      </span>
                    </div>
                    <h3 className="text-base font-bold leading-tight truncate">{doc.title}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold truncate">
                      {(doc.entities as { name?: string } | null)?.name ?? "Sem entidade"}
                      {(doc.assets as { name?: string } | null)?.name
                        ? ` · ${(doc.assets as { name?: string } | null)?.name}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 lg:gap-4 flex-wrap">
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Vencimento</p>
                      <p className="text-sm font-black tabular-nums flex items-center gap-1.5 justify-end">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        {doc.expiry_date ? new Date(`${doc.expiry_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}
                      </p>
                      {days !== null && (
                        <p
                          className={cn(
                            "text-[9px] font-bold",
                            days < 0 ? "text-red-500" : days <= 30 ? "text-orange-500" : "text-muted-foreground/60",
                          )}
                        >
                          {days < 0 ? `vencido há ${Math.abs(days)}d` : `em ${days}d`}
                        </p>
                      )}
                    </div>
                    <select
                      value={doc.status ?? "pendente"}
                      onChange={(e) =>
                        update.mutate({ id: doc.id, status: e.target.value as (typeof STATUS_OPTIONS)[number] })
                      }
                      className="bg-background border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-1 focus:ring-primary/50"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {STATUS_META[option].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <Landmark className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-bold">Nenhum documento neste filtro</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Arquive matrículas, licenças e averbações para acompanhar prazos e conformidade.
              </p>
              <button
                onClick={() => setFormOpen(true)}
                className="mt-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest"
              >
                Arquivar primeiro documento
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/jarvis/alertas"
          className="flex-1 glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="text-xs font-black uppercase tracking-widest">Alertas de vencimento</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
        <Link
          to="/jarvis/chat"
          className="flex-1 glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-primary/30 transition-all group"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest">Análise documental com JARVIS</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      <DocumentForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };
  return (
    <div className="glass-card p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] space-y-3">
      <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center", tones[tone] ?? tones.primary)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
        <p className="text-2xl lg:text-3xl font-black tabular-nums mt-1">{value}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{detail}</p>
      </div>
    </div>
  );
}
