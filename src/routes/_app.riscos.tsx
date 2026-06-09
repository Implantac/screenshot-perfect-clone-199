import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Search, 
  Filter, 
  MapPin, 
  Calendar,
  ChevronRight,
  ShieldCheck,
  FileWarning,
  Activity,
  History,
  Zap,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/riscos")({
  component: CentralDeRiscos,
});

function CentralDeRiscos() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black tracking-tight uppercase">Central de Riscos</h2>
          <p className="text-muted-foreground text-lg">Monitoramento preditivo de não-conformidades e vencimentos.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-3 px-5 py-3 bg-red-500/10 text-red-500 rounded-2xl text-xs font-black border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <Zap className="h-4 w-4 animate-pulse" />
            14 Alertas Críticos
          </div>
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Análise IA
          </button>
        </div>
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <RiskCategoryCard 
          icon={Calendar} 
          title="Vencimentos" 
          count={8} 
          color="text-orange-500"
          description="Certidões, Contratos, Procurações"
        />
        <RiskCategoryCard 
          icon={FileWarning} 
          title="Inconsistências" 
          count={4} 
          color="text-red-500"
          description="Matrículas, Escrituras, Ônus"
        />
        <RiskCategoryCard 
          icon={MapPin} 
          title="Regulatórios" 
          count={2} 
          color="text-yellow-500"
          description="AVCB, CAR, ITR, Licenças"
        />
        <RiskCategoryCard 
          icon={ShieldCheck} 
          title="Compliance Score" 
          count={92} 
          isScore
          color="text-primary"
          description="Meta de 98% estabelecida"
        />
      </div>

      {/* Alerts Table-like View */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden border-white/5">
        <div className="p-8 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Activity className="h-5 w-5 text-muted-foreground" />
             </div>
             <h3 className="font-bold text-lg">Alertas Recentes</h3>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Filtrar por ativo ou tipo..." 
                className="bg-background border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm w-72 focus:ring-primary/50" 
              />
            </div>
            <button className="h-11 px-5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-white/5">
          <RiskRow 
            title="Certidão Negativa SEFAZ - Holding Alencar"
            type="Vencimento"
            severity="critical"
            date="Expira em 48h"
            owner="Beatriz Silva"
          />
          <RiskRow 
            title="Divergência de área: Matrícula #12.442 vs CAR"
            type="Inconsistência"
            severity="high"
            date="Detectado 3h atrás"
            owner="Eng. Roberto"
          />
          <RiskRow 
            title="Renovação Seguro Predial - Sede SP"
            type="Contrato"
            severity="medium"
            date="Expira em 12 dias"
            owner="Depto Financeiro"
          />
          <RiskRow 
            title="Inconsistência de CPF de sócio em Escritura"
            type="Documental"
            severity="high"
            date="Detectado 1 dia atrás"
            owner="Legal Admin"
          />
        </div>

        <div className="p-6 bg-white/[0.01] text-center">
           <button className="text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-[0.2em] transition-all">
              Ver histórico completo de incidentes
           </button>
        </div>
      </div>
    </div>
  );
}

function RiskCategoryCard({ icon: Icon, title, count, color, description, isScore }: any) {
  return (
    <div className="glass-card p-8 rounded-[2rem] space-y-6 hover:border-white/20 transition-all group border border-transparent">
      <div className={cn("h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center transition-all group-hover:bg-white/10 group-hover:scale-110", color)}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-bold tracking-tight">{title}</p>
        <h4 className="text-4xl font-black mt-1">
          {isScore ? `${count}%` : count}
        </h4>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-3 leading-relaxed font-semibold">
          {description}
        </p>
      </div>
    </div>
  );
}

function RiskRow({ title, type, severity, date, owner }: any) {
  const severities: any = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    medium: "bg-blue-500/10 text-blue-500 border-blue-500/20"
  };

  return (
    <div className="flex items-center justify-between p-8 hover:bg-white/[0.03] transition-colors group cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
      <div className="flex items-center gap-8 flex-1 min-w-0">
        <div className={cn("px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 border", severities[severity])}>
          {severity}
        </div>
        <div className="min-w-0">
          <h4 className="text-lg font-bold truncate group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">
            <span className="flex items-center gap-1.5">
               <History className="h-3 w-3" />
               Tipo: {type}
            </span>
            <span className="flex items-center gap-1.5">
               <ShieldCheck className="h-3 w-3" />
               Responsável: {owner}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-10">
        <div className="text-right">
          <p className="text-sm font-black text-foreground">{date}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-bold">Status: Pendente</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:translate-x-1">
           <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
