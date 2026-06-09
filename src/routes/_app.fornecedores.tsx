import { createFileRoute } from "@tanstack/react-router";
import { Handshake, Search, Plus, Filter, FileText, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/fornecedores")({
  component: Fornecedores,
});

function Fornecedores() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Gestão de Fornecedores</h2>
          <p className="text-muted-foreground text-lg">Homologação, compliance contínuo e score de risco de parceiros.</p>
        </div>
        <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Homologar Parceiro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass-card p-8 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Homologados</p>
            <h4 className="text-3xl font-black">42</h4>
            <p className="text-xs text-emerald-500 font-bold">Compliance 100%</p>
         </div>
         <div className="glass-card p-8 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Em Análise</p>
            <h4 className="text-3xl font-black">08</h4>
            <p className="text-xs text-muted-foreground font-bold">Documentação pendente</p>
         </div>
         <div className="glass-card p-8 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Risco Crítico</p>
            <h4 className="text-3xl font-black text-red-500">03</h4>
            <p className="text-xs text-red-500/60 font-bold">Ação necessária</p>
         </div>
      </div>

      <div className="glass-card rounded-[2.5rem] p-10 space-y-10">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-xl font-black flex items-center gap-3">
               <Handshake className="h-6 w-6 text-primary" />
               Lista de Parceiros Estratégicos
            </h3>
            <div className="flex gap-3">
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type="text" placeholder="Buscar fornecedor..." className="bg-background border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm w-64 focus:ring-primary/50" />
               </div>
            </div>
         </div>

         <div className="divide-y divide-white/5">
            <VendorRow 
               name="Engenharia Santos & Co" 
               category="Regularização" 
               score={98} 
               status="Homologado" 
               ok 
            />
            <VendorRow 
               name="Cartório de Registro - SP" 
               category="Legal / Cartorial" 
               score={100} 
               status="Parceiro Gold" 
               ok 
            />
            <VendorRow 
               name="Serviços Rurais Boa Vista" 
               category="Agrimensura" 
               score={64} 
               status="Em Revisão" 
               alert 
            />
         </div>
      </div>
    </div>
  );
}

function VendorRow({ name, category, score, status, ok, alert }: any) {
   return (
      <div className="flex items-center justify-between p-7 hover:bg-white/[0.03] transition-all group cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
         <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-all">
               <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
               <h4 className="text-lg font-bold group-hover:text-primary transition-colors">{name}</h4>
               <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mt-1">{category}</p>
            </div>
         </div>
         <div className="flex items-center gap-12 text-right">
            <div>
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Compliance</p>
               <span className={cn("text-lg font-black", ok ? "text-emerald-500" : "text-red-500")}>{score}%</span>
            </div>
            <div className="hidden md:block">
               <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Status</p>
               <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                  ok ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
               )}>
                  {status}
               </span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
         </div>
      </div>
   );
}
