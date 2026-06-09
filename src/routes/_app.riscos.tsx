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
  FileWarning
} from "lucide-react";

export const Route = createFileRoute("/_app/riscos")({
  component: Riscos,
});

function Riscos() {
  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Central de Riscos</h2>
          <p className="text-muted-foreground mt-2">
            Monitoramento preditivo de não-conformidades e vencimentos.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-xs font-bold border border-red-500/20">
            <ShieldAlert className="h-4 w-4" />
            14 Alertas Críticos
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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

      <div className="glass-card rounded-3xl overflow-hidden border-white/5">
        <div className="p-6 border-b border-white/5 bg-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="font-semibold text-lg">Alertas Recentes</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Filtrar alertas..." className="bg-background border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm w-64" />
            </div>
            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2">
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
      </div>
    </div>
  );
}

function RiskCategoryCard({ icon: Icon, title, count, color, description, isScore }: any) {
  return (
    <div className="glass-card p-6 rounded-3xl space-y-4 hover:border-white/20 transition-all group">
      <div className={cn("h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center transition-colors group-hover:bg-white/10", color)}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <h4 className="text-3xl font-bold mt-1">
          {isScore ? `${count}%` : count}
        </h4>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

function RiskRow({ title, type, severity, date, owner }: any) {
  const severities: any = {
    critical: "bg-red-500/10 text-red-500",
    high: "bg-orange-500/10 text-orange-500",
    medium: "bg-blue-500/10 text-blue-500"
  };

  return (
    <div className="flex items-center justify-between p-6 hover:bg-white/5 transition-colors group cursor-pointer">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <div className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase shrink-0", severities[severity])}>
          {severity}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{title}</h4>
          <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>Tipo: {type}</span>
            <span>Responsável: {owner}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-xs font-semibold text-foreground">{date}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Status: Pendente</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
