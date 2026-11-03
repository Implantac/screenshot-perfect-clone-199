/**
 * Saúde do sistema (wave 26).
 *
 * POR QUE ESTA TELA EXISTE
 * Antes dela, "quebrou alguma coisa?" só se respondia olhando log de servidor ou
 * abrindo o Supabase na mão. O painel responde em uma tela: estado geral, os
 * erros que mais repetem (agrupados por fingerprint) e o estado de cada
 * integração (Supabase, IA, assinatura, webhook, cotações).
 *
 * O QUE ELA NÃO É
 * Não é a trilha de auditoria (waves 20–25): aquela prova o que aconteceu com o
 * dado, é encadeada por hash e não se apaga. Aqui é diagnóstico, com retenção de
 * 90 dias.
 *
 * ACESSO
 * Leitura só de admin — `getHealthPanel` checa `has_role` no servidor e a policy
 * do banco repete a checagem. Não-admin vê a tela explicando isso, não uma lista
 * vazia (lista vazia pareceria "está tudo bem").
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getHealthPanel, purgeOldEvents } from "@/lib/api/observability.functions";
import { MIGRATION_COUNT } from "@/lib/observability/schema-manifest";

export const Route = createFileRoute("/_app/sistema")({
  component: Sistema,
});

const OVERALL = {
  ok: { label: "Operando", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  degradado: { label: "Degradado", className: "border-amber-500/30 bg-amber-500/10 text-amber-400", icon: AlertTriangle },
  fora: { label: "Fora", className: "border-red-500/30 bg-red-500/10 text-red-400", icon: XCircle },
} as const;

const SEVERITY_STYLE = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-400",
} as const;

const INTEGRATION_ICON = {
  supabase: Database,
  llm: Plug,
  signing: Lock,
  webhook: Activity,
  quotes: RefreshCw,
} as const;

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function Sistema() {
  const queryClient = useQueryClient();
  const [hours, setHours] = useState(24);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["health-panel", hours],
    queryFn: () => getHealthPanel({ data: { hours, limit: 40 } }),
    retry: false,
    staleTime: 30_000,
  });

  const purge = useMutation({
    mutationFn: () => purgeOldEvents({ data: { days: 90 } }),
    onSuccess: (result) => {
      toast.success(
        result.removed > 0
          ? `${result.removed} evento(s) além de 90 dias removido(s)`
          : "Nada a remover: nenhum evento além de 90 dias",
      );
      queryClient.invalidateQueries({ queryKey: ["health-panel"] });
    },
    onError: () => toast.error("Não foi possível limpar os eventos antigos"),
  });

  const overall = OVERALL[data?.summary.status ?? "ok"];
  const OverallIcon = overall.icon;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 lg:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
            <Activity className="h-6 w-6 text-primary" /> Saúde do sistema
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Diagnóstico operacional: erro, lentidão e integração. Não é a trilha de auditoria —
            evento de sistema não é encadeado nem serve de prova; a prova está em{" "}
            <span className="text-foreground">Trilha de auditoria</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {[24, 72, 168].map((value) => (
            <button
              key={value}
              onClick={() => setHours(value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition",
                hours === value
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground hover:text-foreground",
              )}
            >
              {value === 24 ? "24 h" : value === 72 ? "3 dias" : "7 dias"}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo eventos…
        </div>
      ) : isError ? (
        <div className="glass-card rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-300">
          Não foi possível ler o painel: {error instanceof Error ? error.message : "erro desconhecido"}
        </div>
      ) : data && !data.isAdmin ? (
        <div className="glass-card flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Lock className="mt-0.5 h-4 w-4 text-amber-400" />
          <div className="text-xs">
            <p className="font-bold text-amber-300">Painel restrito a administradores</p>
            <p className="mt-1 text-muted-foreground">
              Mensagem de erro, mesmo sem e-mail, documento, identificador ou valor, ainda pode
              revelar rotina interna de outro tenant. Por isso a leitura é fechada no servidor e
              repetida na policy de <code className="text-foreground">system_events</code>. Peça a um
              admin do seu espaço para rodar a limpeza de retenção e conferir o estado.
            </p>
          </div>
        </div>
      ) : data ? (
        <>
          {data.migrationPending && (
            <div className="glass-card rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200">
              <p className="font-bold">Migration pendente: {data.migrationPending}</p>
              <p className="mt-1 text-muted-foreground">
                Sem ela não existe tabela <code className="text-foreground">system_events</code>. O app
                continua funcionando e nada é perdido da trilha de auditoria; só o painel fica vazio.
                Aplique o <code className="text-foreground">APLICAR-TUDO.sql</code> (ganhou a {MIGRATION_COUNT}ª
                migration nesta wave).
              </p>
            </div>
          )}

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={cn("glass-card rounded-2xl border p-4", overall.className)}>
              <div className="flex items-center gap-2">
                <OverallIcon className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Estado</span>
              </div>
              <p className="mt-2 text-2xl font-black">{overall.label}</p>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{data.summary.headline}</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Eventos na janela
              </span>
              <p className="mt-2 text-2xl font-black tabular-nums">{data.summary.total}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {data.summary.bySeverity.critical} crítico(s) · {data.summary.bySeverity.warning} aviso(s) ·{" "}
                {data.summary.bySeverity.info} informativo(s)
              </p>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Padrões distintos
              </span>
              <p className="mt-2 text-2xl font-black tabular-nums">{data.summary.top.length}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">agrupados por impressão digital</p>
            </div>

            <div className="glass-card rounded-2xl border border-white/5 p-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Último evento
              </span>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-bold tabular-nums">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {formatWhen(data.summary.lastEventAt)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">retenção de 90 dias</p>
            </div>
          </section>

          <section className="glass-card rounded-2xl border border-white/5 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Erros mais frequentes
              </h2>
              <span className="text-[10px] text-muted-foreground">
                mesma origem + mesma mensagem = mesmo padrão
              </span>
            </div>

            {data.summary.top.length === 0 ? (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-4 text-xs text-emerald-300">
                Nenhum evento na janela escolhida. Isso significa “não houve erro registrado”, não
                “foi testado tudo”: ausência de evento não é atestado.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.summary.top.map((item) => (
                  <li
                    key={item.fingerprint}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                          SEVERITY_STYLE[item.severity as keyof typeof SEVERITY_STYLE] ?? SEVERITY_STYLE.info,
                        )}
                      >
                        {item.severity === "critical" ? "crítico" : item.severity === "warning" ? "aviso" : "info"}
                      </span>
                      <code className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.fingerprint}
                      </code>
                      <span className="text-[11px] font-bold text-foreground">{item.source}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {item.count}× · último {formatWhen(item.lastSeen)}
                      </span>
                    </div>
                    <p className="mt-1.5 break-words text-[11px] text-muted-foreground">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass-card rounded-2xl border border-white/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Plug className="h-3.5 w-3.5 text-primary" /> Integrações
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.integrations.map((integration) => {
                const Icon = INTEGRATION_ICON[integration.key as keyof typeof INTEGRATION_ICON] ?? Plug;
                const style =
                  integration.severity === "ok"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : integration.severity === "warning"
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-red-500/30 bg-red-500/10 text-red-400";
                return (
                  <li key={integration.key} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[11px] font-bold">{integration.label}</span>
                      <span
                        className={cn(
                          "ml-auto rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                          style,
                        )}
                      >
                        {integration.severity === "ok" ? "ok" : integration.severity === "warning" ? "aviso" : "fora"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{integration.detail}</p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[10px] text-muted-foreground">
              O status é lido do ambiente do servidor, não do banco: variável ausente aparece aqui
              antes de virar erro em produção.
            </p>
          </section>

          <section className="glass-card rounded-2xl border border-white/5 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Clock className="h-3.5 w-3.5 text-primary" /> Últimos eventos
              </h2>
              <button
                onClick={() => purge.mutate()}
                disabled={purge.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                {purge.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Limpar &gt; 90 dias
              </button>
            </div>

            {data.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem evento recente.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {data.recent.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-2 py-2 text-[11px]">
                    <span className="tabular-nums text-muted-foreground">{formatWhen(event.occurredAt)}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      {event.kind}
                    </span>
                    <span className="font-bold">{event.source}</span>
                    <span className="text-muted-foreground">{event.message}</span>
                    {Object.keys(event.context).length > 0 && (
                      <code className="ml-auto max-w-full truncate rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        {JSON.stringify(event.context)}
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">
              Gerado em {formatWhen(data.generatedAt)} · {MIGRATION_COUNT} migrations aplicáveis · evento
              traz mensagem já depurada de e-mail, documento, identificador, token e valor.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
