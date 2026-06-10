import { createFileRoute } from "@tanstack/react-router";
import { 
  Boxes, 
  Users2, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight, 
  GitBranch, 
  Building, 
  PieChart,
  ExternalLink,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/holdings")({
  component: HoldingsSocietario,
});

const holdings = [
  { id: 1, name: "Holding Alencar S.A.", entities: 8, value: "R$ 142.5M", type: "Familiar", participation: "100%", health: 96 },
  { id: 2, name: "Agroinvest Participações", entities: 4, value: "R$ 54.2M", type: "Investimento", participation: "75%", health: 82 },
  { id: 3, name: "SP Urbanismo Ltda", entities: 2, value: "R$ 52.0M", type: "Imobiliária", participation: "100%", health: 92 },
];

function HoldingsSocietario() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Engenharia Societária</h2>
          <p className="text-muted-foreground mt-2">Visão 360° de Holdings, controladas e participações diretas.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Estrutura
          </button>
        </div>
      </div>

      {/* Corporate Landscape */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         {/* Main Chart Card */}
         <div className="xl:col-span-2 glass-card rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent">
            <div className="flex items-center justify-between relative z-10">
               <div className="space-y-1">
                  <h3 className="text-xl font-bold">Organograma Interativo</h3>
                  <p className="text-sm text-muted-foreground">Clique para expandir níveis e ver participações</p>
               </div>
               <button className="p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                  <ExternalLink className="h-5 w-5 text-muted-foreground" />
               </button>
            </div>

            {/* Simulated Org Chart Visual */}
            <div className="h-[400px] flex items-center justify-center relative z-10">
               <div className="relative space-y-12">
                  <div className="mx-auto w-48 p-4 bg-primary text-primary-foreground rounded-2xl text-center shadow-xl shadow-primary/20 relative z-20">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Controladora</p>
                     <p className="text-sm font-bold truncate">Holding Alencar</p>
                  </div>
                  
                  <div className="flex gap-8 relative">
                     {/* Lines */}
                     <div className="absolute top-[-24px] left-1/2 w-[calc(100%-48px)] h-6 border-x border-t border-white/10 -translate-x-1/2" />
                     <div className="absolute top-[-24px] left-1/2 h-6 border-l border-white/10" />
                     
                     <OrgNode label="Agroinvest" perc="75%" color="border-emerald-500/30" />
                     <OrgNode label="SP Urbanismo" perc="100%" color="border-blue-500/30" />
                     <OrgNode label="Invest S.A." perc="40%" color="border-orange-500/30" />
                  </div>
               </div>
            </div>

            {/* Decorative background elements */}
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-background to-transparent pointer-events-none" />
         </div>

         {/* Sidebar Stats */}
         <div className="space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
               <h3 className="text-lg font-bold">Snapshot Corporativo</h3>
               <div className="space-y-5">
                  <CorporateMetric label="Empresas Controladas" val="14" icon={Building} />
                  <CorporateMetric label="Sócios Totais" val="12" icon={Users2} />
                  <CorporateMetric label="VGV Sob Gestão" val="R$ 482.5M" icon={TrendingUp} />
               </div>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
               <h3 className="text-lg font-bold">Saúde Societária</h3>
               <div className="flex items-center gap-6">
                  <div className="relative h-24 w-24">
                     <svg className="h-full w-full" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="oklch(1 0 0 / 0.05)" strokeWidth="4" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeDasharray="92, 100" strokeLinecap="round" />
                     </svg>
                     <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black">92%</span>
                     </div>
                  </div>
                  <div className="flex-1 space-y-2">
                     <p className="text-xs text-muted-foreground leading-relaxed">Sua estrutura societária possui <span className="text-foreground font-bold">92% de conformidade</span> documental.</p>
                     <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center gap-1">
                        Corrigir Pendências
                        <ArrowRight className="h-3 w-3" />
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Holdings List */}
      <div className="space-y-6">
         <h3 className="text-xl font-bold">Portfólio de Holdings</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {holdings.map((h) => (
               <div key={h.id} className="glass-card rounded-[2.5rem] p-8 space-y-6 group hover:border-primary/20 transition-all cursor-pointer">
                  <div className="flex items-start justify-between">
                     <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center group-hover:bg-primary/5 transition-all">
                        <Boxes className="h-7 w-7 text-muted-foreground group-hover:text-primary transition-all" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                        {h.type}
                     </span>
                  </div>
                  <div>
                     <h4 className="text-xl font-black tracking-tight">{h.name}</h4>
                     <p className="text-xs text-muted-foreground mt-1">{h.entities} Entidades controladas</p>
                  </div>
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                     <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Patrimônio</p>
                        <p className="text-sm font-black text-foreground mt-0.5">{h.value}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Controle</p>
                        <p className="text-sm font-black text-primary mt-0.5">{h.participation}</p>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}

function OrgNode({ label, perc, color }: any) {
  return (
    <div className={cn("w-36 p-3 bg-white/5 border rounded-xl text-center backdrop-blur-md relative", color)}>
       <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
       <p className="text-xs font-black text-primary mt-1">{perc}</p>
       {/* Small line indicator */}
       <div className="absolute bottom-[-16px] left-1/2 w-4 h-[1px] bg-white/10 -translate-x-1/2 rotate-90" />
    </div>
  );
}

function CorporateMetric({ label, val, icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer">
       <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
             <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
       </div>
       <span className="text-sm font-black text-foreground">{val}</span>
    </div>
  );
}
