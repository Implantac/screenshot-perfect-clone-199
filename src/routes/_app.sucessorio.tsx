import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Landmark as LandmarkIcon,
  Users2,
  Loader2,
  Save,
  Trash2,
  AlertTriangle,
  TrendingDown,
  Info,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntities, useMembers, usePositions, useTaxScenarios } from "@/hooks/usePatrimonio";
import { useCreateTaxScenario, useDeleteTaxScenario } from "@/hooks/useCrud";
import { positionValue } from "@/lib/wealth/allocation";
import {
  ITCMD_TABLE,
  MARITAL_REGIME_LABELS,
  compareScenarios,
  computeItcmd,
  simulateSuccession,
  successionInsights,
  type MaritalRegime,
} from "@/lib/wealth/succession";
import { inputClass } from "@/components/forms/Field";

export const Route = createFileRoute("/_app/sucessorio")({
  component: Sucessorio,
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

function Sucessorio() {
  const { data: positions } = usePositions();
  const { data: members } = useMembers();
  const { data: entities } = useEntities();
  const { data: scenarios } = useTaxScenarios();
  const save = useCreateTaxScenario();
  const remove = useDeleteTaxScenario();

  const positionsTotal = useMemo(
    () => (positions ?? []).reduce((sum, p) => sum + positionValue(p), 0),
    [positions],
  );

  const [patrimony, setPatrimony] = useState<string>("");
  const [regime, setRegime] = useState<MaritalRegime>("comunhao_parcial");
  const [state, setState] = useState("PR");
  const [heirs, setHeirs] = useState("3");
  const [scenarioName, setScenarioName] = useState("");

  // Usa o patrimônio financeiro consolidado como default editável.
  const effectivePatrimony = Number(patrimony) > 0 ? Number(patrimony) : positionsTotal;
  const effectiveHeirs = Math.max(1, Number(heirs) || 1);

  const input = {
    patrimony: effectivePatrimony,
    regime,
    state,
    heirs: effectiveHeirs,
  };

  const base = useMemo(() => simulateSuccession(input), [effectivePatrimony, regime, state, effectiveHeirs]);
  const comparison = useMemo(() => compareScenarios(input), [effectivePatrimony, regime, state, effectiveHeirs]);
  const insights = useMemo(() => successionInsights(base, effectiveHeirs), [base, effectiveHeirs]);
  const itcmdBrackets = (ITCMD_TABLE[state] ?? ITCMD_TABLE.PR).brackets;

  return (
    <div className="space-y-7 lg:space-y-9 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary/70">Planejamento patrimonial</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tight uppercase">Sucessão & Tributação</h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            ITCMD por faixa da UF, meação conforme o regime de bens, custo de inventário e comparação entre herança,
            doação em vida e holding familiar.
          </p>
        </div>
        <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Patrimônio em custódia</p>
          <p className="text-lg font-black tabular-nums text-primary">{brl(positionsTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6">
        {/* Premissas */}
        <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-5">
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Premissas
          </h3>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Patrimônio total (R$)
            </label>
            <input
              type="number"
              value={patrimony}
              onChange={(e) => setPatrimony(e.target.value)}
              placeholder={String(Math.round(positionsTotal))}
              className={inputClass}
            />
            <p className="text-[10px] text-muted-foreground/50">
              Vazio = usa o consolidado das posições ({brl(positionsTotal)}).
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              Regime de bens
            </label>
            <select value={regime} onChange={(e) => setRegime(e.target.value as MaritalRegime)} className={inputClass}>
              {Object.entries(MARITAL_REGIME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">UF (ITCMD)</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                {Object.entries(ITCMD_TABLE).map(([code, table]) => (
                  <option key={code} value={code}>
                    {code} — {table.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Herdeiros</label>
              <input
                type="number"
                min={1}
                value={heirs}
                onChange={(e) => setHeirs(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
              Faixas de ITCMD — {state}
            </p>
            {itcmdBrackets.map((bracket, index) => (
              <div key={index} className="flex justify-between text-[10px] text-muted-foreground">
                <span>
                  até {bracket.upTo === null ? "∞" : `R$ ${bracket.upTo.toLocaleString("pt-BR")}`}
                </span>
                <span className="font-black text-foreground">{bracket.rate}%</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-white/5 space-y-2">
            <input
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              placeholder="Nome do cenário (ex.: Holding 2026)"
              className={inputClass}
            />
            <button
              onClick={() =>
                save.mutate({
                  entity_id: entities?.[0]?.id ?? "",
                  name: scenarioName || `Simulação ${state} ${new Date().toLocaleDateString("pt-BR")}`,
                  state_code: state,
                  assumptions: { patrimony: effectivePatrimony, regime, heirs: effectiveHeirs },
                  results: {
                    estate: base.estate,
                    itcmd: base.itcmd.tax,
                    totalCost: base.totalCost,
                    perHeir: base.perHeir,
                  },
                  total_cost: base.totalCost,
                })
              }
              disabled={save.isPending}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
            >
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar cenário
            </button>
          </div>
        </div>

        {/* Resultado */}
        <div className="xl:col-span-2 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Result label="Espólio" value={brl(base.estate)} detail={`meação ${brl(base.meacao)}`} tone="primary" />
            <Result label="ITCMD" value={brl(base.itcmd.tax)} detail={`efetivo ${pct(base.itcmd.effectiveRate)}`} tone="orange" />
            <Result label="Custo total" value={brl(base.totalCost)} detail={`${pct(base.effectiveCost)} do patrimônio`} tone="red" />
            <Result label="Por herdeiro" value={brl(base.perHeir)} detail={`${effectiveHeirs} herdeiro(s)`} tone="emerald" />
          </div>

          <div className="glass-card rounded-[2rem] p-5 lg:p-7 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" /> Comparação de estruturas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {comparison.map((scenario) => (
                <div
                  key={scenario.label}
                  className={cn(
                    "p-4 rounded-2xl border space-y-2",
                    scenario.deltaVsBase > 0
                      ? "bg-emerald-500/[0.06] border-emerald-500/20"
                      : "bg-white/[0.03] border-white/10",
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest">{scenario.label}</p>
                  <p className="text-lg font-black tabular-nums">{brl(scenario.result.totalCost)}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{scenario.description}</p>
                  {scenario.deltaVsBase !== 0 && (
                    <p className="text-[10px] font-black text-emerald-500">
                      economia de {brl(scenario.deltaVsBase)}
                    </p>
                  )}
                  <div className="pt-1 space-y-0.5 text-[9px] text-muted-foreground/70">
                    <p>ITCMD {brl(scenario.result.itcmd.tax)}</p>
                    <p>Inventário {brl(scenario.result.inventoryCost)}</p>
                    <p>Honorários {brl(scenario.result.legalFees)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-card rounded-[2rem] p-5 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" /> Partilha
              </h3>
              <Row label="Legítima (50% obrigatório)" value={brl(base.legitima)} />
              <Row label="Parte disponível" value={brl(base.availablePortion)} />
              <Row label="Sócios cadastrados" value={String(members?.length ?? 0)} />
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-2 border-t border-white/5">
                A legítima vai obrigatoriamente aos herdeiros necessários; a parte disponível pode ser destinada por
                testamento, doação ou seguro.
              </p>
            </div>

            <div className="glass-card rounded-[2rem] p-5 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Alertas de governança
              </h3>
              {insights.map((note) => (
                <p key={note} className="text-[11px] text-muted-foreground leading-relaxed flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  {note}
                </p>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-white/5 flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Simulação determinística com premissas explícitas: inventário 8% e honorários 6% do espólio (editáveis no
              código), ITCMD por faixa da UF selecionada e meação conforme o regime. <strong>Não substitui parecer
              jurídico ou tributário.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Cenários salvos */}
      <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <LandmarkIcon className="h-4 w-4 text-primary" />
          <h3 className="text-[10px] font-black uppercase tracking-widest">Cenários salvos</h3>
        </div>
        <div className="divide-y divide-white/5">
          {(scenarios ?? []).map((scenario) => (
            <div key={scenario.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{scenario.name}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                  {scenario.state_code} · {new Date(scenario.created_at ?? "").toLocaleDateString("pt-BR")} ·{" "}
                  {(scenario.entities as { name?: string } | null)?.name ?? "grupo"}
                </p>
              </div>
              <span className="text-xs font-black tabular-nums">{brl(Number(scenario.total_cost ?? 0))}</span>
              <button
                onClick={() => remove.mutate({ id: scenario.id })}
                className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-red-400 transition-colors flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(scenarios ?? []).length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">
              Nenhum cenário salvo. Ajuste as premissas e clique em “Salvar cenário” para comparar depois.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  const tones: Record<string, string> = {
    primary: "text-primary",
    orange: "text-orange-500",
    red: "text-red-500",
    emerald: "text-emerald-500",
  };
  return (
    <div className="glass-card p-4 rounded-2xl space-y-1">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
      <p className={cn("text-lg lg:text-xl font-black tabular-nums", tones[tone])}>{value}</p>
      <p className="text-[10px] text-muted-foreground/60">{detail}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}
