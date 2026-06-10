import { createFileRoute } from "@tanstack/react-router";
import { 
  MapPin, 
  Search, 
  Filter, 
  Layers, 
  Navigation, 
  Maximize2, 
  Building2, 
  Trees, 
  ShieldCheck,
  Zap,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/mapa" as any)({
  component: MapaGlobal,
});

function MapaGlobal() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-6 animate-in fade-in duration-700">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
         <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight uppercase">Cartografia Patrimonial</h2>
            <p className="text-muted-foreground">Geolocalização em tempo real de ativos rurais e urbanos.</p>
         </div>
         <div className="flex gap-3">
            <button className="h-11 px-6 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
               <Layers className="h-4 w-4" />
               Camadas Satélite
            </button>
            <button className="h-11 px-6 bg-primary text-primary-foreground rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
               <Navigation className="h-4 w-4" />
               Roteirizar Inspeção
            </button>
         </div>
      </div>

      <div className="flex-1 relative glass-card rounded-[3rem] overflow-hidden border-white/5 bg-[#0a0a0b]">
         {/* Simulated Map Visual */}
         <div className="absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80')] bg-cover bg-center grayscale brightness-50 contrast-125 opacity-40" />
         
         {/* Map Overlay Grid */}
         <div className="absolute inset-0 z-1 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]" />
         <div className="absolute inset-0 z-1 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(var(--color-primary) 0.5px, transparent 0.5px)', backgroundSize: '30px 30px' }} />

         {/* Map Markers */}
         <MapMarker top="35%" left="42%" label="Fazenda Santa Fé" type="rural" active />
         <MapMarker top="58%" left="65%" label="Edifício Corporate SP" type="urbano" />
         <MapMarker top="42%" left="78%" label="Planta Curitiba" type="urbano" />
         <MapMarker top="65%" left="32%" label="Reserva das Águas" type="rural" />

         {/* UI Overlays */}
         <div className="absolute top-8 left-8 z-10 w-80 space-y-4">
            <div className="glass-card p-4 rounded-3xl bg-background/60 backdrop-blur-md border-white/10 shadow-2xl">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Filtrar coordenadas ou ativos..." 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-primary/50"
                  />
               </div>
            </div>

            <div className="glass-card p-6 rounded-[2rem] bg-background/60 backdrop-blur-md border-white/10 space-y-4 shadow-2xl">
               <h3 className="text-xs font-black uppercase tracking-widest text-primary">Ativo em Destaque</h3>
               <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                     <Trees className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div>
                     <p className="font-bold">Fazenda Santa Fé</p>
                     <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">1.240 ha • Mato Grosso</p>
                     <div className="flex items-center gap-2 mt-2">
                        <div className="h-1.5 w-20 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-primary rounded-full" style={{ width: "98%" }} />
                        </div>
                        <span className="text-[10px] font-black text-primary">98% Compliance</span>
                     </div>
                  </div>
               </div>
               <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Detalhes do Ativo</button>
            </div>
         </div>

         {/* Zoom Controls */}
         <div className="absolute bottom-8 right-8 z-10 flex flex-col gap-2">
            <button className="h-12 w-12 bg-background/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center font-black text-lg hover:bg-white/10 transition-all shadow-xl">+</button>
            <button className="h-12 w-12 bg-background/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center font-black text-lg hover:bg-white/10 transition-all shadow-xl">-</button>
            <button className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 transition-all mt-2">
               <Maximize2 className="h-5 w-5" />
            </button>
         </div>

         {/* Floating IA Banner */}
         <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 glass-card px-8 py-4 rounded-full bg-primary/10 backdrop-blur-xl border-primary/20 flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-3">
               <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground animate-pulse">
                  <Zap className="h-4 w-4" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Análise Predict IA</p>
                  <p className="text-xs font-bold text-foreground">Valorização de +12% estimada para ativos em MT no próximo ciclo.</p>
               </div>
            </div>
            <div className="h-6 w-[1px] bg-primary/20" />
            <button className="text-[10px] font-black uppercase tracking-widest hover:underline flex items-center gap-1 text-primary">
               Ver Dossiê Mercado
               <ChevronRight className="h-3 w-3" />
            </button>
         </div>
      </div>
    </div>
  );
}

function MapMarker({ top, left, label, type, active }: { top: string; left: string; label: string; type: 'rural' | 'urbano'; active?: boolean }) {
  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring" }}
      className="absolute z-5 group cursor-pointer" 
      style={{ top, left }}
    >
       <div className="relative">
          {/* Pulsing ring */}
          {active && (
             <div className="absolute -inset-4 bg-primary/30 rounded-full animate-ping opacity-40" />
          )}
          
          <div className={cn(
            "h-10 w-10 rounded-2xl flex items-center justify-center shadow-2xl transition-all group-hover:scale-110 group-hover:-translate-y-1 relative z-10 border",
            type === 'rural' ? "bg-emerald-500 border-emerald-400 text-white" : "bg-blue-500 border-blue-400 text-white",
            active && "bg-primary border-primary"
          )}>
             <MapPin className="h-5 w-5" />
          </div>

          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 pointer-events-none transition-all opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2 z-20">
             <div className="bg-background/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl whitespace-nowrap shadow-2xl">
                <p className="text-xs font-black uppercase tracking-widest">{label}</p>
                <div className="flex items-center gap-2 mt-1">
                   <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Ativo Regularizado</p>
                </div>
             </div>
             {/* Tooltip arrow */}
             <div className="h-2 w-2 bg-background border-l border-t border-white/10 rotate-45 mx-auto -mt-1" />
          </div>
       </div>
    </motion.div>
  );
}
