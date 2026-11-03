import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Printer,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useAssets,
  useDocuments,
  useEntities,
  useGoals,
  useLegalCases,
  useLiabilities,
  useMembers,
  usePortfolioSnapshots,
  usePositions,
  useQuotes,
  useRisks,
  useSuppliers,
} from "@/hooks/usePatrimonio";
import { buildMonthlyReport } from "@/lib/reports/monthly";
import { brl as brlFmt, pct as pctFmt, signedPoints } from "@/lib/reports/format";
import { summarizeAllocation, positionValue } from "@/lib/wealth/allocation";
import { summarizePerformance } from "@/lib/wealth/performance";
import { buildQualityReport } from "@/lib/wealth/quality";

export const Route = createFileRoute("/_app/relatorios")({
  component: Relatorios,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

const SECTIONS = [
  { id: "capa", label: "Capa" },
  { id: "mensal", label: "Resumo do mês" },
  { id: "patrimonio", label: "Patrimônio" },
  { id: "performance", label: "Performance" },
  { id: "governanca", label: "Governança" },
  { id: "qualidade", label: "Qualidade do dado" },
] as const;

function Relatorios() {
  const { data: entities } = useEntities();
  const { data: positions } = usePositions();
  const { data: assets } = useAssets();
  const { data: snapshots } = usePortfolioSnapshots();
  const { data: documents } = useDocuments();
  const { data: risks } = useRisks();
  const { data: members } = useMembers();
  const { data: legalCases } = useLegalCases();
  const { data: suppliers } = useSuppliers();
  const { data: liabilities } = useLiabilities();
  const { data: goals } = useGoals();
  const { data: quotes } = useQuotes();

  const [selected, setSelected] = useState<string[]>([
    "capa",
    "mensal",
    "patrimonio",
    "performance",
    "governanca",
    "qualidade",
  ]);
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));
  const [baixando, setBaixando] = useState(false);
  const [entityFilter, setEntityFilter] = useState("todas");
  const [cliente, setCliente] = useState("");

  const filteredPositions = useMemo(
    () => (positions ?? []).filter((p) => entityFilter === "todas" || p.entity_id === entityFilter),
    [positions, entityFilter],
  );

  const allocation = useMemo(() => summarizeAllocation(filteredPositions), [filteredPositions]);
  const performance = useMemo(
    () =>
      summarizePerformance(
        (snapshots ?? []).map((s) => ({
          as_of: s.as_of,
          market_value: Number(s.market_value ?? 0),
          cost_basis: Number(s.cost_basis ?? 0),
          net_flow: Number(s.net_flow ?? 0),
        })),
        [],
      ),
    [snapshots],
  );
  const quality = useMemo(
    () => buildQualityReport({ positions: filteredPositions, documents, assets }),
    [filteredPositions, documents, assets],
  );

  const monthly = useMemo(
    () =>
      buildMonthlyReport({
        competencia,
        clientName: cliente,
        entityName:
          entityFilter === "todas"
            ? null
            : ((entities ?? []).find((entity) => entity.id === entityFilter)?.name ?? null),
        positions: filteredPositions,
        registeredAssets: (assets ?? []).map((asset) => ({ current_value: asset.value })),
        snapshots: (snapshots ?? []).map((snapshot) => ({
          as_of: snapshot.as_of,
          market_value: snapshot.market_value,
          net_flow: snapshot.net_flow,
        })),
        liabilities: (liabilities ?? []).map((liability) => ({
          ...liability,
          outstanding: Number(liability.outstanding ?? 0),
        })),
        goals: (goals ?? []).map((goal) => ({
          ...goal,
          target_amount: Number(goal.target_amount ?? 0),
          allocated: Number(goal.allocated ?? 0),
        })),
        quotes: (quotes ?? []).map((quote) => ({
          symbol: quote.symbol,
          asOf: quote.as_of,
          price: Number(quote.price),
        })),
      }),
    [competencia, cliente, entityFilter, entities, filteredPositions, assets, snapshots, liabilities, goals, quotes],
  );

  const baixarPdf = async () => {
    setBaixando(true);
    try {
      // jsPDF só entra no bundle quando o usuário pede o arquivo.
      const { renderMonthlyPdf } = await import("@/lib/reports/pdf");
      const blob = await renderMonthlyPdf(monthly);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `patrium-relatorio-${monthly.meta.competencia}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Relatório de ${monthly.meta.label} gerado`);
    } catch (error) {
      toast.error("Não foi possível gerar o PDF", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBaixando(false);
    }
  };

  const assetsTotal = (assets ?? []).reduce((sum, a) => sum + Number(a.value ?? 0), 0);
  const openRisks = (risks ?? []).filter((r) => r.status !== "resolved" && r.status !== "ignored");
  const activeCases = (legalCases ?? []).filter((c) => c.status === "em_andamento" || c.status === "suspenso");
  const exposure = activeCases.reduce((sum, c) => sum + Number(c.value_at_stake ?? 0), 0);
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const loading = !positions && !assets;
  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto w-full">
      {/* Barra de controle — não sai na impressão */}
      <div className="print:hidden space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">Reporting</p>
            <h2 className="text-3xl font-black tracking-tight uppercase">Relatórios</h2>
            <p className="text-muted-foreground text-sm max-w-2xl">
              Consolidado pronto para o cliente: monte as seções, ajuste o cabeçalho e imprima ou salve em PDF pelo
              próprio navegador.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={competencia}
              onChange={(event) => setCompetencia(event.target.value || competencia)}
              className="h-12 bg-background border border-white/10 rounded-2xl px-4 text-[11px] font-bold"
              aria-label="Competência do relatório"
            />
            <button
              onClick={baixarPdf}
              disabled={baixando}
              className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {baixando ? "Gerando…" : "Baixar PDF do mês"}
            </button>
            <button
              onClick={() => window.print()}
              className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex flex-col lg:flex-row gap-4 lg:items-center">
          <div className="flex gap-2 flex-wrap flex-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => toggle(section.id)}
                className={cn(
                  "h-9 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5",
                  selected.includes(section.id)
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-white/5 text-muted-foreground border-white/10",
                )}
              >
                {selected.includes(section.id) && <CheckCircle2 className="h-3 w-3" />}
                {section.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-9 bg-background border border-white/10 rounded-lg px-3 text-[10px] font-bold uppercase tracking-widest"
            >
              <option value="todas">Todo o grupo</option>
              {(entities ?? []).map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Preparado para…"
              className="h-9 bg-background border border-white/10 rounded-lg px-3 text-[11px] w-48"
            />
          </div>
        </div>
      </div>

      {/* Documento */}
      <article className="glass-card print:bg-white print:text-black rounded-[2rem] print:rounded-none p-8 lg:p-12 space-y-10 print:space-y-8 border border-white/5 print:border-0">
        {selected.includes("capa") && (
          <header className="space-y-6 pb-8 border-b border-white/10 print:border-black/10">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary print:text-black/60">
                  PATRIUM OS
                </p>
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight mt-2">Relatório consolidado de patrimônio</h1>
                <p className="text-sm text-muted-foreground print:text-black/60 mt-2">
                  {entityFilter === "todas"
                    ? "Consolidado do grupo familiar"
                    : (entities ?? []).find((e) => e.id === entityFilter)?.name}
                </p>
              </div>
              <div className="text-right text-[11px] space-y-1">
                <p className="text-muted-foreground print:text-black/60">Emitido em</p>
                <p className="font-bold">{today}</p>
                {cliente && (
                  <>
                    <p className="text-muted-foreground print:text-black/60 pt-2">Preparado para</p>
                    <p className="font-bold">{cliente}</p>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Cover label="Patrimônio financeiro" value={brl(allocation.total)} />
              <Cover label="Ativos registrais" value={brl(assetsTotal)} />
              <Cover label="TWR do período" value={pct(performance.twr.cumulative)} />
              <Cover label="Score de dados" value={`${quality.score} (${quality.grade})`} />
            </div>
          </header>
        )}

        {selected.includes("mensal") && (
          <section className="space-y-4">
            <SectionTitle index="00" title="Resumo do mês" />
            <p className="text-base font-bold leading-snug">{monthly.narrative.headline}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Cover label="No mês" value={pctFmt(monthly.summary.monthReturnPct)} />
              <Cover label="No ano" value={pctFmt(monthly.summary.ytdReturnPct)} />
              <Cover label="Ganho do mês" value={brlFmt(monthly.summary.monthGain)} />
              <Cover label="Cobertura de cotação" value={pctFmt(monthly.summary.coverage, 0)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-1">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Contribuição por classe
                </p>
                {monthly.attribution.month.byClass.map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-3 text-[12px]">
                    <span>{bucket.label}</span>
                    <span className="tabular-nums">
                      <span className="text-muted-foreground print:text-black/60 mr-2">
                        {pctFmt(bucket.weight, 1)}
                      </span>
                      <span className="font-bold">{signedPoints(bucket.contribution)}</span>
                    </span>
                  </div>
                ))}
                {monthly.attribution.month.byClass.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem posições no período.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Pendências do fechamento
                </p>
                {monthly.pendencies.slice(0, 5).map((item) => (
                  <div key={item.text} className="flex items-start gap-2 text-[11px]">
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                        item.severity === "alta"
                          ? "bg-red-500"
                          : item.severity === "media"
                            ? "bg-amber-500"
                            : "bg-white/30 print:bg-black/30",
                      )}
                    />
                    <span>
                      <strong className="uppercase text-[9px] tracking-widest">{item.area}.</strong>{" "}
                      <span className="text-muted-foreground print:text-black/60">{item.text}</span>
                    </span>
                  </div>
                ))}
                {monthly.pendencies.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma pendência aberta.</p>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 print:text-black/50 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Competência {monthly.meta.label} · janela de atribuição desde{" "}
              {monthly.attribution.windows.monthFrom} · {monthly.pendencies.length} pendência(s).
              O PDF sai deste mesmo documento, em vetor.
            </p>
          </section>
        )}

        {selected.includes("patrimonio") && (
          <section className="space-y-4">
            <SectionTitle index="01" title="Composição patrimonial" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                {allocation.byClass.map((bucket) => (
                  <div key={bucket.key} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary print:bg-black" />
                      {bucket.label}
                    </span>
                    <span className="tabular-nums">
                      <span className="text-muted-foreground print:text-black/60 mr-2">{pct(bucket.percentage)}</span>
                      <span className="font-bold">{brl(bucket.value)}</span>
                    </span>
                  </div>
                ))}
                {allocation.byClass.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sem posições financeiras registradas.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Indicadores
                </p>
                <ReportRow label="Posições" value={String(allocation.positionsCount)} />
                <ReportRow label="Líquido em D+1" value={pct(allocation.liquidPercentage)} />
                <ReportRow label="Offshore" value={pct(allocation.offshorePercentage)} />
                <ReportRow label="Concentração (HHI)" value={allocation.concentration.toFixed(3)} />
                <ReportRow
                  label="Maior posição"
                  value={allocation.top[0] ? `${allocation.top[0].name} (${pct(allocation.top[0].percentage)})` : "—"}
                />
              </div>
            </div>
          </section>
        )}

        {selected.includes("performance") && (
          <section className="space-y-4">
            <SectionTitle index="02" title="Performance" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Cover label="TWR acumulado" value={pct(performance.twr.cumulative)} />
              <Cover label="MWR (XIRR)" value={performance.mwr === null ? "—" : pct(performance.mwr)} />
              <Cover label={`Excesso vs ${performance.benchmark.name}`} value={pct(performance.benchmark.excess)} />
              <Cover label="Drawdown máximo" value={pct(performance.drawdown.maxDrawdown)} />
            </div>
            <p className="text-[11px] text-muted-foreground print:text-black/60 leading-relaxed">
              TWR mede a estratégia (descontando aportes e resgates); MWR mede o retorno do investidor. Período de{" "}
              {performance.twr.spanDays} dias em {performance.twr.periods} fechamentos.
              {performance.twr.annualized !== null && ` Anualizado: ${pct(performance.twr.annualized)}.`}
            </p>
          </section>
        )}

        {selected.includes("governanca") && (
          <section className="space-y-4">
            <SectionTitle index="03" title="Governança e riscos" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Cover label="Sócios" value={String(members?.length ?? 0)} />
              <Cover label="Riscos abertos" value={String(openRisks.length)} />
              <Cover label="Contencioso ativo" value={String(activeCases.length)} />
              <Cover label="Exposição jurídica" value={brl(exposure)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Riscos prioritários
                </p>
                {openRisks.slice(0, 5).map((risk) => (
                  <div key={risk.id} className="flex items-start justify-between gap-3 text-[11px]">
                    <span className="truncate">{risk.title}</span>
                    <span className="font-bold uppercase text-[9px] shrink-0">{risk.severity}</span>
                  </div>
                ))}
                {openRisks.length === 0 && <p className="text-xs text-muted-foreground">Nenhum risco aberto.</p>}
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Fornecedores críticos
                </p>
                {(suppliers ?? [])
                  .filter((s) => s.status === "risco_critico" || s.status === "em_analise")
                  .slice(0, 5)
                  .map((supplier) => (
                    <div key={supplier.id} className="flex items-start justify-between gap-3 text-[11px]">
                      <span className="truncate">{supplier.name}</span>
                      <span className="font-bold uppercase text-[9px] shrink-0">{supplier.status}</span>
                    </div>
                  ))}
                {(suppliers ?? []).filter((s) => s.status === "risco_critico" || s.status === "em_analise").length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum fornecedor em risco.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {selected.includes("qualidade") && (
          <section className="space-y-4">
            <SectionTitle index="04" title="Qualidade da informação" />
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black tabular-nums">{quality.score}</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">
                  Nota {quality.grade}
                </p>
                <p className="text-[11px] text-muted-foreground print:text-black/60">
                  {quality.findings.length === 0
                    ? "Nenhum achado — base consistente."
                    : `${quality.findings.length} achado(s) de consistência.`}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {quality.findings.map((finding) => (
                <div key={finding.id} className="flex items-start gap-2 text-[11px]">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-orange-500 print:text-black" />
                  <span>
                    <strong>{finding.title}.</strong>{" "}
                    <span className="text-muted-foreground print:text-black/60">{finding.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-6 border-t border-white/10 print:border-black/10 flex items-center justify-between gap-4 text-[9px] text-muted-foreground print:text-black/50">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> PATRIUM OS · relatório gerado a partir dos dados do tenant
          </span>
          <span>{today}</span>
        </footer>
      </article>

      <p className="print:hidden text-[10px] text-muted-foreground/60 text-center pb-6 flex items-center justify-center gap-1.5">
        <Download className="h-3 w-3" />
        Use “Imprimir” e escolha “Salvar como PDF” para gerar o arquivo final.
      </p>
    </div>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <h2 className="flex items-baseline gap-3">
      <span className="text-[10px] font-black tabular-nums text-primary print:text-black/50">{index}</span>
      <span className="text-lg font-black uppercase tracking-tight">{title}</span>
    </h2>
  );
}

function Cover({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/[0.03] print:bg-black/[0.03] border border-white/5 print:border-black/10">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 print:text-black/50">{label}</p>
      <p className="text-base font-black tabular-nums mt-1">{value}</p>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px] border-b border-white/5 print:border-black/10 pb-1.5">
      <span className="text-muted-foreground print:text-black/60">{label}</span>
      <span className="font-bold tabular-nums truncate">{value}</span>
    </div>
  );
}
