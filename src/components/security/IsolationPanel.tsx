/**
 * Painel de isolamento entre tenants (wave 23).
 *
 * Mostra o que o banco respondeu sobre as próprias policies: quais tabelas estão
 * fechadas por dono, quais têm policy permissiva (vazamento) e quantas linhas
 * ficaram em quarentena por não terem vínculo de tenant.
 *
 * A leitura é honesta sobre o limite: ausência de achado não é atestado — é
 * ausência de achado pelos padrões que o detector conhece.
 */
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIsolationReport } from "@/lib/api/security.functions";

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  isolado: { label: "Isolado", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: ShieldCheck },
  quarentena: { label: "Quarentena", className: "border-amber-500/30 bg-amber-500/10 text-amber-400", icon: ShieldAlert },
  vazando: { label: "Vazando", className: "border-red-500/30 bg-red-500/10 text-red-400", icon: AlertTriangle },
};

export function IsolationPanel() {
  const query = useQuery({
    queryKey: ["isolation-report"],
    queryFn: () => getIsolationReport(),
    retry: false,
    staleTime: 60_000,
  });

  const report = query.data;

  return (
    <section className="glass-card rounded-[2rem] border border-white/5 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <Lock className="h-3.5 w-3.5 text-primary" /> Isolamento entre tenants
        </h2>
        {report && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                report.status === "isolado"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : report.status === "atencao"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400",
              )}
            >
              {report.status === "isolado" ? "sem achados" : report.status === "atencao" ? "atenção" : "crítico"}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {report.totals.tablesChecked} tabela(s) · {report.totals.policiesChecked} policy(ies)
            </span>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo policies do banco…
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Em RLS permissivo, policies se somam com <strong>OR</strong>: uma policy antiga sem predicado anula a
            policy por dono. Aqui o banco é lido como ele está — tabela por tabela.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                <tr>
                  <th className="py-2">Tabela</th>
                  <th className="py-2 text-right">Policies</th>
                  <th className="py-2 text-right">Escopadas</th>
                  <th className="py-2 text-right">Órfãs</th>
                  <th className="py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(report?.tables ?? []).map((table) => {
                  const style = STATUS_STYLE[table.status] ?? STATUS_STYLE.isolado;
                  const Icon = style.icon;
                  return (
                    <tr key={table.table}>
                      <td className="py-2">
                        <span className="font-mono text-[10px]">{table.table}</span>
                        <p className="text-[9px] text-muted-foreground/70">{table.detail}</p>
                      </td>
                      <td className="py-2 text-right tabular-nums">{table.policies}</td>
                      <td className="py-2 text-right tabular-nums">{table.scoped}</td>
                      <td className={cn("py-2 text-right tabular-nums", table.orphanRows > 0 && "text-amber-400")}>
                        {table.orphanRows}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                            style.className,
                          )}
                        >
                          <Icon className="h-3 w-3" /> {style.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(report?.tables.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-muted-foreground">
                      Nada retornado — confira se a migration 20261030280000 foi aplicada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(report?.recommendations.length ?? 0) > 0 && (
            <ul className="mt-3 space-y-1">
              {report?.recommendations.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
          )}

          {(report?.warnings.length ?? 0) > 0 && (
            <div className="mt-3 space-y-1 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
              {report?.warnings.map((warning) => (
                <p key={warning} className="text-[9px] text-muted-foreground/70">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
