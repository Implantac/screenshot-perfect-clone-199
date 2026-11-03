/**
 * Renda fixa a mercado — curva do Tesouro e marcação das posições (wave 27).
 *
 * O QUE ESTA TELA RESOLVE
 * Até aqui, título público era o único ativo relevante com preço 100% digitado.
 * Um Tesouro IPCA+ comprado há dois anos aparecia no PL pelo preço de compra —
 * patrimônio errado em silêncio, e o score de qualidade reclamava de "preço
 * velho" sem oferecer saída.
 *
 * O QUE ELA NÃO É
 * Não é mesa de operações: mostra o PU oficial do Tesouro (o mesmo que o extrato
 * do cliente traz) e não recalcula VNA nem cupom. Debênture, CRI, CRA, CDB e LCA
 * continuam sem preço público — e a tela diz isso na cara, em vez de deixar a
 * impressão de cobertura total.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTesouroPanel } from "@/lib/api/tesouro.functions";
import { useSyncTesouro } from "@/hooks/useCrud";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const pct = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

function ageLabel(days: number) {
  if (days <= 0) return "hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

export function TesouroPanel({ entityFilter }: { entityFilter?: string }) {
  const [onlyFixed, setOnlyFixed] = useState(true);

  const query = useQuery({
    queryKey: ["tesouro-curve", entityFilter ?? "all"],
    queryFn: () => getTesouroPanel({ data: entityFilter ? { entity_id: entityFilter } : {} }),
    retry: false,
    // A curva muda uma vez por dia útil; não faz sentido bater na fonte a cada foco.
    staleTime: 10 * 60_000,
  });

  const sync = useSyncTesouro();
  const data = query.data;

  const positions = useMemo(() => {
    if (!data) return [];
    const list = data.positions;
    return onlyFixed ? list.filter((entry) => entry.status === "resolved") : list;
  }, [data, onlyFixed]);

  const totals = useMemo(() => {
    if (!data) return { delta: 0, marked: 0, pending: 0 };
    let delta = 0;
    let marked = 0;
    let pending = 0;
    for (const entry of data.positions) {
      if (entry.status === "resolved") {
        marked += 1;
        delta += entry.deltaBrl ?? 0;
      } else {
        pending += 1;
      }
    }
    return { delta, marked, pending };
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Renda fixa a mercado (Tesouro Direto)
            </h3>
            <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
              Preço oficial de venda do Tesouro — o mesmo que aparece no extrato do cliente. Marcar a
              posição pelo PU de venda é o que ela vale se resgatar hoje; o PU de compra aparece como
              spread, não como patrimônio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sync.mutate({ entity_id: entityFilter, apply: false })}
              disabled={sync.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              {sync.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Simular
            </button>
            <button
              onClick={() => sync.mutate({ entity_id: entityFilter, apply: true })}
              disabled={sync.isPending}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
            >
              {sync.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
              Sincronizar e aplicar
            </button>
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo a curva do Tesouro…
          </div>
        ) : query.isError ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
            Não foi possível ler a curva: {query.error instanceof Error ? query.error.message : "erro desconhecido"}
          </p>
        ) : data && data.curve.length === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-[11px] text-amber-200">
            Nenhuma curva sincronizada ainda. Clique em <strong>Sincronizar e aplicar</strong> — o primeiro
            download traz o arquivo do Tesouro (≈ 15 MB) e leva alguns segundos.
          </p>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Títulos na curva
                </span>
                <p className="mt-2 text-2xl font-black tabular-nums">{data.summary.bonds}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {data.summary.asOf ? `data-base ${data.summary.asOf.split("-").reverse().join("/")}` : "sem data"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Posições marcadas
                </span>
                <p className="mt-2 text-2xl font-black tabular-nums">
                  {totals.marked}
                  {totals.pending > 0 && (
                    <span className="ml-2 text-xs font-bold text-amber-400">{totals.pending} sem par</span>
                  )}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">reconhecidas pelo nome da posição</p>
              </div>
              <div
                className={cn(
                  "rounded-2xl border p-4",
                  totals.delta >= 0
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10",
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Impacto no PL
                </span>
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-2xl font-black tabular-nums",
                    totals.delta >= 0 ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {totals.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {brl(totals.delta)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">vs preço que está na carteira</p>
              </div>
              <div
                className={cn(
                  "rounded-2xl border p-4",
                  data.health.ok
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10",
                )}
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Sanidade da curva
                </span>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-black">
                  {data.health.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  )}
                  {data.health.ok ? "sem achados" : `${data.health.failed} achado(s)`}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">{data.health.total} conferência(s)</p>
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {data.summary.note} Curva por família:{" "}
              {data.summary.families.map((family) => `${family.label} ${pct(family.minRate)}–${pct(family.maxRate)}`).join(" · ")}
            </p>

            {!data.health.ok && (
              <ul className="space-y-1 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-[11px] text-red-300">
                {data.findings
                  .filter((finding) => !finding.ok)
                  .slice(0, 5)
                  .map((finding, index) => (
                    <li key={`${finding.kind}-${finding.code}-${finding.maturity}-${index}`}>
                      <strong>{finding.code}</strong> {finding.maturity.split("-").reverse().join("/")} —{" "}
                      {finding.detail}
                    </li>
                  ))}
              </ul>
            )}
          </>
        ) : null}
      </div>

      {data && data.positions.length > 0 && (
        <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Posições de renda fixa
            </h3>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <input
                type="checkbox"
                checked={onlyFixed}
                onChange={(event) => setOnlyFixed(event.target.checked)}
                className="h-3 w-3 accent-emerald-400"
              />
              só com par no Tesouro
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  <th className="px-3 py-2">Posição</th>
                  <th className="px-3 py-2 text-right">Qtd.</th>
                  <th className="px-3 py-2 text-right">Preço atual</th>
                  <th className="px-3 py-2 text-right">PU de venda</th>
                  <th className="px-3 py-2 text-right">Impacto</th>
                  <th className="px-3 py-2 text-right">Preço</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((entry) => (
                  <tr key={entry.positionId} className="border-b border-white/5 text-[11px]">
                    <td className="px-3 py-2">
                      <span className="font-bold">{entry.name}</span>
                      {entry.status !== "resolved" && (
                        <span
                          className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300"
                          title={entry.reason}
                        >
                          {entry.status === "ambiguous" ? "ambíguo" : "sem par"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.quantity.toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{brl(entry.unitPrice)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {entry.marketPrice === undefined ? "—" : brl(entry.marketPrice)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums font-bold",
                        (entry.deltaBrl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {entry.deltaBrl === undefined
                        ? "—"
                        : `${entry.deltaBrl >= 0 ? "+" : ""}${brl(entry.deltaBrl)}`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {entry.ageDays === undefined ? (
                        <span
                          className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60"
                          title={entry.reason}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest",
                            entry.stale ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300",
                          )}
                        >
                          {ageLabel(entry.ageDays)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {positions.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma posição com par no Tesouro. Use o nome do título na descrição da posição
              (ex.: “Tesouro IPCA+ 2035”, “Tesouro Selic 2029”).
            </p>
          )}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Debênture, CRI, CRA, CDB e LCA <strong>não</strong> têm preço público aqui e continuam manuais —
            a marcação cobre o título público, não a renda fixa bancária.
          </p>
        </div>
      )}
    </div>
  );
}
