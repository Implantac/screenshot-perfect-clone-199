import { createFileRoute } from "@tanstack/react-router";
import { 
  ClipboardList, 
  Target, 
  User, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  ChevronRight,
  LayoutList
} from "lucide-react";
import { motion } from "framer-motion";
import { useJarvisActionPlans } from "@/hooks/useJarvis";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/acoes")({
  component: JarvisActionsPage,
});

function JarvisActionsPage() {
  const { data: actions, isLoading } = useJarvisActionPlans();

  const priorityColors: any = {
    P1: "bg-red-500",
    P2: "bg-orange-500",
    P3: "bg-blue-500"
  };

  return (
    <div className="space-y-10 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Planos de <span className="text-primary">Ação</span></h2>
          <p className="text-muted-foreground text-sm font-medium">Cronograma estratégico para mitigação de riscos e regularização.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="glass-card px-6 py-4 rounded-3xl border-white/5 bg-white/[0.02] flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Ações Pendentes</p>
              <p className="text-2xl font-black italic">14</p>
            </div>
            <div className="h-10 w-[1px] bg-white/10" />
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Execução IA</p>
              <p className="text-2xl font-black italic text-primary">82%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Active Protocols List */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <LayoutList className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-black italic tracking-tighter uppercase">Protocolos em Aberto</h3>
          </div>

          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {actions?.map((action, idx) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="glass-card rounded-[2rem] p-8 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all group"
                >
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <span className={cn("px-2.5 py-1 rounded text-[10px] font-black text-white", priorityColors[action.priority])}>
                          {action.priority}
                        </span>
                        <span className={cn(
                          "px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                          action.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                          action.status === 'in_progress' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-white/5 text-muted-foreground'
                        )}>
                          {action.status === 'pending' ? 'Pendente' : action.status === 'in_progress' ? 'Em Curso' : 'Concluído'}
                        </span>
                      </div>
                      <h4 className="text-xl font-black italic tracking-tight">{action.title}</h4>
                      
                      <div className="flex flex-wrap gap-6 pt-2">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          Responsável: Gestor Patrimonial
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          Prazo: {action.due_date ? new Date(action.due_date).toLocaleDateString('pt-BR') : 'Imediato'}
                        </div>
                      </div>
                    </div>

                    <div className="md:w-48 flex items-center justify-end">
                      <button className="h-14 w-full md:w-14 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )) || (
                <div className="p-20 text-center glass-card rounded-[3rem] border-dashed border-white/10 opacity-40">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-xs font-black uppercase tracking-[0.2em]">Nenhuma ação pendente</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Execution Summary & Stats */}
        <div className="lg:col-span-4 space-y-8">
          <div className="glass-card rounded-[3rem] p-10 border-white/5 bg-gradient-to-b from-primary/[0.05] to-transparent shadow-2xl">
            <h3 className="text-xl font-black italic tracking-tighter uppercase mb-8 flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              Impacto Projetado
            </h3>
            
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">Segurança Jurídica</p>
                  <p className="text-lg font-black text-emerald-500">+24%</p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[24%] bg-emerald-500" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">Redução de Custos</p>
                  <p className="text-lg font-black text-primary">R$ 1.2M</p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-primary" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-black uppercase text-muted-foreground/60 tracking-widest">Regularidade Agro</p>
                  <p className="text-lg font-black text-blue-500">Impecável</p>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-blue-500" />
                </div>
              </div>
            </div>

            <button className="w-full mt-12 py-5 bg-white/5 border border-white/10 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.4em] hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all flex items-center justify-center gap-3">
              Relatório de Execução
              <Zap className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
