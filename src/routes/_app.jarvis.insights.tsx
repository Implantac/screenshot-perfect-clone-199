import { createFileRoute } from "@tanstack/react-router";
import { 
  Sparkles, 
  ShieldAlert, 
  AlertCircle, 
  Clock, 
  ArrowRight,
  FileText,
  Building2,
  TrendingUp,
  Zap,
  Filter
} from "lucide-react";
import { motion } from "framer-motion";
import { useJarvisInsights } from "@/hooks/useJarvis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/insights")({
  component: JarvisInsightsPage,
});

function JarvisInsightsPage() {
  const { data: insights, isLoading } = useJarvisInsights();

  const categories = [
    { label: "Todos", count: insights?.length || 0 },
    { label: "Documental", count: insights?.filter(i => i.type === 'documental').length || 0 },
    { label: "Compliance", count: insights?.filter(i => i.type === 'compliance').length || 0 },
    { label: "Patrimonial", count: insights?.filter(i => i.type === 'patrimonial').length || 0 },
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Insights <span className="text-primary">Estratégicos</span></h2>
          <p className="text-muted-foreground text-sm font-medium">Recomendações geradas por análise profunda de ativos e compliance.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">
            <Filter className="h-4 w-4" />
            Filtrar
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button 
            key={cat.label}
            className={cn(
              "px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
              cat.label === "Todos" 
                ? "bg-primary/10 border-primary/20 text-primary" 
                : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
            )}
          >
            {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
          </div>
        ) : (
          insights?.map((insight, idx) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card rounded-[2.5rem] p-10 border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent hover:border-primary/30 transition-all group"
            >
              <div className="flex flex-col md:flex-row gap-10">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                      insight.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                      insight.severity === 'high' ? 'bg-orange-500/10 text-orange-500' :
                      'bg-blue-500/10 text-blue-500'
                    )}>
                      {insight.severity}
                    </span>
                    <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">{insight.type}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black italic tracking-tighter leading-none group-hover:text-primary transition-colors">
                      {insight.title}
                    </h3>
                    <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
                      {insight.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-8 pt-6 border-t border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-[10px] font-bold">
                        <p className="text-muted-foreground uppercase tracking-widest leading-none mb-1">Impacto Ativo</p>
                        <p className="text-foreground">Holding Alpha - Matriz</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="text-[10px] font-bold">
                        <p className="text-muted-foreground uppercase tracking-widest leading-none mb-1">Risco Financeiro</p>
                        <p className="text-foreground">R$ 4.2M Estimado</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-64 space-y-4 flex flex-col justify-center">
                  <button className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    Iniciar Protocolo
                    <Zap className="h-4 w-4" />
                  </button>
                  <button className="w-full py-4 bg-white/5 border border-white/10 text-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">
                    Ver Digital Twin
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}

        {!isLoading && (!insights || insights.length === 0) && (
          <div className="py-32 text-center space-y-6 glass-card rounded-[3rem] border-dashed border-white/10">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase">Sistema em <span className="text-primary">Equilíbrio</span></h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">JARVIS não detectou anomalias críticas ou oportunidades de otimização no momento.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
