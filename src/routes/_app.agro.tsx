import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  CloudRain,
  FileWarning,
  Leaf,
  Loader2,
  Sprout,
  Tractor,
  Trees,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMissingTableError,
  useAgroBarters,
  useAgroEnvironmental,
  useAgroFields,
  useAgroLeases,
} from "@/hooks/usePatrimonio";
import {
  BIOME_LABELS,
  CAR_STATUS_LABELS,
  CROP_LABELS,
  CROP_UNITS,
  DEFAULT_AGRO_ASSUMPTIONS,
  LEASE_ROLE_LABELS_MAP,
  analyzeSaf,
  buildAgroReport,
  type AgroCrop,
} from "@/lib/agro/agro";

export const Route = createFileRoute("/_app/agro")({
  component: Agro,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return brl(value);
};
const pct = (value: number, digits = 1) => `${value.toFixed(digits).replace(".", ",")}%`;
const ha = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ha`;
const num = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Agro() {
  const { data: fields, error: fieldsError, isLoading } = useAgroFields();
  const { data: leases } = useAgroLeases();
  const { data: barters } = useAgroBarters();
  const { data: environments } = useAgroEnvironmental();

  const [safArea, setSafArea] = useState(50);
  const [safImplementation, setSafImplementation] = useState(12_000);
  const [safAlternative, setSafAlternative] = useState(2_000);

  const report = useMemo(
    () =>
      buildAgroReport({
        fields: (fields ?? []).map((field) => ({
          id: field.id,
          name: field.name,
          area_ha: field.area_ha,
          crop: field.crop as AgroCrop,
          productivity_sc_ha: field.productivity_sc_ha,
          cost_per_ha: field.cost_per_ha,
          season: field.season,
        })),
        leases: (leases ?? []).map((lease) => ({
          id: lease.id,
          role: lease.role,
          counterparty: lease.counterparty,
          area_ha: lease.area_ha,
          payment: lease.payment,
          price_per_ha_year: lease.price_per_ha_year,
          bags_per_ha: lease.bags_per_ha,
          share_percent: lease.share_percent,
          ends_on: lease.ends_on,
        })),
        barters: (barters ?? []).map((barter) => ({
          id: barter.id,
          supplier: barter.supplier,
          season: barter.season,
          input_value: barter.input_value,
          bags_due: barter.bags_due,
          bag_reference_price: barter.bag_reference_price,
          area_ha: barter.area_ha,
          months_to_delivery: barter.months_to_delivery,
        })),
        environments: (environments ?? []).map((env) => ({
          id: env.id,
          total_ha: env.total_ha,
          biome: env.biome,
          in_legal_amazon: env.in_legal_amazon,
          legal_reserve_declared_ha: env.legal_reserve_declared_ha,
          app_ha: env.app_ha,
          car_number: env.car_number,
          car_status: env.car_status,
        })),
      }),
    [fields, leases, barters, environments],
  );

  const saf = useMemo(
    () =>
      analyzeSaf({
        areaHa: safArea,
        implementationCostPerHa: safImplementation,
        maintenanceCostPerHaYear: 2_400,
        alternativeMarginPerHa: safAlternative,
        discountRateAnnual: DEFAULT_AGRO_ASSUMPTIONS.discountRateAnnual,
        horizonYears: 20,
        species: [
          { name: "Banana", firstHarvestYear: 2, yieldPerHa: 5_000, pricePerUnit: 1.2, rampYears: 2 },
          { name: "Mandioca", firstHarvestYear: 1, yieldPerHa: 6_000, pricePerUnit: 0.7, lastHarvestYear: 3 },
          { name: "Madeira", firstHarvestYear: 12, yieldPerHa: 180, pricePerUnit: 200, rampYears: 3 },
        ],
      }),
    [safArea, safImplementation, safAlternative],
  );

  if (isMissingTableError(fieldsError)) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="glass-card rounded-[2rem] border border-amber-500/20 p-8">
          <FileWarning className="mb-3 h-6 w-6 text-amber-400" />
          <h1 className="font-display text-xl font-black uppercase tracking-tight">
            Falta aplicar a migration do agro
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Rode <code className="rounded bg-white/10 px-1">supabase/APLICAR-TUDO.sql</code> (wave 19) e
            recarregue. Depois crie os talhões e a fazenda passa a ter margem, custo por saca e
            ponto de equilíbrio.
          </p>
        </div>
      </div>
    );
  }

  const hasData = report.margins.fields.length > 0 || report.leases.leases.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Operação agrícola
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Agro</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            A fazenda deixa de ser "ativo rural" e passa a ter <strong>margem por talhão</strong>,{" "}
            <strong>custo por saca</strong>, <strong>taxa implícita do barter</strong> e{" "}
            <strong>passivo ambiental</strong>. Toda premissa está declarada ao lado do número.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {[
            { label: "Terra nua", value: `${brl(DEFAULT_AGRO_ASSUMPTIONS.landValuePerHa)}/ha` },
            { label: "Soja", value: `${brl(DEFAULT_AGRO_ASSUMPTIONS.soyPricePerBag)}/sc` },
            { label: "TMA", value: pct(DEFAULT_AGRO_ASSUMPTIONS.discountRateAnnual * 100, 0) },
            { label: "Crédito", value: pct(DEFAULT_AGRO_ASSUMPTIONS.bankRateAnnual * 100, 0) },
          ].map((chip) => (
            <span
              key={chip.label}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-muted-foreground"
            >
              {chip.label} <strong className="text-foreground">{chip.value}</strong>
            </span>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="glass-card flex items-center justify-center rounded-[2rem] border border-white/5 p-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !hasData ? (
        <div className="glass-card rounded-[2rem] border border-white/5 p-10 text-center">
          <Sprout className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm font-bold">Nenhum talhão cadastrado</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
            Crie talhões com área, cultura, produtividade e custo por hectare. Sem isso, a fazenda é
            só um valor de laudo.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Receita da safra",
                value: compact(report.kpis.revenue),
                hint: `${ha(report.kpis.areaHa)} · custo ${compact(report.margins.totals.cost)}`,
                icon: Tractor,
                tone: "text-foreground",
              },
              {
                label: "Margem bruta",
                value: compact(report.kpis.margin),
                hint: `${brl(report.kpis.marginPerHa)}/ha · custo ${brl(report.kpis.costPerBag)}/saca`,
                icon: Banknote,
                tone: report.kpis.margin > 0 ? "text-emerald-400" : "text-red-400",
              },
              {
                label: "Valor da terra",
                value: compact(report.kpis.landValue),
                hint: `renda de arrendamento ${compact(report.kpis.rentIncome)}/ano`,
                icon: Trees,
                tone: "text-foreground",
              },
              {
                label: "Passivo ambiental",
                value: compact(report.kpis.environmentalPassive),
                hint: "recomposição de reserva legal exigida",
                icon: Leaf,
                tone: report.kpis.environmentalPassive > 0 ? "text-amber-400" : "text-emerald-400",
              },
            ].map((card) => (
              <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <card.icon className="h-3 w-3" /> {card.label}
                </div>
                <p className={cn("mt-2 truncate text-xl font-black tabular-nums", card.tone)}>
                  {card.value}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>

          {report.warnings.length > 0 ? (
            <div className="space-y-2">
              {report.warnings.map((warning) => (
                <div
                  key={warning}
                  className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}

          <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest">Margem por talhão</h2>
              <span className="text-[10px] text-muted-foreground">
                ponto de equilíbrio é a régua: abaixo dele a safra trabalha de graça
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    <th className="px-4 py-2">Talhão</th>
                    <th className="px-4 py-2 text-right">Área</th>
                    <th className="px-4 py-2 text-right">Prod.</th>
                    <th className="px-4 py-2 text-right">Receita</th>
                    <th className="px-4 py-2 text-right">Custo</th>
                    <th className="px-4 py-2 text-right">Margem</th>
                    <th className="px-4 py-2 text-right">Margem/ha</th>
                    <th className="px-4 py-2 text-right">Preço mín.</th>
                    <th className="px-4 py-2 text-right">Prod. mín.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {report.margins.fields.map((row) => (
                    <tr key={row.id} className="text-[11px] hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <p className="font-bold">{row.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {row.cropLabel} · {CROP_UNITS[row.crop]}
                          {row.season ? ` · ${row.season}` : ""}
                          {row.nonTraded ? " · sem receita de lavoura" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {ha(row.areaHa)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.nonTraded ? "—" : `${num(row.productivity, 0)} ${CROP_UNITS[row.crop]}/ha`}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{compact(row.revenue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {compact(row.cost)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right font-bold tabular-nums",
                          row.nonTraded ? "text-muted-foreground/60" : row.margin > 0 ? "text-emerald-400" : "text-red-400",
                        )}
                      >
                        {compact(row.margin)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.nonTraded ? "—" : brl(row.marginPerHa)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {row.breakEvenPrice > 0 ? brl(row.breakEvenPrice) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {row.breakEvenProductivity > 0
                          ? `${num(row.breakEvenProductivity, 1)} ${CROP_UNITS[row.crop]}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
              <div className="flex items-center justify-between border-b border-white/5 p-4">
                <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <CloudRain className="h-3 w-3" /> Stress da safra
                </h2>
                <span className="text-[10px] text-muted-foreground">seca, preço e custo</span>
              </div>
              <div className="divide-y divide-white/5">
                {report.stress.map((scenario) => (
                  <div key={scenario.id} className="flex items-start justify-between gap-3 p-3.5">
                    <div>
                      <p className="text-[11px] font-bold">{scenario.label}</p>
                      <p className="text-[10px] text-muted-foreground">{scenario.thesis}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-black tabular-nums",
                          scenario.margin > 0 ? "text-foreground" : "text-red-400",
                        )}
                      >
                        {compact(scenario.margin)}
                      </p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {scenario.deltaVsBase >= 0 ? "+" : "−"}
                        {compact(Math.abs(scenario.deltaVsBase))} vs. base
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <h2 className="text-[10px] font-black uppercase tracking-widest">
                Arrendar ou produzir?
              </h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                A comparação que o produtor faz no guardanapo, feita com número.
              </p>
              {report.leases.produceVsLease ? (
                <div className="mt-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                        Margem da lavoura
                      </p>
                      <p className="text-sm font-black tabular-nums">
                        {brl(report.leases.produceVsLease.cropMarginPerHa)}/ha
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                        Renda do arrendamento
                      </p>
                      <p className="text-sm font-black tabular-nums">
                        {brl(report.leases.produceVsLease.rentPerHa)}/ha
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-[11px] font-black uppercase tracking-wider",
                      report.leases.produceVsLease.verdict === "produzir"
                        ? "text-emerald-400"
                        : report.leases.produceVsLease.verdict === "arrendar"
                          ? "text-amber-400"
                          : "text-muted-foreground",
                    )}
                  >
                    Veredito: {report.leases.produceVsLease.verdict} · diferença de{" "}
                    {brl(Math.abs(report.leases.produceVsLease.spreadPerHa))}/ha
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Sem talhão com margem e sem arrendamento cadastrado não há comparação.
                </p>
              )}

              <div className="mt-3 space-y-2">
                {report.leases.leases.map((lease) => (
                  <div key={lease.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[11px] font-bold">
                        {LEASE_ROLE_LABELS_MAP[lease.role]} · {lease.counterparty ?? "sem contraparte"}
                      </p>
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {ha(lease.areaHa)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
                      <span>renda {brl(lease.annualRent)}/ano</span>
                      <span>{brl(lease.rentPerHa)}/ha</span>
                      <span>{pct(lease.capRate, 2)} de cap rate</span>
                      {lease.bagsPerHa > 0 ? <span>{num(lease.bagsPerHa, 1)} sc/ha</span> : null}
                    </div>
                    {lease.warnings.map((warning) => (
                      <p key={warning} className="mt-1 text-[10px] text-amber-400/90">
                        {warning}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {report.barters.length > 0 ? (
            <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4">
                <h2 className="text-[10px] font-black uppercase tracking-widest">
                  Barter: a taxa escondida
                </h2>
                <span className="text-[10px] text-muted-foreground">
                  comparado ao crédito de {pct(DEFAULT_AGRO_ASSUMPTIONS.bankRateAnnual * 100, 0)} a.a.
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      <th className="px-4 py-2">Fornecedor</th>
                      <th className="px-4 py-2 text-right">Insumo à vista</th>
                      <th className="px-4 py-2 text-right">Sacas</th>
                      <th className="px-4 py-2 text-right">Na entrega</th>
                      <th className="px-4 py-2 text-right">Sobrepreço</th>
                      <th className="px-4 py-2 text-right">Taxa implícita</th>
                      <th className="px-4 py-2 text-right">Veredito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {report.barters.map((barter) => (
                      <tr key={barter.id} className="text-[11px] hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-bold">
                          {barter.supplier ?? "—"}
                          {barter.season ? (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              {barter.season}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{compact(barter.inputValue)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                          {num(barter.bagsDue, 0)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {compact(barter.valueAtDelivery)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-amber-400">
                          {compact(barter.overcost)} ({pct(barter.overcostPct)})
                        </td>
                        <td className="px-4 py-2 text-right font-bold tabular-nums">
                          {pct(barter.impliedRateAnnual)} a.a.
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                              barter.verdict === "banco_melhor"
                                ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                : barter.verdict === "barter_melhor"
                                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                  : "border-white/10 bg-white/5 text-muted-foreground",
                            )}
                          >
                            {barter.verdict === "banco_melhor"
                              ? "banco sai melhor"
                              : barter.verdict === "barter_melhor"
                                ? "barter vale"
                                : "indiferente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-white/5 px-4 py-2 text-[10px] text-muted-foreground">
                A taxa implícita é (valor na entrega ÷ valor à vista)^(12/meses) − 1. O barter pode ser
                caro e ainda ser a decisão certa: ele trava o preço da saca e dispensa garantia real.
              </p>
            </section>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                  <Trees className="h-3 w-3" /> SAF — simulador
                </h2>
                <span className="text-[10px] text-muted-foreground">banana + mandioca + madeira</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: "Área (ha)", value: safArea, set: setSafArea, step: 10 },
                  { label: "Implantação (R$/ha)", value: safImplementation, set: setSafImplementation, step: 1000 },
                  { label: "Margem soja (R$/ha)", value: safAlternative, set: setSafAlternative, step: 200 },
                ].map((input) => (
                  <label key={input.label} className="block">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      {input.label}
                    </span>
                    <input
                      type="number"
                      step={input.step}
                      value={input.value}
                      onChange={(event) => input.set(Number(event.target.value) || 0)}
                      className="mt-1 h-9 w-full rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] tabular-nums"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                {[
                  { label: "VPL do SAF", value: compact(saf.npv) },
                  { label: "VPL da soja", value: compact(saf.npvAlternative) },
                  { label: "TIR", value: saf.irr === null ? "—" : pct(saf.irr) },
                  { label: "Payback", value: saf.paybackYear === null ? "—" : `${saf.paybackYear} anos` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-white/[0.03] p-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                      {item.label}
                    </p>
                    <p className="text-sm font-black tabular-nums">{item.value}</p>
                  </div>
                ))}
              </div>
              <p
                className={cn(
                  "mt-2 text-[11px] font-black uppercase tracking-wider",
                  saf.verdict === "saf"
                    ? "text-emerald-400"
                    : saf.verdict === "alternativa"
                      ? "text-amber-400"
                      : "text-muted-foreground",
                )}
              >
                {saf.verdict === "saf"
                  ? "SAF cria mais valor que a lavoura no horizonte de 20 anos"
                  : saf.verdict === "alternativa"
                    ? "A lavoura ainda paga mais: o SAF só vence com prêmio de carbono ou terra valorizada"
                    : "Empate técnico entre SAF e lavoura"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {saf.crossoverYear === null
                  ? "Sem cruzamento no horizonte: o SAF nunca alcança a soja nestes parâmetros."
                  : `O SAF supera a soja no acumulado a partir do ano ${saf.crossoverYear}.`}{" "}
                Simulação local — nada é gravado.
              </p>
            </section>

            <section className="glass-card rounded-[2rem] border border-white/5 p-4">
              <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <Leaf className="h-3 w-3" /> Passivo ambiental por propriedade
              </h2>
              {report.environment.length === 0 ? (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Sem CAR cadastrado não há como medir reserva legal — e sem isso a propriedade não
                  acessa crédito rural.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {report.environment.map((env, index) => {
                    const asset = (environments ?? [])[index];
                    return (
                      <div
                        key={`${env.biome}-${index}`}
                        className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[11px] font-bold">
                            {asset?.assets?.name ?? `${BIOME_LABELS[env.biome]} · ${ha(env.totalHa)}`}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                              env.carStatus === "ativo"
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-400",
                            )}
                          >
                            {env.carStatus ? CAR_STATUS_LABELS[env.carStatus] : "sem CAR"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
                          <span>{BIOME_LABELS[env.biome]}</span>
                          <span>exige {pct(env.requiredPct, 0)} = {ha(env.requiredHa)}</span>
                          <span>declarado {ha(env.declaredHa)}</span>
                          <span>APP {ha(env.appHa)}</span>
                          <span>utilizável {pct(env.usablePct, 0)}</span>
                        </div>
                        {env.deficitHa > 0 ? (
                          <p className="mt-1 text-[10px] text-red-400">
                            déficit de {ha(env.deficitHa)} → recomposição {compact(env.reCompositionCost)}
                          </p>
                        ) : env.surplusHa > 0 ? (
                          <p className="mt-1 text-[10px] text-emerald-400">
                            excedente de {ha(env.surplusHa)} → pode virar CRA
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
