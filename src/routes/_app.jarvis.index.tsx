import { createFileRoute } from "@tanstack/react-router";
import { 
  Brain, 
  Target, 
  Zap, 
  ArrowRight
} from "lucide-react";
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 pb-20 overflow-x-hidden max-w-[1800px] mx-auto w-full relative">
      <div className="fixed inset-0 noise-overlay opacity-[0.01] pointer-events-none" />
      
      {/* Global Scores */}
      <div className="lg:col-span-8 space-y-12 lg:space-y-16 relative z-10">
        <div className="space-y-4">
          <p className="text-[10px] lg:text-[12px] font-black uppercase tracking-[0.5em] text-primary/70 italic">Digital Director Intelligence Center</p>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-foreground uppercase italic leading-[0.85]">
            JARVIS <span className="text-primary">DIRECTOR</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {(() => {
            // Última leitura do histórico (o hook devolve a série em ordem cronológica).
            const series = health ?? [];
            const latest = series.length > 0 ? series[series.length - 1] : null;
            return (
              <>
                <ScoreGauge label="Patrimonial" value={Number(latest?.patrimonial_score ?? 0)} color="primary" />
                <ScoreGauge label="Documental" value={Number(latest?.documental_score ?? 0)} color="blue" />
                <ScoreGauge label="Compliance" value={Number(latest?.compliance_score ?? 0)} color="emerald" />
                <ScoreGauge label="Global Index" value={Number(latest?.global_score ?? 0)} color="amber" />
              </>
            );
          })()}
        </div>

        {/* Proactive Analysis Room */}
        <div className="glass-card rounded-[3.5rem] p-10 lg:p-14 border-white/[0.05] bg-black/40 shadow-2xl executive-grid">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12 lg:mb-16">
            <h3 className="text-2xl lg:text-3xl font-black italic tracking-tighter flex items-center gap-6">
              <Brain className="h-8 w-8 lg:h-10 lg:w-10 text-primary shrink-0 drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
              ANÁLISE NEURAL PREDITIVA
            </h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full w-fit">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
              <span className="text-[9px] lg:text-[10px] font-black text-primary uppercase tracking-widest">IA em Tempo Real</span>
            </div>
          </div>

          <div className="space-y-4 lg:space-y-6">
            {(insights && insights.length > 0) ? insights.slice(0, 3).map((insight, idx) => (
              <InsightCard key={insight.id || idx} insight={insight} />
            )) : (
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

      {/* Action Plans & Timeline */}
      <div className="lg:col-span-4 space-y-8">
        <div className="glass-card rounded-[2.5rem] lg:rounded-[3.5rem] p-6 lg:p-10 border-primary/10 bg-primary/[0.02]">
          <h3 className="text-xl font-black italic tracking-tighter flex items-center gap-4 mb-8 text-primary">
            <Target className="h-6 w-6 shrink-0" />
            PLANO DE ATAQUE
          </h3>
          
          <div className="space-y-6">
            {(actions && actions.length > 0) ? actions.slice(0, 5).map((action, idx) => (
              <ActionItem key={action.id || idx} action={action} />
            )) : (
              <>
                <ActionItem action={{ title: "Regularizar CND Federal - Agro J", priority: "P1", status: "pending", due_date: "12/06" }} />
                <ActionItem action={{ title: "Atualizar Laudo de Avaliação", priority: "P2", status: "in_progress", due_date: "15/06" }} />
                <ActionItem action={{ title: "Renovação AVCB Galpão 04", priority: "P1", status: "pending", due_date: "18/06" }} />
              </>
            )}
          </div>

          <button className="w-full mt-10 py-5 bg-primary text-primary-foreground rounded-2xl lg:rounded-3xl font-black text-[10px] lg:text-[11px] uppercase tracking-[0.3em] shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95">
            Executar Protocolos
            <Zap className="h-4 w-4" />
          </button>
        </div>

        {/* Digital Twin Shortcut */}
        <div className="glass-card rounded-3xl lg:rounded-[3.5rem] p-6 lg:p-10 border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all cursor-pointer group shadow-xl">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-primary/50 transition-colors shrink-0">
              <Zap className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight truncate">Digital Twin</p>
              <p className="text-[10px] text-muted-foreground font-medium truncate">Visualização 360° do Ativo</p>
            </div>
            <ArrowRight className="h-5 w-5 ml-auto text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
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
    <div className="glass-card rounded-[2.5rem] p-8 text-center border-white/[0.05] bg-white/[0.01] flex flex-col items-center hover:scale-105 transition-all duration-700 shadow-2xl backdrop-blur-3xl group/gauge relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover/gauge:opacity-100 transition-opacity" />
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/50 mb-6 italic relative z-10">{label}</p>
      <div className={cn("inline-flex items-center justify-center h-24 w-24 lg:h-32 lg:w-32 rounded-full border-[6px] relative z-10", colors[color])}>
        <span className="text-2xl lg:text-3xl font-black italic tabular-nums drop-shadow-lg">{value}<span className="text-[10px] opacity-30 ml-1">%</span></span>
        <svg className="absolute -inset-1.5 h-[108px] w-[108px] lg:h-[140px] lg:w-[140px] rotate-[-90deg] drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <circle 
            cx="54" cy="54" r="48" 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeDasharray={`${value * 3.01} 301`}
            strokeLinecap="round"
            className="lg:hidden transition-all duration-1000"
          />
          <circle 
            cx="70" cy="70" r="62" 
            fill="transparent" 
            stroke="currentColor" 
            strokeWidth="6" 
            strokeDasharray={`${value * 3.89} 389`}
            strokeLinecap="round"
            className="hidden lg:block transition-all duration-1000"
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
    <div className="flex flex-col sm:flex-row gap-4 lg:gap-6 p-6 lg:p-8 rounded-2xl lg:rounded-[2.5rem] bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all group">
      <div className={cn("h-3 w-3 rounded-full mt-2 shrink-0 hidden sm:block", sevs[insight.severity])} />
      <div className="space-y-2 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("h-2.5 w-2.5 rounded-full sm:hidden shrink-0", sevs[insight.severity])} />
          <h4 className="text-base lg:text-lg font-black italic tracking-tight group-hover:text-primary transition-colors truncate">{insight.title}</h4>
          <span className="px-2 py-0.5 rounded-md bg-white/5 text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-muted-foreground w-fit">{insight.type}</span>
        </div>
        <p className="text-[13px] lg:text-sm text-muted-foreground leading-relaxed line-clamp-2 lg:line-clamp-none">{insight.description}</p>
      </div>
      <button className="sm:ml-auto self-end sm:self-center h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-all shrink-0">
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
        <span className={cn("px-2 py-0.5 rounded-md text-[8px] lg:text-[9px] font-black", priorities[action.priority])}>{action.priority}</span>
        <span className="text-[9px] lg:text-[10px] font-bold text-muted-foreground flex items-center gap-2">
          {action.due_date}
        </span>
      </div>
      <p className="text-[13px] lg:text-sm font-bold text-foreground/90 truncate">{action.title}</p>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000", action.status === 'in_progress' ? 'w-1/2 bg-amber-500' : 'w-0')} 
        />
      </div>
    </div>
  );
}
