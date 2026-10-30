import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, Loader2, Plus, Pencil, Trash2, Database, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuditLogs } from "@/hooks/usePatrimonio";

export const Route = createFileRoute("/_app/jarvis/historico")({
  component: JarvisHistorico,
});

const TABLE_LABEL: Record<string, string> = {
  entities: "Holding",
  assets: "Ativo",
  documents: "Documento",
  risks: "Risco",
  transactions: "Lançamento",
  jarvis_insights: "Insight",
  suppliers: "Fornecedor",
  legal_cases: "Processo",
  members: "Sócio",
};

const ACTION_META: Record<string, { label: string; className: string; icon: any }> = {
  INSERT: { label: "Criação", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", icon: Plus },
  UPDATE: { label: "Alteração", className: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Pencil },
  DELETE: { label: "Exclusão", className: "bg-red-500/10 text-red-500 border-red-500/20", icon: Trash2 },
};

/** Resumo legível do registro alterado, a partir do JSON da auditoria. */
function describe(table: string | null, payload: Record<string, unknown> | null): string {
  if (!payload) return "—";
  const candidates = ["title", "name", "full_name", "case_number", "amount", "status"];
  const parts: string[] = [];
  for (const key of candidates) {
    const value = payload[key];
    if (value !== null && value !== undefined && value !== "") {
      parts.push(key === "amount" ? `R$ ${Number(value).toLocaleString("pt-BR")}` : String(value));
      if (parts.length >= 2) break;
    }
  }
  return parts.join(" · ") || `${TABLE_LABEL[table ?? ""] ?? table ?? "registro"}`;
}

/** Lista os campos que mudaram entre old_data e new_data. */
function changedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];
  const skip = new Set(["updated_at", "created_at", "id"]);
  return Object.keys(newData)
    .filter((key) => !skip.has(key) && JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))
    .slice(0, 4);
}

function JarvisHistorico() {
  const { data: logs, isLoading } = useAuditLogs(80);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<"todos" | "INSERT" | "UPDATE" | "DELETE">("todos");

  const stats = useMemo(() => {
    const list = logs ?? [];
    return {
      total: list.length,
      today: list.filter((l) => new Date(l.created_at ?? "").toDateString() === new Date().toDateString()).length,
      tables: new Set(list.map((l) => l.table_name)).size,
    };
  }, [logs]);

  const visible = useMemo(() => {
    const term = query.toLowerCase();
    return (logs ?? []).filter((log) => {
      const matchesAction = action === "todos" || log.action === action;
      const matchesTerm =
        !term ||
        `${TABLE_LABEL[log.table_name ?? ""] ?? log.table_name ?? ""} ${describe(log.table_name, (log.new_data ?? log.old_data) as Record<string, unknown> | null)}`
          .toLowerCase()
          .includes(term);
      return matchesAction && matchesTerm;
    });
  }, [logs, action, query]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">Trilha de auditoria</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter uppercase italic flex items-center gap-4">
            <History className="h-8 w-8 text-primary" />
            Histórico
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Toda criação, alteração e exclusão nas tabelas patrimoniais é registrada com autor, antes e depois —
            gravada por trigger no banco, não pelo cliente.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Pill label="Eventos" value={String(stats.total)} />
          <Pill label="Hoje" value={String(stats.today)} />
          <Pill label="Tabelas" value={String(stats.tables)} />
        </div>
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
        <div className="p-5 lg:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por tabela ou registro…"
              className="w-full bg-background border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2">
            {(["todos", "INSERT", "UPDATE", "DELETE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setAction(value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                  action === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
                )}
              >
                {value === "todos" ? "Todos" : ACTION_META[value].label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {visible.map((log) => {
            const meta = ACTION_META[log.action ?? ""] ?? ACTION_META.UPDATE;
            const Icon = meta.icon;
            const newData = log.new_data as Record<string, unknown> | null;
            const oldData = log.old_data as Record<string, unknown> | null;
            const changed = changedFields(oldData, newData);

            return (
              <div key={log.id} className="p-4 lg:p-5 hover:bg-white/[0.02] transition-colors flex items-start gap-4">
                <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center shrink-0", meta.className)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border", meta.className)}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                      {TABLE_LABEL[log.table_name ?? ""] ?? log.table_name ?? "—"}
                    </span>
                    <span className="text-xs font-bold truncate">
                      {describe(log.table_name, newData ?? oldData)}
                    </span>
                  </div>
                  {changed.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
                      campos:{" "}
                      {changed
                        .map((field) => {
                          const before = oldData?.[field];
                          const after = newData?.[field];
                          return `${field}${before !== undefined ? ` (${String(before)} → ${String(after)})` : ""}`;
                        })
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold tabular-nums text-muted-foreground">
                    {new Date(log.created_at ?? "").toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-[10px] tabular-nums text-muted-foreground/60">
                    {new Date(log.created_at ?? "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <Database className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-bold">Nenhum evento de auditoria ainda</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                A trilha é preenchida por trigger no banco. Se você acabou de aplicar a migration
                <span className="font-mono"> 20261030140000_operations_tables.sql</span>, crie ou edite um registro
                (ativo, risco, fornecedor…) para ver o primeiro evento aparecer aqui.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white/[0.01] text-center flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">
            RLS: você vê apenas eventos dos seus próprios registros · admins veem tudo
          </p>
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[90px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}
