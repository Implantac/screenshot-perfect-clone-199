import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MapPin,
  Search,
  Layers,
  Building2,
  Trees,
  ShieldCheck,
  Loader2,
  Car,
  Boxes,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssets } from "@/hooks/usePatrimonio";

export const Route = createFileRoute("/_app/mapa")({
  component: MapaGlobal,
});

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_META: Record<string, { label: string; className: string }> = {
  regular: { label: "Regular", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  pendente: { label: "Pendente", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  alerta: { label: "Alerta", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  critico: { label: "Crítico", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const TYPE_ICON: Record<string, any> = { rural: Trees, urbano: Building2, veiculo: Car, outro: Boxes };

/** Posição estável (sem tiles externos) derivada do nome do ativo. */
function hashPosition(seed: string): { top: number; left: number } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  return { top: 18 + (hash % 60), left: 14 + ((hash >> 3) % 66) };
}

function MapaGlobal() {
  const { data: assets, isLoading } = useAssets();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const term = query.toLowerCase();
    return (assets ?? []).filter((a) => {
      const matchesType = typeFilter === "todos" || a.type === typeFilter;
      const matchesTerm =
        !term ||
        `${a.name} ${a.location ?? ""} ${a.registration_number ?? ""}`.toLowerCase().includes(term);
      return matchesType && matchesTerm;
    });
  }, [assets, query, typeFilter]);

  const selected = useMemo(
    () => visible.find((a) => a.id === selectedId) ?? visible[0] ?? null,
    [visible, selectedId],
  );

  const clusters = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const asset of assets ?? []) {
      const key = (asset.location ?? "Sem localização").split("·")[0].trim();
      const entry = map.get(key) ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += Number(asset.value ?? 0);
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [assets]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const SelectedIcon = selected ? (TYPE_ICON[selected.type ?? "outro"] ?? Boxes) : MapPin;

  return (
    <div className="h-[calc(100vh-140px)] min-h-[600px] flex flex-col gap-5 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">Cartografia Patrimonial</h2>
          <p className="text-muted-foreground text-xs lg:text-sm">
            {assets?.length ?? 0} ativos em {clusters.length} localidades — posições geradas a partir do campo
            “localização” de cada ativo.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["todos", "rural", "urbano", "veiculo", "outro"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                typeFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
              )}
            >
              {type === "todos" ? "Todos" : type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative glass-card rounded-[2rem] overflow-hidden border border-white/5 bg-[#08090b] min-h-[340px]">
          <div
            className="absolute inset-0 opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0.5px, transparent 0.5px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.75)_100%)] pointer-events-none" />

          {visible.map((asset) => {
            const position = hashPosition(asset.name);
            const Icon = TYPE_ICON[asset.type ?? "outro"] ?? Boxes;
            const active = selected?.id === asset.id;
            return (
              <button
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                style={{ top: `${position.top}%`, left: `${position.left}%` }}
                className="absolute z-10 group -translate-x-1/2 -translate-y-1/2"
              >
                {active && <span className="absolute -inset-3 rounded-full bg-primary/25 animate-ping opacity-40" />}
                <span
                  className={cn(
                    "relative flex h-9 w-9 items-center justify-center rounded-xl border shadow-2xl transition-all group-hover:scale-110",
                    active
                      ? "bg-primary border-primary text-primary-foreground"
                      : asset.type === "rural"
                        ? "bg-emerald-500/90 border-emerald-400 text-white"
                        : asset.type === "urbano"
                          ? "bg-blue-500/90 border-blue-400 text-white"
                          : "bg-white/15 border-white/30 text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-background/90 border border-white/10 px-2 py-1 text-[9px] font-bold tracking-wide transition-opacity",
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  {asset.name}
                </span>
              </button>
            );
          })}

          {visible.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <MapPin className="h-9 w-9 text-muted-foreground/40" />
              <p className="text-sm font-bold">Nenhum ativo para exibir</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Cadastre ativos com o campo “localização” preenchido para vê-los no mapa.
              </p>
            </div>
          )}

          {/* Busca */}
          <div className="absolute top-4 left-4 right-4 lg:right-auto lg:w-80 z-20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por ativo, cidade ou matrícula…"
                className="w-full bg-background/80 backdrop-blur border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Detalhe do ativo */}
          {selected && (
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto lg:w-96 z-20 glass-card rounded-2xl p-4 bg-background/85 backdrop-blur border border-white/10 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <SelectedIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{selected.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest truncate">
                    {[selected.location, selected.area].filter(Boolean).join(" · ") || "Sem localização"}
                  </p>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0",
                    (STATUS_META[selected.status ?? "pendente"] ?? STATUS_META.pendente).className,
                  )}
                >
                  {(STATUS_META[selected.status ?? "pendente"] ?? STATUS_META.pendente).label}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> Health {selected.health_score ?? "—"}
                </span>
                <span className="text-foreground tabular-nums text-sm font-black">{brl(selected.value)}</span>
              </div>
              {selected.registration_number && (
                <p className="text-[9px] font-mono text-muted-foreground/60 truncate">
                  matrícula {selected.registration_number}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lista / agrupamento */}
        <div className="lg:w-80 shrink-0 glass-card rounded-[2rem] border border-white/5 overflow-hidden flex flex-col max-h-[60vh] lg:max-h-none">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Localidades</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {clusters.map(([location, info]) => (
              <button
                key={location}
                onClick={() => setQuery(location.split(" ")[0] ?? "")}
                className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">{location}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                    {info.count} {info.count === 1 ? "ativo" : "ativos"}
                  </p>
                </div>
                <span className="text-[10px] font-black tabular-nums text-primary shrink-0">{brl(info.value)}</span>
              </button>
            ))}
            {clusters.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma localidade registrada.</div>
            )}
          </div>
          <div className="p-3 border-t border-white/5">
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
              Mapa esquemático: não usamos tiles de terceiros. Cada marcador é posicionado de forma determinística
              a partir do nome do ativo; a geocodificação real exigiria um provedor de mapas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
