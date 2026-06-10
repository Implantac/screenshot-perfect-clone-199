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
         <div className="lg:col-span-2 glass-card rounded-[2.5rem] p-8 space-y-8">
            <h3 className="text-xl font-bold">Checklist de Conformidade</h3>
            <div className="space-y-4">
               <ComplianceRow label="Certidão Negativa Tributos Federais" status="Regular" date="Val. 12/08/2026" ok />
               <ComplianceRow label="Certidão Negativa Trabalhista (BNDT)" status="Regular" date="Val. 05/09/2026" ok />
               <ComplianceRow label="Certidão de Débitos Estaduais (SEFAZ)" status="Pendência" date="Expira em 2d" alert />
               <ComplianceRow label="Regularidade junto ao FGTS (CRF)" status="Regular" date="Val. 30/07/2026" ok />
               <ComplianceRow label="Certidão Negativa de Protestos (Cartórios)" status="Regular" date="Val. 15/10/2026" ok />
            </div>
         </div>

         <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
            <h3 className="text-xl font-bold flex items-center gap-2">
               <Activity className="h-5 w-5 text-primary" />
               Saúde por Entidade
            </h3>
            <div className="space-y-6">
               {entities?.map((ent) => (
                 <EntityProgress key={ent.id} label={ent.name} val={Number(ent.compliance_score) || 0} />
               ))}
            </div>

         </div>
      </div>
    </div>
  );
}

function ComplianceRow({ label, status, date, ok, alert }: any) {
   return (
      <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group cursor-pointer">
         <div className="flex items-center gap-4">
            {ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : alert ? <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" /> : <AlertCircle className="h-5 w-5 text-muted-foreground" />}
            <div>
               <p className="text-sm font-bold group-hover:text-primary transition-colors">{label}</p>
               <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-widest">{date}</p>
            </div>
         </div>
         <span className={cn(
            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
            ok ? "bg-emerald-500/10 text-emerald-500" : alert ? "bg-red-500/10 text-red-500" : "bg-white/5 text-muted-foreground"
         )}>
            {status}
         </span>
      </div>
   );
}

function EntityProgress({ label, val }: { label: string; val: number }) {
   return (
      <div className="space-y-2">
         <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
            <span className="text-muted-foreground">{label}</span>
            <span className={val > 90 ? "text-emerald-500" : "text-orange-500"}>{val}%</span>
         </div>
         <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-1000", val > 90 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${val}%` }} />
         </div>
      </div>
   );
}
