import { createFileRoute } from "@tanstack/react-router";
import { FileSearch, Sparkles, Filter, Search, FileText, CheckCircle2, AlertTriangle, ArrowUpRight, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/saude-documental")({
  component: SaudeDocumental,
});

function SaudeDocumental() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Saúde Documental</h2>
          <p className="text-muted-foreground text-lg text-pretty max-w-2xl">
            Análise automática de validade, integridade e conformidade de documentos patrimoniais.
          </p>
        </div>
        <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          OCR & Extração IA
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <MetricCard label="Documentos Digitais" val="1.428" detail="98% OCR Concluído" />
         <MetricCard label="Saúde Média" val="94.2%" detail="+1.2% este mês" color="text-emerald-500" />
         <MetricCard label="Pendências IA" val="12" detail="Requerem revisão humana" color="text-orange-500" />
      </div>

      <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
         <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Repositório Inteligente</h3>
            <div className="flex gap-3">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" placeholder="Pesquisar documentos..." className="bg-background border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs w-64" />
               </div>
               <button className="p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                  <Filter className="h-4 w-4 text-muted-foreground" />
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DocCard title="Escritura Fazenda Santa Fé" type="Escritura" date="12/04/2026" status="Validado" />
            <DocCard title="Matrícula #14.221 - Sede" type="Matrícula" date="02/05/2026" status="Inconsistência" hasError />
            <DocCard title="Contrato Social - Holding" type="Contrato" date="10/01/2026" status="Validado" />
            <DocCard title="Procuração Sócio Majoritário" type="Procuração" date="22/05/2026" status="Pendente" />
         </div>
      </div>
    </div>
  );
}

function MetricCard({ label, val, detail, color = "text-foreground" }: { label: string; val: string; detail: string; color?: string }) {
   return (
      <div className="glass-card p-8 rounded-[2rem] space-y-2">
         <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
         <h4 className={cn("text-3xl font-black tracking-tight", color)}>{val}</h4>
         <p className="text-xs text-muted-foreground font-medium">{detail}</p>
      </div>
   );
}

function DocCard({ title, type, date, status, hasError }: any) {
   return (
      <div className="p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between hover:border-white/20 transition-all group cursor-pointer">
         <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center border", hasError ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-white/5 border-white/5 text-muted-foreground group-hover:text-primary")}>
               {hasError ? <AlertTriangle className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
            <div>
               <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{title}</p>
               <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  <span>{type}</span>
                  <span>•</span>
                  <span>{date}</span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-4">
            <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg", hasError ? "text-red-500 bg-red-500/10" : "text-emerald-500 bg-emerald-500/10")}>
               {status}
            </span>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all" />
         </div>
      </div>
   );
}
