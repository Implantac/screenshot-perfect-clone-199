import { createFileRoute } from "@tanstack/react-router";
import { Landmark, MapPin, Layers, History, ArrowRight, Search, Plus, Filter, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/regularizacao")({
  component: Regularizacao,
});

function Regularizacao() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Regularização Imobiliária</h2>
          <p className="text-muted-foreground text-lg">Workflow visual de averbações, retificações e habite-se.</p>
        </div>
        <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Novo Processo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <MetricBox label="Em Trâmite" val="08" color="text-primary" />
         <MetricBox label="Aguardando Órgão" val="12" color="text-blue-500" />
         <MetricBox label="Atrasados" val="03" color="text-red-500" />
         <MetricBox label="Concluídos (Mês)" val="15" color="text-emerald-500" />
      </div>

      <div className="glass-card rounded-[2.5rem] p-10 space-y-10">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-xl font-black flex items-center gap-3">
               <Layers className="h-6 w-6 text-primary" />
               Workflow de Processos
            </h3>
            <div className="flex gap-2">
               <button className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-widest">Lista</button>
               <button className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Kanban</button>
            </div>
         </div>

         <div className="space-y-4">
            <ProcessRow 
              title="Averbação de Construção - Edifício Corporate" 
              step="Cartório de Registro" 
              progress={65} 
              status="Em Análise"
            />
            <ProcessRow 
              title="Retificação de Área - Fazenda Santa Fé" 
              step="INCRA / Georreferenciamento" 
              progress={30} 
              status="Coleta de Campo"
            />
            <ProcessRow 
              title="Emissão de Habite-se - Residencial Garden" 
              step="Prefeitura Municipal" 
              progress={90} 
              status="Vistoria Final"
            />
         </div>
      </div>
    </div>
  );
}

function MetricBox({ label, val, color }: { label: string; val: string; color?: string }) {
   return (
      <div className="glass-card p-6 rounded-[2rem] text-center border-transparent hover:border-white/5 transition-all">
         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">{label}</p>
         <p className={cn("text-4xl font-black mt-2 tracking-tighter", color)}>{val}</p>
      </div>
   );
}

function ProcessRow({ title, step, progress, status }: any) {
   return (
      <div className="group flex flex-col md:flex-row md:items-center gap-6 p-6 rounded-[2rem] bg-white/5 border border-white/5 hover:border-primary/20 transition-all cursor-pointer">
         <div className="flex-1 min-w-0">
            <h4 className="text-lg font-bold truncate group-hover:text-primary transition-colors">{title}</h4>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
               <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {step}</span>
               <span className="flex items-center gap-1.5"><History className="h-3 w-3" /> {status}</span>
            </div>
         </div>
         <div className="w-full md:w-64 space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
               <span className="text-muted-foreground">Progresso</span>
               <span className="text-foreground">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
            </div>
         </div>
         <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:translate-x-1 shrink-0">
            <ArrowRight className="h-5 w-5" />
         </div>
      </div>
   );
}
