import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Scale,
  Plus,
  Search,
  Gavel,
  Calendar,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLegalCases, isMissingTableError } from "@/hooks/usePatrimonio";
import { useDeleteLegalCase } from "@/hooks/useCrud";
import { LegalCaseForm, type LegalCaseRecord } from "@/components/forms/LegalCaseForm";

export const Route = createFileRoute("/_app/legal")({
  component: AssessoriaJuridica,
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  em_andamento: { label: "Em andamento", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  suspenso: { label: "Suspenso", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  acordo: { label: "Acordo", className: "bg-primary/10 text-primary border-primary/20" },
  encerrado: { label: "Encerrado", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
};

const RISK_META: Record<string, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "text-red-500" },
  high: { label: "Alto", className: "text-orange-500" },
  medium: { label: "Médio", className: "text-blue-400" },
  low: { label: "Baixo", className: "text-emerald-500" },
};

const TYPE_LABEL: Record<string, string> = {
  civel: "Cível",
  tributario: "Tributário",
  ambiental: "Ambiental",
  trabalhista: "Trabalhista",
  societario: "Societário",
  imobiliario: "Imobiliário",
};

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86_400_000);
}

function AssessoriaJuridica() {
  const { data: cases, isLoading, error } = useLegalCases();
  const remove = useDeleteLegalCase();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LegalCaseRecord | null>(null);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const stats = useMemo(() => {
    const list = cases ?? [];
    const active = list.filter((c) => c.status === "em_andamento" || c.status === "suspenso");
    return {
      total: list.length,
      active: active.length,
      exposure: active.reduce((sum, c) => sum + Number(c.value_at_stake ?? 0), 0),
      critical: active.filter((c) => c.risk_level === "critical").length,
      hearings: active.filter((c) => {
        const d = daysUntil(c.next_hearing);
        return d !== null && d >= 0 && d <= 30;
      }).length,
    };
  }, [cases]);

  const visible = useMemo(() => {
    const term = query.toLowerCase();
    return (cases ?? []).filter((c) => {
      const matchesTerm =
        !term ||
        `${c.title} ${c.case_number} ${c.court ?? ""} ${(c.entities as { name?: string } | null)?.name ?? ""}`
          .toLowerCase()
          .includes(term);
      const matchesStatus = !onlyActive || c.status === "em_andamento" || c.status === "suspenso";
      return matchesTerm && matchesStatus;
    });
  }, [cases, query, onlyActive]);

  // Durante o erro a tela precisa mostrar o aviso, não o spinner.
  if (isLoading && !error) {
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
          <h2 className="text-3xl font-black tracking-tight uppercase">Assessoria Jurídica</h2>
          <p className="text-muted-foreground mt-2 text-sm lg:text-base">
            Contencioso estratégico, exposição financeira e próximas audiências.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo processo
        </button>
      </div>

      {isMissingTableError(error) && (
        <div className="glass-card rounded-2xl p-4 border border-orange-500/25 bg-orange-500/[0.05] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold">Tabela de processos ainda não existe no banco</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplique a migration <span className="font-mono">20261030140000_operations_tables.sql</span> no SQL
              Editor do Supabase. Enquanto isso, a lista fica vazia e o cadastro retorna erro.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <Metric label="Processos ativos" value={String(stats.active)} detail={`${stats.total} no total`} icon={Scale} tone="primary" />
        <Metric label="Exposição total" value={brl(stats.exposure)} detail="Valor em disputa (ativos)" icon={Gavel} tone="blue" />
        <Metric label="Risco crítico" value={String(stats.critical)} detail="Prioridade máxima" icon={AlertTriangle} tone="red" />
        <Metric label="Audiências em 30d" value={String(stats.hearings)} detail="Agenda do contencioso" icon={Calendar} tone="emerald" />
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
        <div className="p-5 lg:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por processo, parte ou vara…"
              className="w-full bg-background border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => setOnlyActive((v) => !v)}
            className={cn(
              "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
              onlyActive
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
            )}
          >
            {onlyActive ? "Somente ativos" : "Todos os processos"}
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {visible.map((c) => {
            const status = STATUS_META[c.status] ?? STATUS_META.em_andamento;
            const risk = RISK_META[c.risk_level] ?? RISK_META.medium;
            const days = daysUntil(c.next_hearing);
            return (
              <div key={c.id} className="p-5 lg:p-6 hover:bg-white/[0.02] transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", status.className)}>
                        {status.label}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {TYPE_LABEL[c.type] ?? c.type}
                      </span>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest", risk.className)}>
                        Risco {risk.label}
                      </span>
                    </div>
                    <h3 className="text-base lg:text-lg font-bold leading-tight">{c.title}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      <span className="font-mono normal-case tracking-normal">{c.case_number}</span>
                      {c.court && <span className="normal-case tracking-normal">{c.court}</span>}
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {(c.entities as { name?: string } | null)?.name ?? "Sem entidade"}
                      </span>
                    </div>
                    {c.notes && <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{c.notes}</p>}
                  </div>

                  <div className="flex items-center gap-6 lg:gap-8 lg:text-right">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Exposição</p>
                      <p className="text-base font-black tabular-nums">{brl(c.value_at_stake)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Audiência</p>
                      <p
                        className={cn(
                          "text-base font-black tabular-nums",
                          days !== null && days >= 0 && days <= 7 ? "text-orange-500" : "",
                        )}
                      >
                        {c.next_hearing ? new Date(c.next_hearing).toLocaleDateString("pt-BR") : "—"}
                      </p>
                      {days !== null && (
                        <p className="text-[9px] font-bold text-muted-foreground/60">
                          {days < 0 ? `há ${Math.abs(days)}d` : `em ${days}d`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditing(c as unknown as LegalCaseRecord);
                          setFormOpen(true);
                        }}
                        title="Editar processo"
                        className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover o processo "${c.title}"?`)) remove.mutate({ id: c.id });
                        }}
                        title="Remover processo"
                        className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-60" />
              <p className="text-sm font-bold">Nenhum processo encontrado</p>
              <p className="text-xs text-muted-foreground">
                {onlyActive ? "Talvez existam processos encerrados — alterne o filtro." : "Cadastre o primeiro processo do contencioso."}
              </p>
            </div>
          )}
        </div>
      </div>

      <LegalCaseForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        editing={editing}
      />
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
    <div className="glass-card p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] space-y-4">
      <div className={cn("h-11 w-11 rounded-xl border flex items-center justify-center", tones[tone] ?? tones.primary)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
        <p className="text-2xl lg:text-3xl font-black tabular-nums mt-1">{value}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{detail}</p>
      </div>
    </div>
  );
}
