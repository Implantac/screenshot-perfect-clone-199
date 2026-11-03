import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPortalSnapshot } from "@/lib/api/portal.functions";

export const Route = createFileRoute("/_app/portal-cliente")({
  component: PortalCliente,
});

/**
 * Tela do convidado. Tudo o que aparece aqui chegou já resolvido e redigido pelo
 * servidor (`getPortalSnapshot`): não existe número escondido no cliente, nem
 * seção renderizada e depois ocultada por CSS.
 */
function PortalCliente() {
  const [baixando, setBaixando] = useState(false);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["portal_snapshot"],
    queryFn: () => getPortalSnapshot(),
    staleTime: 60_000,
    retry: false,
  });

  const view = data?.ok ? data.view : null;

  const grouped = useMemo(() => {
    if (!view) return [];
    return view.classes.map((item) => ({
      ...item,
      value: Number(item.percentage.replace("%", "").replace(",", ".")) || 0,
    }));
  }, [view]);

  const baixar = async () => {
    if (!view) return;
    setBaixando(true);
    try {
      const { renderPortalPdf } = await import("@/lib/reports/portal-pdf");
      const blob = renderPortalPdf(view);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `patrium-portal-${view.meta.asOf}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Posição exportada em PDF");
    } catch (error) {
      toast.error("Não foi possível gerar o PDF", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBaixando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!view) {
    const message = data && data.ok === false ? data.message : "Não foi possível carregar seu acesso.";
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <Lock className="mx-auto mb-3 h-7 w-7 text-muted-foreground/60" />
          <h1 className="text-sm font-black uppercase tracking-widest">Acesso não disponível</h1>
          <p className="mx-auto mt-2 max-w-md text-[12px] text-muted-foreground">{message}</p>
          <p className="mx-auto mt-4 max-w-md text-[11px] text-muted-foreground/60">
            O portal mostra apenas o que foi concedido ao seu e-mail. Se você deveria ter acesso,
            peça ao gestor responsável para conferir o convite em{" "}
            <span className="font-mono">/portal</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Área do cliente
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            {view.meta.entityName}
          </h1>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {view.meta.holderName} · posição de{" "}
            {view.meta.asOf.split("-").reverse().join("/")} ·{" "}
            {view.access.allowedSections.length} seção(ões) liberada(s) para o seu perfil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
          >
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
          {view.canExport ? (
            <button
              onClick={baixar}
              disabled={baixando}
              className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {baixando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Baixar PDF
            </button>
          ) : (
            <span className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              <Lock className="h-3.5 w-3.5" /> PDF bloqueado
            </span>
          )}
        </div>
      </header>

      {view.cards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {view.cards.map((card) => (
            <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
              <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                <Wallet className="h-3 w-3" /> {card.label}
              </p>
              <p className="mt-2 truncate text-xl font-black tabular-nums">{card.value}</p>
              {card.hint ? <p className="text-[10px] text-muted-foreground">{card.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {grouped.length > 0 ? (
          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest">Alocação por classe</h2>
            <div className="space-y-2.5">
              {grouped.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold">{item.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.percentage}
                      {item.amount ? <span className="ml-2 text-foreground">{item.amount}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, Math.max(0, item.value * 2))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="space-y-4">
          {view.goals.length > 0 ? (
            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest">Metas</h2>
              <div className="space-y-2">
                {view.goals.map((goal) => (
                  <div key={goal.name} className="flex items-start justify-between gap-3 text-[11px]">
                    <div>
                      <p className="font-bold">{goal.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {goal.requiredMonthly}/mês até {goal.targetDate}
                      </p>
                    </div>
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black tabular-nums">
                      {goal.progress}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {view.contributions.length > 0 ? (
            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest">Contribuição no mês</h2>
              <div className="space-y-1.5">
                {view.contributions.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[11px]">
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        item.contribution.startsWith("-") ? "text-red-500" : "text-emerald-500",
                      )}
                    >
                      {item.contribution}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {view.unavailable.length > 0 ? (
        <section className="glass-card rounded-[2rem] border border-white/5 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <Lock className="h-3 w-3" /> Não disponível para o seu perfil
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {view.unavailable.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="text-[11px] font-bold">{item.label}</p>
                <p className="text-[10px] text-muted-foreground/70">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {view.notes.length > 0 ? (
        <div className="space-y-1.5">
          {view.notes.map((note) => (
            <p key={note} className="flex items-start gap-2 px-2 text-[10px] text-muted-foreground/70">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {note}
            </p>
          ))}
        </div>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 pb-4 text-[10px] text-muted-foreground/50">
        <ShieldCheck className="h-3 w-3" />
        Você vê apenas as seções liberadas para o seu e-mail. Dúvidas sobre escopo: fale com o gestor
        responsável.
      </p>
    </div>
  );
}
