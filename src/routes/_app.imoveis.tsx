import { createFileRoute } from "@tanstack/react-router";
import { 
  Building2, 
  Trees, 
  Map as MapIcon, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  MapPin,
  Maximize2,
  FileCheck,
  AlertCircle,
  Loader2,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssets } from "@/hooks/usePatrimonio";

export const Route = createFileRoute("/_app/imoveis")({
  component: GovernancaImobiliaria,
});

function GovernancaImobiliaria() {
  const { data: assets, isLoading } = useAssets();

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const totalVgv = assets?.reduce((sum, a) => sum + (Number(a.value) || 0), 0) || 0;

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black tracking-tight uppercase">Governança de Imóveis</h2>
          <p className="text-muted-foreground mt-2 text-sm lg:text-base">Gestão técnica de ativos rurais e urbanos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="h-11 lg:h-12 px-6 bg-white/5 border border-white/10 rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2">
            <MapIcon className="h-4 w-4" />
            Mapa Global
          </button>
          <button className="h-11 lg:h-12 px-6 bg-primary text-primary-foreground rounded-xl lg:rounded-2xl font-bold text-xs lg:text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Ativo
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
         <AssetStat label="Total de Ativos" value={assets?.length.toString() || "0"} icon={Building2} />
         <AssetStat label="Área Total (Rural)" value="1.2k ha" icon={Trees} />
         <AssetStat label="VGV Estimado" value={`R$ ${(totalVgv / 1000000).toFixed(1)}M`} icon={ArrowUpRight} />
         <AssetStat label="Pendências Téc." value={assets?.filter(a => a.status !== 'regular').length.toString() || "0"} icon={AlertCircle} color="text-orange-500" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 glass-card p-4 rounded-2xl lg:rounded-3xl border-white/5 bg-white/5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="w-full bg-background border-white/10 rounded-xl lg:rounded-2xl py-2.5 lg:py-3 pl-11 pr-4 text-sm focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
           <FilterButton label="Todos" active />
           <FilterButton label="Urbanos" />
           <FilterButton label="Rurais" />
           <FilterButton label="Pendência" />
        </div>
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {assets?.map((prop) => (
          <PropertyCard key={prop.id} property={{
            ...prop,
            type: prop.type === 'rural' ? 'Rural' : 'Urbano',
            status: prop.status === 'regular' ? 'Regular' : 'Pendência',
            health: prop.health_score,
            value: `R$ ${(Number(prop.value) / 1000000).toFixed(1)}M`
          }} />
        ))}
      </div>
    </div>
  );
}

function AssetStat({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <div className="glass-card p-5 lg:p-6 rounded-2xl lg:rounded-[2rem] flex items-center gap-4">
      <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
        <Icon className={cn("h-5 w-5 lg:h-6 lg:w-6", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] lg:text-[10px] font-black uppercase text-muted-foreground tracking-widest truncate">{label}</p>
        <p className="text-lg lg:text-xl font-black mt-0.5 tracking-tight truncate">{value}</p>
      </div>
    </div>
  );
}

function FilterButton({ label, active }: any) {
  return (
    <button className={cn(
      "px-4 py-2 rounded-xl text-[10px] lg:text-xs font-bold transition-all border whitespace-nowrap",
      active 
        ? "bg-primary text-primary-foreground border-primary" 
        : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
    )}>
      {label}
    </button>
  );
}

function PropertyCard({ property }: any) {
  return (
    <div className="glass-card rounded-2xl lg:rounded-[2.5rem] p-6 lg:p-8 space-y-6 lg:space-y-8 group hover:border-primary/20 transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex gap-4 lg:gap-5 min-w-0">
           <div className="h-12 w-12 lg:h-16 lg:w-16 rounded-xl lg:rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {property.type === "Rural" ? <Trees className="h-6 w-6 lg:h-8 lg:w-8 text-emerald-500" /> : <Building2 className="h-6 w-6 lg:h-8 lg:w-8 text-blue-500" />}
           </div>
           <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                 <h4 className="text-lg lg:text-xl font-black tracking-tight truncate">{property.name}</h4>
                 <div className={cn(
                   "px-2 py-0.5 rounded-lg text-[8px] lg:text-[10px] font-black uppercase tracking-widest border shrink-0",
                   property.status === "Regular" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                 )}>
                   {property.status}
                 </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                 <MapPin className="h-3 w-3 shrink-0" />
                 <span className="text-[10px] lg:text-xs font-medium truncate">{property.location}</span>
              </div>
           </div>
        </div>
        <button className="p-2 lg:p-3 hover:bg-white/10 rounded-xl lg:rounded-2xl text-muted-foreground group-hover:text-primary transition-all shrink-0">
           <Maximize2 className="h-4 w-4 lg:h-5 lg:w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 py-4 lg:py-6 border-y border-white/5">
        <div>
           <p className="text-[9px] lg:text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Área</p>
           <p className="text-xs lg:text-sm font-bold mt-1">{property.area || '1.2k ha'}</p>
        </div>
        <div>
           <p className="text-[9px] lg:text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Valor</p>
           <p className="text-xs lg:text-sm font-bold mt-1">{property.value}</p>
        </div>
        <div>
           <p className="text-[9px] lg:text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Saúde Téc.</p>
           <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full" style={{ width: `${property.health}%` }} />
              </div>
              <span className="text-[10px] lg:text-xs font-bold text-primary">{property.health}%</span>
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
         <div className="flex -space-x-2 lg:-space-x-3">
            <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-primary/10 flex items-center justify-center border border-background">
               <FileText className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
            </div>
            <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-blue-500/10 flex items-center justify-center border border-background">
               <FileCheck className="h-4 w-4 lg:h-5 lg:w-5 text-blue-500" />
            </div>
         </div>
         <button className="flex items-center gap-1 lg:gap-2 text-[10px] lg:text-xs font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-all">
            Dossiê
            <ArrowUpRight className="h-3 w-3 lg:h-4 lg:w-4" />
         </button>
      </div>
    </div>
  );
}
