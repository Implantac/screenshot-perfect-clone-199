import { createFileRoute } from "@tanstack/react-router";
import { 
  Activity, 
  ShieldCheck, 
  Zap, 
  Target, 
  TrendingUp,
  Brain,
  AlertCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useJarvisHealth, useJarvisInsights, useJarvisActionPlans } from "@/hooks/useJarvis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/")({
  component: JarvisIntelligenceCenter,
});

function JarvisIntelligenceCenter() {
  const { data: health } = useJarvisHealth();
  const { data: insights } = useJarvisInsights();
  const { data: actions } = useJarvisActionPlans();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-10">
      
      {/* Global Scores - Command Center Style */}
      <div className="lg:col-span-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <ScoreGauge label="Patrimonial" value={health?.patrimonial_score || 96} color="primary" />
          <ScoreGauge label="Documental" value={health?.documental_score || 88} color="blue" />
          <ScoreGauge label="Compliance" value={health?.compliance_score || 92} color="emerald" />
          <ScoreGauge label="Global" value={health?.global_score || 94} color="amber" />
        </div>

        {/* Proactive Analysis Room */}
        <div className="glass-card rounded-[3rem] p-10 border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-2xl font-black italic tracking-tighter flex items-center gap-4">
              <Brain className="h-7 w-7 text-primary" />
              ANÁLISE PREDITIVA ATIVA
            </h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">IA em Tempo Real</span>
            </div>
          </div>

          <div className="space-y-6">
            {insights?.slice(0, 3).map((insight, idx) => (
              <InsightCard key={insight.id || idx} insight={insight} />
            )) || (
              <>
                <InsightCard 
                  insight={{
                    title: "Exposição de Risco Documental",
                    description: "Detectei 4 matrículas com ônus não atualizados em Holding Alpha. Risco de impacto jurídico em garantias bancárias.",
                    severity: "high",
                    type: "documental"
                  }} 
                />
                <InsightCard 
                  insight={{
                    title: "Oportunidade de Governança",
                    description: "Identifiquei concentração excessiva de ativos (R$ 12M) sob CPF único. Sugiro migração para Holding Patrimonial.",
                    severity: "medium",
                    type: "patrimonial"
                  }} 
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Plans & Timeline - Side Panel */}
      <div className="lg:col-span-4 space-y-8">
        <div className="glass-card rounded-[3.5rem] p-10 border-primary/10 bg-primary/[0.02]">
          <h3 className="text-xl font-black italic tracking-tighter flex items-center gap-4 mb-8 text-primary">
            <Target className="h-6 w-6" />
            PLANO DE ATAQUE
          </h3>
          
          <div className="space-y-6">
            {actions?.slice(0, 4).map((action, idx) => (
              <ActionItem key={action.id || idx} action={action} />
            )) || (
              <>
                <ActionItem action={{ title: "Regularizar CND Federal - Agro J", priority: "P1", status: "pending", due_date: "12/06" }} />
                <ActionItem action={{ title: "Atualizar Laudo de Avaliação", priority: "P2", status: "in_progress", due_date: "15/06" }} />
                <ActionItem action={{ title: "Renovação AVCB Galpão 04", priority: "P1", status: "pending", due_date: "18/06" }} />
              </>
            )}
          </div>

          <button className="w-full mt-10 py-5 bg-primary text-primary-foreground rounded-3xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3">
            Executar Protocolos
            <Zap className="h-4 w-4" />
          </button>
        </div>

        {/* Digital Twin Shortcut */}
        <div className="glass-card rounded-[3rem] p-8 border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors cursor-pointer group">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors">
              <Zap className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Digital Twin</p>
              <p className="text-sm font-bold">Visualização 360° do Ativo</p>
            </div>
            <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreGauge({ label, value, color }: any) {
  const colors: any = {
    primary: "text-primary border-primary/20",
    blue: "text-blue-500 border-blue-500/20",
    emerald: "text-emerald-500 border-emerald-500/20",
    amber: "text-amber-500 border-amber-500/20",
  };

  return (
    <div className="glass-card rounded-[2.5rem] p-6 text-center border-white/5 bg-white/[0.02]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4">{label}</p>
      <div className={cn("inline-flex items-center justify-center h-24 w-24 rounded-full border-4 relative", colors[color])}>
        <span className="text-2xl font-black italic">{value}%</span>
        <svg className="absolute -inset-1 h-26 w-26 rotate-[-90deg]">
          <circle 
            cx="48" cy="48" r="44" 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="4" 
            strokeDasharray={`${value * 2.76} 276`}
            className="opacity-100"
          />
        </svg>
      </div>
    </div>
  );
}

function InsightCard({ insight }: any) {
  const sevs: any = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    low: "bg-blue-500"
  };

  return (
    <div className="flex gap-6 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all group">
      <div className={cn("h-3 w-3 rounded-full mt-2 shrink-0", sevs[insight.severity])} />
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-black italic tracking-tight group-hover:text-primary transition-colors">{insight.title}</h4>
          <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{insight.type}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{insight.description}</p>
      </div>
      <button className="ml-auto self-center h-12 w-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all">
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function ActionItem({ action }: any) {
  const priorities: any = {
    P1: "text-red-500 bg-red-500/10",
    P2: "text-orange-500 bg-orange-500/10",
    P3: "text-blue-500 bg-blue-500/10"
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black", priorities[action.priority])}>{action.priority}</span>
        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-2">
          <Clock className="h-3 w-3" />
          {action.due_date}
        </span>
      </div>
      <p className="text-sm font-bold text-foreground/90">{action.title}</p>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000", action.status === 'in_progress' ? 'w-1/2 bg-amber-500' : 'w-0')} 
        />
      </div>
    </div>
  );
}
