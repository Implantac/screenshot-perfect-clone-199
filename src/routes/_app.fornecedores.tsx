import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Handshake, Plus, Search, ShieldCheck, AlertTriangle, Clock, Pencil, Trash2, Loader2, Mail, Calendar, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuppliers } from "@/hooks/usePatrimonio";
import { useDeleteSupplier, useToggleSupplierStatus } from "@/hooks/useCrud";
import { SupplierForm, type SupplierRecord } from "@/components/forms/SupplierForm";

export const Route = createFileRoute("/_app/fornecedores")({
  component: GestaoFornecedores,
});

const STATUS_META: Record<string, { label: string; className: string }> = {
  homologado: { label: "Homologado", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  em_analise: { label: "Em análise", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  risco_critico: { label: "Risco crítico", className: "bg-red-500/10 text-red-500 border-red-500/20" },
  inativo: { label: "Inativo", className: "bg-white/5 text-muted-foreground border-white/10" },
};

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(d)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86_400_000);
}

function GestaoFornecedores() {
  const { data: suppliers, isLoading } = useSuppliers();
  const remove = useDeleteSupplier();
  const toggle = useToggleSupplierStatus();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const stats = useMemo(() => {
    const list = suppliers ?? [];
    return {
      total: list.length,
      homologados: list.filter((s) => s.status === "homologado").length,
      analise: list.filter((s) => s.status === "em_analise").length,
      risco: list.filter((s) => s.status === "risco_critico").length,
      contratos: list.reduce((sum, s) => sum + Number(s.contract_value ?? 0), 0),
    };
  }, [suppliers]);

  const visible = useMemo(() => {
    const term = query.toLowerCase();
    return (suppliers ?? []).filter((s) => {
      const matchesTerm =
        !term ||
        `${s.name} ${s.category ?? ""} ${(s.entities as { name?: string } | null)?.name ?? ""}`
          .toLowerCase()
          .includes(term);
      const matchesStatus = statusFilter === "todos" || s.status === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [suppliers, query, statusFilter]);

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
          <h2 className="text-3xl font-black tracking-tight uppercase">Gestão de Fornecedores</h2>
          <p className="text-muted-foreground mt-2 text-sm lg:text-base">
            Homologação, compliance e vencimento de contratos da cadeia de fornecedores.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo fornecedor
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <StatCard label="Homologados" value={String(stats.homologados)} icon={ShieldCheck} tone="emerald" detail="Compliance validado" />
        <StatCard label="Em análise" value={String(stats.analise)} icon={Clock} tone="blue" detail="Documentação pendente" />
        <StatCard label="Risco crítico" value={String(stats.risco)} icon={AlertTriangle} tone="red" detail="Ação necessária" />
        <StatCard label="Valor contratado" value={brl(stats.contratos)} icon={Handshake} tone="primary" detail={`${stats.total} fornecedores`} />
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
        <div className="p-5 lg:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por fornecedor, categoria ou holding…"
              className="w-full bg-background border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {["todos", "homologado", "em_analise", "risco_critico", "inativo"].map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap transition-all",
                  statusFilter === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
                )}
              >
                {value === "todos" ? "Todos" : STATUS_META[value]?.label ?? value}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {visible.map((s) => {
            const meta = STATUS_META[s.status] ?? STATUS_META.em_analise;
            const days = daysUntil(s.contract_expiry);
            return (
              <div key={s.id} className="p-5 lg:p-6 hover:bg-white/[0.02] transition-colors group">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base lg:text-lg font-bold truncate">{s.name}</h3>
                      <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", meta.className)}>
                        {meta.label}
                      </span>
                      {s.category && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
                          {s.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3" />
                        {(s.entities as { name?: string } | null)?.name ?? "Sem entidade"}
                      </span>
                      {s.contact_email && (
                        <span className="flex items-center gap-1.5 normal-case tracking-normal">
                          <Mail className="h-3 w-3" />
                          {s.contact_email}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {days === null
                          ? "Sem contrato"
                          : days < 0
                            ? `Contrato vencido há ${Math.abs(days)}d`
                            : `Vence em ${days}d`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 lg:gap-8">
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Compliance</p>
                      <p
                        className={cn(
                          "text-lg font-black tabular-nums",
                          Number(s.compliance_score ?? 0) >= 90
                            ? "text-emerald-500"
                            : Number(s.compliance_score ?? 0) >= 70
                              ? "text-yellow-500"
                              : "text-red-500",
                        )}
                      >
                        {Number(s.compliance_score ?? 0)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Contrato</p>
                      <p className="text-lg font-black tabular-nums">{brl(s.contract_value)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggle.mutate({
                            id: s.id,
                            status: s.status === "homologado" ? "em_analise" : "homologado",
                          })
                        }
                        disabled={toggle.isPending}
                        title={s.status === "homologado" ? "Revogar homologação" : "Homologar fornecedor"}
                        className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/15 hover:text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        {s.status === "homologado" ? "Revogar" : "Homologar"}
                      </button>
                      <button
                        onClick={() => {
                          setEditing(s as unknown as SupplierRecord);
                          setFormOpen(true);
                        }}
                        title="Editar"
                        className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remover o fornecedor "${s.name}"?`)) remove.mutate({ id: s.id });
                        }}
                        title="Remover"
                        className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {s.notes && (
                  <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed line-clamp-2">{s.notes}</p>
                )}
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm font-bold">Nenhum fornecedor encontrado</p>
              <p className="text-xs text-muted-foreground mt-2">
                Ajuste os filtros ou cadastre o primeiro fornecedor da cadeia.
              </p>
            </div>
          )}
        </div>
      </div>

      <SupplierForm
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

function StatCard({ label, value, icon: Icon, tone, detail }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
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
