import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  PieChart,
  Building2,
  Network,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntities, useMembers, useShares } from "@/hooks/usePatrimonio";
import { useDeleteMember, useDeleteShare } from "@/hooks/useCrud";
import { MemberForm, type MemberRecord } from "@/components/forms/MemberForm";

export const Route = createFileRoute("/_app/family-office")({
  component: FamilyOffice,
});

function FamilyOffice() {
  const { data: members, isLoading: membersLoading } = useMembers();
  const { data: shares, isLoading: sharesLoading } = useShares();
  const { data: entities } = useEntities();
  const removeMember = useDeleteMember();
  const removeShare = useDeleteShare();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRecord | null>(null);
  const [query, setQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string>("todas");

  const isLoading = membersLoading || sharesLoading;

  const sharesByMember = useMemo(() => {
    const map = new Map<string, { entityName: string; percentage: number; id: string }[]>();
    for (const share of shares ?? []) {
      if (!share.member_id) continue;
      const list = map.get(share.member_id) ?? [];
      list.push({
        id: share.id,
        entityName: (share.entities as { name?: string } | null)?.name ?? "Entidade",
        percentage: Number(share.share_percentage ?? 0),
      });
      map.set(share.member_id, list);
    }
    return map;
  }, [shares]);

  const filteredShares = useMemo(
    () => (shares ?? []).filter((s) => selectedEntity === "todas" || s.entity_id === selectedEntity),
    [shares, selectedEntity],
  );

  /** Sócios que possuem participação na holding selecionada. */
  const memberIdsInEntity = useMemo(() => {
    if (selectedEntity === "todas") return null;
    return new Set(
      (shares ?? [])
        .filter((s) => s.entity_id === selectedEntity && s.member_id)
        .map((s) => s.member_id as string),
    );
  }, [shares, selectedEntity]);

  const visibleMembers = useMemo(() => {
    const term = query.toLowerCase();
    return (members ?? []).filter((m) => {
      const matchesTerm = !term || `${m.full_name} ${m.email ?? ""} ${m.role ?? ""}`.toLowerCase().includes(term);
      const matchesEntity = !memberIdsInEntity || memberIdsInEntity.has(m.id);
      return matchesTerm && matchesEntity;
    });
  }, [members, query, memberIdsInEntity]);

  const stats = useMemo(() => {
    const list = shares ?? [];
    const totalAllocated = list.reduce((sum, s) => sum + Number(s.share_percentage ?? 0), 0);
    const entitiesWithShares = new Set(list.map((s) => s.entity_id));
    return {
      members: members?.length ?? 0,
      shares: list.length,
      totalAllocated: Math.round(totalAllocated),
      covered: entitiesWithShares.size,
      uncovered: (entities ?? []).filter((e) => !entitiesWithShares.has(e.id)).length,
    };
  }, [members, shares, entities]);

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
          <h2 className="text-3xl font-black tracking-tight uppercase">Family Office</h2>
          <p className="text-muted-foreground mt-2 text-sm lg:text-base">
            Estrutura societária real: sócios, papéis e participações por holding.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo sócio
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        <Metric label="Sócios" value={String(stats.members)} detail="No núcleo familiar" icon={Users2} tone="primary" />
        <Metric label="Participações" value={String(stats.shares)} detail={`${stats.totalAllocated}% alocados`} icon={PieChart} tone="blue" />
        <Metric label="Holdings cobertas" value={String(stats.covered)} detail="Com estrutura definida" icon={Building2} tone="emerald" />
        <Metric label="Sem estrutura" value={String(stats.uncovered)} detail="Holdings pendentes" icon={AlertTriangle} tone="orange" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Sócios */}
        <div className="xl:col-span-2 glass-card rounded-[2rem] overflow-hidden border-white/5">
          <div className="p-5 lg:p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" /> Núcleo familiar
            </h3>
            <div className="flex gap-2 flex-1 md:justify-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar sócio…"
                  className="w-full bg-background border border-white/10 rounded-xl py-2 pl-10 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="bg-background border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none"
              >
                <option value="todas">Todas</option>
                {(entities ?? []).map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {visibleMembers.map((member) => {
              const holdings = sharesByMember.get(member.id) ?? [];
              return (
                <div key={member.id} className="p-5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-primary">
                      {member.full_name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold truncate">{member.full_name}</h4>
                      {member.role && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-muted-foreground">
                          {member.role}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {member.email ?? "—"} {member.tax_id ? `· ${member.tax_id}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {holdings.length > 0 ? (
                        holdings.map((holding) => (
                          <span
                            key={holding.id}
                            className="px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary flex items-center gap-1"
                          >
                            {holding.entityName}
                            <span className="tabular-nums">{holding.percentage}%</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-orange-500/80">
                          Sem participação registrada
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setEditing(member as unknown as MemberRecord);
                        setFormOpen(true);
                      }}
                      title="Editar sócio"
                      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remover ${member.full_name} do núcleo familiar?`)) removeMember.mutate({ id: member.id });
                      }}
                      title="Remover sócio"
                      className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {visibleMembers.length === 0 && (
              <div className="p-10 text-center space-y-2">
                <Users2 className="h-9 w-9 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-bold">Nenhum sócio cadastrado</p>
                <p className="text-xs text-muted-foreground">Adicione o primeiro membro do núcleo familiar.</p>
              </div>
            )}
          </div>
        </div>

        {/* Cap table */}
        <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
          <div className="p-5 lg:p-6 border-b border-white/5">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Cap table
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              {selectedEntity === "todas"
                ? "Participações consolidadas"
                : (entities ?? []).find((e) => e.id === selectedEntity)?.name}
            </p>
          </div>
          <div className="divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {filteredShares.map((share) => (
              <div key={share.id} className="p-4 flex items-center gap-3 group">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">
                    {(share.members as { full_name?: string } | null)?.full_name ?? "Sócio"}
                  </p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest truncate">
                    {(share.entities as { name?: string } | null)?.name ?? "Entidade"}
                  </p>
                </div>
                <span className="text-sm font-black tabular-nums text-primary">
                  {Number(share.share_percentage ?? 0)}%
                </span>
                <button
                  onClick={() => {
                    if (confirm("Remover esta participação?")) removeShare.mutate({ id: share.id });
                  }}
                  title="Remover participação"
                  className="h-7 w-7 rounded-lg text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {filteredShares.length === 0 && (
              <div className="p-8 text-center space-y-2">
                <PieChart className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs font-bold">Nenhuma participação</p>
                <p className="text-[10px] text-muted-foreground">
                  Edite um sócio e defina a holding + percentual.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <MemberForm
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

function Metric({ label, value, detail, icon: Icon, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };
  return (
    <div className="glass-card p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] space-y-3">
      <div className={cn("h-10 w-10 rounded-xl border flex items-center justify-center", tones[tone] ?? tones.primary)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
        <p className="text-2xl lg:text-3xl font-black tabular-nums mt-1">{value}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">{detail}</p>
      </div>
    </div>
  );
}
