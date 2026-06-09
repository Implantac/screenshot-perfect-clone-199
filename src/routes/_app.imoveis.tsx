import { createFileRoute } from "@tanstack/react-router";
import { 
  Building2, 
  Trees, 
  Map as MapIcon, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpRight, 
  MapPin,
  Maximize2,
  FileCheck,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/imoveis")({
  component: GovernancaImobiliaria,
});

const properties = [
  { id: 1, name: "Fazenda Santa Fé", type: "Rural", area: "1.240 ha", location: "Mato Grosso", status: "Regular", health: 98, value: "R$ 42.5M" },
  { id: 2, name: "Edifício Corporate SP", type: "Urbano", area: "12.000 m²", location: "São Paulo, SP", status: "Pendência", health: 74, value: "R$ 88.0M" },
  { id: 3, name: "Planta Industrial Curitiba", type: "Urbano", area: "45.000 m²", location: "Curitiba, PR", status: "Regular", health: 92, value: "R$ 32.2M" },
  { id: 4, name: "Reserva das Águas", type: "Rural", area: "450 ha", location: "Minas Gerais", status: "Regular", health: 95, value: "R$ 12.8M" },
];

function GovernancaImobiliaria() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Governança de Imóveis</h2>
          <p className="text-muted-foreground mt-2">Gestão técnica de ativos rurais e urbanos, matrículas e regularização.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2">
            <MapIcon className="h-4 w-4" />
            Mapa Global
          </button>
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Ativo
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <AssetStat label="Total de Ativos" value="32" icon={Building2} />
         <AssetStat label="Área Total (Rural)" value="12.4k ha" icon={Trees} />
         <AssetStat label="VGV Estimado" value="R$ 175M" icon={ArrowUpRight} />
         <AssetStat label="Pendências Téc." value="05" icon={AlertCircle} color="text-orange-500" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4 rounded-3xl border-white/5 bg-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Buscar por matrícula, nome ou proprietário..." 
            className="w-full bg-background border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2">
           <FilterButton label="Todos" active />
           <FilterButton label="Urbanos" />
           <FilterButton label="Rurais" />
           <FilterButton label="Com Pendência" />
        </div>
      </div>

      {/* Property Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {properties.map((prop) => (
          <PropertyCard key={prop.id} property={prop} />
        ))}
      </div>
    </div>
  );
}

function AssetStat({ label, value, icon: Icon, color = "text-foreground" }: any) {
  return (
    <div className="glass-card p-6 rounded-[2rem] flex items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
        <Icon className={cn("h-6 w-6", color)} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
        <p className="text-xl font-black mt-0.5 tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function FilterButton({ label, active }: any) {
  return (
    <button className={cn(
      "px-5 py-2.5 rounded-xl text-xs font-bold transition-all border",
      active 
        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
        : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
    )}>
      {label}
    </button>
  );
}

function PropertyCard({ property }: any) {
  return (
    <div className="glass-card rounded-[2.5rem] p-8 space-y-8 group hover:border-primary/20 transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex gap-5">
           <div className="h-16 w-16 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              {property.type === "Rural" ? <Trees className="h-8 w-8 text-emerald-500" /> : <Building2 className="h-8 w-8 text-blue-500" />}
           </div>
           <div className="space-y-1">
              <div className="flex items-center gap-2">
                 <h4 className="text-xl font-black tracking-tight">{property.name}</h4>
                 <div className={cn(
                   "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                   property.status === "Regular" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                 )}>
                   {property.status}
                 </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                 <MapPin className="h-3 w-3" />
                 <span className="text-xs font-medium">{property.location}</span>
              </div>
           </div>
        </div>
        <button className="p-3 hover:bg-white/10 rounded-2xl text-muted-foreground group-hover:text-primary transition-all">
           <Maximize2 className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 py-6 border-y border-white/5">
        <div>
           <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Área</p>
           <p className="text-sm font-bold mt-1">{property.area}</p>
        </div>
        <div>
           <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Valor de Mercado</p>
           <p className="text-sm font-bold mt-1">{property.value}</p>
        </div>
        <div>
           <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Saúde Téc.</p>
           <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full" style={{ width: `${property.health}%` }} />
              </div>
              <span className="text-xs font-bold text-primary">{property.health}%</span>
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
         <div className="flex -space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-background">
               <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-background">
               <FileCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center border border-background text-[10px] font-bold text-muted-foreground">
               +12
            </div>
         </div>
         <button className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary uppercase tracking-widest transition-all">
            Dossiê Completo
            <ArrowUpRight className="h-4 w-4" />
         </button>
      </div>
    </div>
  );
}
