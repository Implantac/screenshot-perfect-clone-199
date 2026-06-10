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
    <div className="space-y-10 animate-in fade-in duration-700 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Compliance Score</h2>
          <p className="text-muted-foreground text-lg">Gestão regulatória e auditoria contínua de conformidade.</p>
        </div>
        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-4">
           <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Global Score</p>
              <p className="text-xl font-black text-primary">{avgCompliance.toFixed(1)} / 100</p>
           </div>
           <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-6 w-6" />
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
