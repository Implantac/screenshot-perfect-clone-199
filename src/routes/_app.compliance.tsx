import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertCircle, FileText, ArrowRight, Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntities } from "@/hooks/usePatrimonio";

export const Route = createFileRoute("/_app/compliance")({
  component: Compliance,
});


function Compliance() {
  const { data: entities, isLoading } = useEntities();

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const avgCompliance = entities && entities.length > 0 
    ? entities.reduce((sum, ent) => sum + (Number(ent.compliance_score) || 0), 0) / entities.length 
    : 0;

  return (
    <div className="space-y-12 animate-in fade-in duration-1000 overflow-x-hidden relative">
      <div className="fixed inset-0 noise-overlay opacity-[0.015] pointer-events-none" />
      
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-white/[0.05] executive-grid">
        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-black uppercase tracking-[0.4em] text-primary backdrop-blur-md">
            <ShieldCheck className="h-3 w-3" />
            Active Regulatory Shield
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Status de <span className="text-primary">Compliance</span></h2>
          <p className="text-muted-foreground text-lg font-medium italic opacity-70">Auditoria neural contínua e gestão de conformidade institucional.</p>
        </div>
        
        <div className="glass-card p-6 md:p-8 rounded-[2.5rem] flex items-center gap-8 border-primary/20 bg-primary/[0.02] shadow-2xl relative z-10">
           <div className="text-right">
              <p className="text-[10px] uppercase font-black text-primary/70 tracking-[0.3em] mb-1 italic">Score Global</p>
              <p className="text-4xl font-black text-foreground italic tabular-nums leading-none">{avgCompliance.toFixed(1)} <span className="text-xs opacity-30">%</span></p>
           </div>
           <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-xl">
              <ShieldCheck className="h-8 w-8 drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
           </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 glass-card rounded-[3.5rem] p-10 md:p-14 space-y-12 relative overflow-hidden group">
            <div className="absolute inset-0 executive-grid opacity-20 pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter leading-none">Protocolos de Verificação</h3>
              <button className="text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:text-white transition-colors">Solicitar Auditoria Full</button>
            </div>
            
            <div className="space-y-6 relative z-10">
               <ComplianceRow label="Certidão Negativa Tributos Federais" status="Regular" date="Val. 12/08/2026" ok />
               <ComplianceRow label="Certidão Negativa Trabalhista (BNDT)" status="Regular" date="Val. 05/09/2026" ok />
               <ComplianceRow label="Certidão de Débitos Estaduais (SEFAZ)" status="Urgência" date="Expira em 48h" alert />
               <ComplianceRow label="Regularidade junto ao FGTS (CRF)" status="Regular" date="Val. 30/07/2026" ok />
               <ComplianceRow label="Certidão Negativa de Protestos" status="Regular" date="Val. 15/10/2026" ok />
            </div>
         </div>

         <div className="glass-card rounded-[3.5rem] p-10 md:p-14 space-y-12 relative overflow-hidden">
            <div className="absolute inset-0 executive-grid opacity-20 pointer-events-none" />
            <h3 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-4 leading-none relative z-10">
               <Activity className="h-6 w-6 text-primary animate-pulse" />
               Entity Health
            </h3>
            <div className="space-y-8 relative z-10">
               {entities?.map((ent) => (
                 <EntityProgress key={ent.id} label={ent.name} val={Number(ent.compliance_score) || 0} />
               ))}
               {(!entities || entities.length === 0) && (
                 <p className="text-xs text-muted-foreground italic font-medium">Nenhuma entidade monitorada.</p>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

function ComplianceRow({ label, status, date, ok, alert }: any) {
   return (
      <div className="flex items-center justify-between p-6 lg:p-8 rounded-[2rem] bg-white/[0.01] border border-white/[0.05] hover:border-primary/30 transition-all duration-500 group cursor-pointer backdrop-blur-xl">
         <div className="flex items-center gap-6">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center border transition-all duration-500",
              ok ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-500" : 
              alert ? "bg-red-500/5 border-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]" : 
              "bg-white/5 border-white/10 text-muted-foreground"
            )}>
              {ok ? <CheckCircle2 className="h-6 w-6" /> : alert ? <ShieldAlert className="h-6 w-6 animate-pulse" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <div>
               <p className="text-base lg:text-lg font-black italic uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{label}</p>
               <p className="text-[10px] text-muted-foreground/40 font-black mt-2 uppercase tracking-[0.3em] italic">{date}</p>
            </div>
         </div>
         <span className={cn(
            "text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border transition-all duration-500",
            ok ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-500" : 
            alert ? "bg-red-500/5 border-red-500/20 text-red-500" : 
            "bg-white/5 border-white/10 text-muted-foreground"
         )}>
            {status}
         </span>
      </div>
   );
}

function EntityProgress({ label, val }: { label: string; val: number }) {
   return (
      <div className="space-y-4 group cursor-default">
         <div className="flex justify-between items-end">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/50 italic leading-none block">Protocolo</span>
              <span className="text-sm font-black italic uppercase tracking-tight text-white/80 group-hover:text-primary transition-colors">{label}</span>
            </div>
            <span className={cn("text-lg font-black italic tabular-nums leading-none", val > 90 ? "text-emerald-500" : "text-primary")}>{val}%</span>
         </div>
         <div className="h-1.5 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.05]">
            <motion.div 
              initial={{ width: 0 }}
              whileInView={{ width: `${val}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className={cn("h-full rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]", val > 90 ? "bg-emerald-500 shadow-emerald-500/20" : "premium-gradient")} 
            />
         </div>
      </div>
   );
}
