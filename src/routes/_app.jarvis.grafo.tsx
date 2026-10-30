import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Network, Loader2, Users2, Boxes, Building2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssets, useEntities, useMembers, useShares } from "@/hooks/usePatrimonio";

export const Route = createFileRoute("/_app/jarvis/grafo")({
  component: JarvisGrafo,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Diagrama de relações derivado do banco: sócios → holdings → ativos. */
function JarvisGrafo() {
  const { data: entities, isLoading: entitiesLoading } = useEntities();
  const { data: members, isLoading: membersLoading } = useMembers();
  const { data: shares, isLoading: sharesLoading } = useShares();
  const { data: assets, isLoading: assetsLoading } = useAssets();

  const isLoading = entitiesLoading || membersLoading || sharesLoading || assetsLoading;

  const graph = useMemo(() => {
    const assetByEntity = new Map<string, { count: number; value: number }>();
    for (const a of assets ?? []) {
      if (!a.entity_id) continue;
      const cur = assetByEntity.get(a.entity_id) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(a.value ?? 0);
      assetByEntity.set(a.entity_id, cur);
    }

    const sharesByEntity = new Map<string, { name: string; percentage: number }[]>();
    for (const s of shares ?? []) {
      const entityId = s.entity_id;
      if (!entityId) continue;
      const list = sharesByEntity.get(entityId) ?? [];
      list.push({
        name: (s.members as { full_name?: string } | null)?.full_name ?? "Sócio",
        percentage: Number(s.share_percentage ?? 0),
      });
      sharesByEntity.set(entityId, list);
    }

    return (entities ?? []).map((entity) => ({
      ...entity,
      holders: (sharesByEntity.get(entity.id) ?? []).sort((a, b) => b.percentage - a.percentage),
      assets: assetByEntity.get(entity.id) ?? { count: 0, value: 0 },
      relevantAssets: (assets ?? [])
        .filter((a) => a.entity_id === entity.id)
        .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
        .slice(0, 3),
    }));
  }, [entities, shares, assets]);

  const orphanMembers = useMemo(() => {
    const withShares = new Set((shares ?? []).map((s) => s.member_id));
    return (members ?? []).filter((m) => !withShares.has(m.id));
  }, [members, shares]);

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
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/70">Knowledge graph</p>
          <h2 className="text-3xl lg:text-4xl font-black tracking-tighter uppercase italic flex items-center gap-4">
            <Network className="h-8 w-8 text-primary" />
            Rede patrimonial
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Relações reais do seu tenant: cada sócio, sua participação, a holding e os ativos que ela controla.
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <Pill icon={Users2} label="Sócios" value={String(members?.length ?? 0)} />
          <Pill icon={Boxes} label="Holdings" value={String(entities?.length ?? 0)} />
          <Pill icon={Building2} label="Ativos" value={String(assets?.length ?? 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {graph.map((entity) => (
          <div key={entity.id} className="glass-card rounded-[2rem] p-6 lg:p-8 border border-white/5 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
                  {entity.type ?? "Entidade"}
                </p>
                <h3 className="text-lg font-black truncate">{entity.name}</h3>
                <p className="text-[10px] text-muted-foreground font-mono">{entity.tax_id ?? "CNPJ não informado"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Patrimônio</p>
                <p className="text-lg font-black tabular-nums text-primary">{brl(entity.assets.value)}</p>
                <p className="text-[9px] text-muted-foreground/60">{entity.assets.count} ativos</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
                Estrutura societária
              </p>
              {entity.holders.length > 0 ? (
                <div className="space-y-2">
                  {entity.holders.map((holder) => (
                    <div key={holder.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold w-32 truncate shrink-0">{holder.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                          style={{ width: `${Math.min(100, holder.percentage)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-black tabular-nums w-12 text-right shrink-0">
                        {holder.percentage}%
                      </span>
                    </div>
                  ))}
                  <p
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-widest pt-1",
                      entity.holders.reduce((s, h) => s + h.percentage, 0) === 100
                        ? "text-emerald-500/80"
                        : "text-orange-500/80",
                    )}
                  >
                    Total: {entity.holders.reduce((s, h) => s + h.percentage, 0)}%
                    {entity.holders.reduce((s, h) => s + h.percentage, 0) === 100 ? " · estrutura fechada" : " · atenção"}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma participação registrada — defina os sócios em Family Office.
                </p>
              )}
            </div>

            {entity.relevantAssets.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">
                  Principais ativos
                </p>
                {entity.relevantAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold truncate">{asset.name}</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                      {brl(Number(asset.value ?? 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {graph.length === 0 && (
          <div className="xl:col-span-2 glass-card rounded-[2rem] p-12 text-center space-y-3 border border-white/5">
            <Info className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-bold">Nenhuma entidade no grafo</p>
            <p className="text-xs text-muted-foreground">
              Cadastre uma holding para começar a montar a rede patrimonial.
            </p>
          </div>
        )}
      </div>

      {orphanMembers.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-orange-500/20 bg-orange-500/[0.03] flex items-start gap-3">
          <Info className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold">Sócios sem participação registrada</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {orphanMembers.map((m) => m.full_name).join(", ")} — vincule em Family Office para completar o organograma.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 min-w-[84px]">
      <Icon className="h-3.5 w-3.5 text-primary mx-auto mb-1" />
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-base font-black tabular-nums">{value}</p>
    </div>
  );
}
