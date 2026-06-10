import { createFileRoute } from "@tanstack/react-router";
import { 
  Users2, 
  Heart, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  TrendingUp, 
  Scale, 
  History,
  Plus,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/family-office")({
  component: FamilyOffice,
});

function FamilyOffice() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Family Office</h2>
          <p className="text-muted-foreground mt-2">Planejamento sucessório, gestão de inventários e governança familiar.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Registro
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         {/* Main Succession Card */}
         <div className="xl:col-span-2 glass-card rounded-[2.5rem] p-10 space-y-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <Scale className="h-40 w-40" />
            </div>
            
            <div className="flex items-center justify-between relative z-10">
               <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                     <Heart className="h-7 w-7" />
                  </div>
                  <div>
                     <h3 className="text-2xl font-black">Célula Family Office</h3>
                     <p className="text-sm text-muted-foreground">Planejamento sucessório e blindagem patrimonial</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-500/10">
                  <ShieldCheck className="h-4 w-4" />
                  Válido & Assinado
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
               <SuccessionStatus label="Inventários Ativos" val="02" icon={FileText} />
               <SuccessionStatus label="Protocolo Familiar" val="95%" icon={ShieldCheck} />
               <SuccessionStatus label="Patrimônio Total" val="R$ 482M" icon={TrendingUp} />
            </div>

            <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 relative z-10">
               <h4 className="font-bold mb-6 flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Próximos Marcos Sucessórios
               </h4>
               <div className="space-y-4">
                  <TimelineItem title="Renovação de Procurações de Sócios" date="15 Ago, 2026" status="Aguardando" />
                  <TimelineItem title="Reunião Trimestral de Governança" date="22 Set, 2026" status="Agendado" />
                  <TimelineItem title="Auditoria Anual de Ativos" date="10 Dez, 2026" status="Programado" />
               </div>
            </div>
         </div>

         {/* Family Members Sidebar */}
         <div className="glass-card rounded-[2.5rem] p-8 space-y-8">
            <h3 className="text-xl font-bold">Núcleo Familiar</h3>
            <div className="space-y-6">
               <FamilyMember name="Luiz Alencar" role="Fundador / Patriarca" initial="L" active />
               <FamilyMember name="Maria Alencar" role="Matriarca" initial="M" />
               <FamilyMember name="Junior Alencar" role="Sucessor 1 / Gestor" initial="J" />
               <FamilyMember name="Beatriz Alencar" role="Sucessora 2 / Jurídico" initial="B" />
            </div>
            <button className="w-full py-4 bg-primary/10 text-primary border border-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/20 transition-all mt-4">
               Gerenciar Permissões
            </button>
         </div>
      </div>

      {/* Succession Assets */}
      <div className="space-y-6">
         <h3 className="text-xl font-bold">Distribuição Patrimonial (Legado)</h3>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <LegacyCard label="Imóveis" val="R$ 175M" perc="36%" />
            <LegacyCard label="Participações" val="R$ 248M" perc="52%" />
            <LegacyCard label="Liquidez" val="R$ 42M" perc="8.5%" />
            <LegacyCard label="Outros" val="R$ 17M" perc="3.5%" />
         </div>
      </div>
    </div>
  );
}

function SuccessionStatus({ label, val, icon: Icon }: { label: string; val: string; icon: any }) {
  return (
    <div className="space-y-2">
       <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
       </div>
       <p className="text-3xl font-black text-foreground tracking-tighter">{val}</p>
    </div>
  );
}

function TimelineItem({ title, date, status }: any) {
  return (
    <div className="flex items-center justify-between group">
       <div className="flex items-center gap-4">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div>
             <p className="text-sm font-bold group-hover:text-primary transition-colors">{title}</p>
             <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{date}</p>
          </div>
       </div>
       <span className="text-[10px] font-bold text-muted-foreground px-2 py-1 bg-white/5 rounded-lg">{status}</span>
    </div>
  );
}

function FamilyMember({ name, role, initial, active }: any) {
  return (
    <div className="flex items-center gap-4 group cursor-pointer">
       <div className={cn(
          "h-12 w-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all",
          active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground group-hover:bg-white/10"
       )}>
          {initial}
       </div>
       <div>
          <p className="text-sm font-bold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
       </div>
    </div>
  );
}

function LegacyCard({ label, val, perc }: any) {
  return (
    <div className="glass-card p-6 rounded-[2rem] space-y-3 relative overflow-hidden">
       <div className="absolute top-0 right-0 p-4">
          <span className="text-[10px] font-black text-primary/40 tracking-tighter">{perc}</span>
       </div>
       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
       <p className="text-xl font-black text-foreground">{val}</p>
       <div className="h-1 w-full bg-white/5 rounded-full mt-4">
          <div className="h-full bg-primary rounded-full" style={{ width: perc }} />
       </div>
    </div>
  );
}
