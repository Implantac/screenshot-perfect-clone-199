import { createFileRoute } from "@tanstack/react-router";
import { 
  Scale, 
  FileText, 
  ShieldCheck, 
  Gavel, 
  History, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight,
  Clock,
  ExternalLink,
  Users2
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/legal" as any)({
  component: AssessoriaJuridica,
});

function AssessoriaJuridica() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Assessoria Jurídica & Litígios</h2>
          <p className="text-muted-foreground mt-2">Gestão de processos judiciais, contratos societários e blindagem patrimonial.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Vincular Processo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <LegalStat label="Processos Ativos" val="06" icon={Gavel} color="text-orange-500" />
         <LegalStat label="Blindagem" val="Forte" icon={ShieldCheck} color="text-emerald-500" />
         <LegalStat label="Contratos Venc." val="02" icon={Clock} color="text-red-500" />
         <LegalStat label="Diligências" val="12" icon={FileText} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Lawsuits Table */}
         <div className="lg:col-span-8 glass-card rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-xl font-bold flex items-center gap-2">
                  <Scale className="h-6 w-6 text-primary" />
                  Contencioso & Litígios
               </h3>
               <div className="flex gap-2">
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                     <input type="text" placeholder="Filtrar processos..." className="bg-background border-white/10 rounded-xl py-2 pl-9 pr-4 text-[10px] w-48" />
                  </div>
               </div>
            </div>
            
            <div className="divide-y divide-white/5">
               <LawsuitRow 
                  title="Ação Indenizatória - Limite Territorial" 
                  number="1029384-22.2024.8.26.0100"
                  court="TJSP - Comarca de São Paulo"
                  status="Em Fase de Instrução"
                  asset="Fazenda Santa Fé"
                  priority="high"
               />
               <LawsuitRow 
                  title="Renovação de Contrato Social - Holding Alencar" 
                  number="1122334-55.2026.8.26.0000"
                  court="JUCESP - São Paulo"
                  status="Aguardando Deferimento"
                  asset="Holding Alencar"
                  priority="medium"
               />
               <LawsuitRow 
                  title="Usucapião Extrajudicial - Lote 04" 
                  number="Cartório 12º Notas"
                  court="Extrajudicial"
                  status="Finalizado"
                  asset="Imóvel Urbano SP"
                  priority="low"
               />
            </div>
            
            <div className="p-6 bg-white/[0.01] text-center">
               <button className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all">Ver todos os processos</button>
            </div>
         </div>

         {/* Contacts/Advocacy Sidebar */}
         <div className="lg:col-span-4 space-y-6">
            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
               <h3 className="text-lg font-bold">Escritórios Parceiros</h3>
               <div className="space-y-4">
                  <LawyerCard name="Moraes & Advogados" specialty="Civil e Imobiliário" phone="(11) 98765-4321" />
                  <LawyerCard name="Silva & Partners" specialty="Societário e Tributário" phone="(11) 91234-5678" />
               </div>
               <button className="w-full py-4 bg-primary/10 text-primary border border-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/20 transition-all">
                  Homologar Novo Escritório
               </button>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-6 bg-primary/5 border-primary/20">
               <h3 className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Blindagem Patrimonial
               </h3>
               <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua estrutura atual possui <span className="text-primary font-black">94% de eficiência</span> contra riscos sucessórios e penhoras.
               </p>
               <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "94%" }} />
               </div>
               <button className="w-full py-4 bg-primary text-primary-foreground rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20">
                  Emitir Relatório de Risco
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}

function LegalStat({ label, val, icon: Icon, color = "text-foreground" }: { label: string; val: string; icon: any; color?: string }) {
  return (
    <div className="glass-card p-6 rounded-[2rem] flex items-center gap-4">
       <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
          <Icon className={cn("h-6 w-6", color)} />
       </div>
       <div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
          <p className="text-xl font-black mt-0.5 tracking-tight">{val}</p>
       </div>
    </div>
  );
}

function LawsuitRow({ title, number, court, status, asset, priority }: any) {
  const priorities: any = {
    high: "bg-red-500/10 text-red-500 border-red-500/20",
    medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  };

  return (
    <div className="p-8 hover:bg-white/[0.02] transition-colors group cursor-pointer">
       <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
             <div className="flex items-center gap-3">
                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border", priorities[priority])}>
                   {priority}
                </span>
                <h4 className="text-lg font-bold group-hover:text-primary transition-colors">{title}</h4>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Processo</p>
                   <p className="text-xs font-medium text-foreground">{number}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Órgão</p>
                   <p className="text-xs font-medium text-foreground">{court}</p>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Ativo Vinculado</p>
                   <p className="text-xs font-medium text-primary flex items-center gap-1">
                      {asset}
                      <ExternalLink className="h-3 w-3" />
                   </p>
                </div>
             </div>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
             <div className="px-3 py-1 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {status}
             </div>
             <button className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground group-hover:text-primary transition-all">
                <ChevronRight className="h-5 w-5" />
             </button>
          </div>
       </div>
    </div>
  );
}

function LawyerCard({ name, specialty, phone }: any) {
  return (
    <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all cursor-pointer">
       <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
             <Users2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div>
             <p className="text-sm font-bold">{name}</p>
             <p className="text-[10px] text-muted-foreground font-medium">{specialty}</p>
          </div>
       </div>
       <div className="text-right">
          <p className="text-[10px] font-bold text-primary">{phone}</p>
       </div>
    </div>
  );
}
