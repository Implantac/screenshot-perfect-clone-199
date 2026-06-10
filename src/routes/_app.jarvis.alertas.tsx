import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldAlert, 
  Clock, 
  ArrowRight,
  AlertTriangle,
  History,
  CheckCircle2,
  Zap,
  Info
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/alertas")({
  component: JarvisAlertsPage,
});

function JarvisAlertsPage() {
  const alerts = [
    {
      id: "1",
      title: "Certidão Vencida: Fazenda Santa Fé",
      description: "A Certidão Negativa de Débitos (CND) do ITR expirou há 3 dias. Risco de bloqueio em linhas de crédito rural.",
      severity: "critical",
      time: "Há 3 horas",
      type: "Compliance Agro",
      action: "Renovar Certidão"
    },
    {
      id: "2",
      title: "Vencimento de Procuração Estratégica",
      description: "Procuração de plenos poderes do Sócio majoritário para Holding Beta vence em 12 dias. Risco de paralisação administrativa.",
      severity: "high",
      time: "Há 5 horas",
      type: "Societário",
      action: "Redigir Nova Procuração"
    },
    {
      id: "3",
      title: "Licença Ambiental em Análise",
      description: "Protocolo de renovação da licença de operação do Galpão 04 não teve movimentação nos últimos 30 dias.",
      severity: "medium",
      time: "Ontem",
      type: "Ambiental",
      action: "Consultar Órgão"
    }
  ];

  return (
    <div className="space-y-10 overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-orange-500">Alertas <span className="text-foreground">Proativos</span></h2>
          <p className="text-muted-foreground text-sm font-medium">Monitoramento contínuo de anomalias e riscos imediatos.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">3 Críticos Detectados</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {alerts.map((alert, idx) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn(
              "glass-card rounded-[2rem] p-8 border-l-4 flex flex-col md:flex-row items-center gap-8 group transition-all",
              alert.severity === 'critical' ? 'border-l-red-500 bg-red-500/[0.02]' :
              alert.severity === 'high' ? 'border-l-orange-500 bg-orange-500/[0.02]' :
              'border-l-amber-500 bg-amber-500/[0.02]'
            )}
          >
            <div className={cn(
              "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0",
              alert.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
              alert.severity === 'high' ? 'bg-orange-500/10 text-orange-500' :
              'bg-amber-500/10 text-amber-500'
            )}>
              {alert.severity === 'critical' ? <ShieldAlert className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{alert.type}</span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {alert.time}
                </span>
              </div>
              <h3 className="text-xl font-black italic tracking-tighter leading-none">{alert.title}</h3>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">{alert.description}</p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all flex items-center justify-center gap-2">
                {alert.action}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
                <Info className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pt-12 border-t border-white/5">
        <div className="flex items-center gap-4 mb-8">
          <History className="h-6 w-6 text-muted-foreground" />
          <h3 className="text-xl font-black italic tracking-tighter uppercase">Histórico de Resoluções</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center gap-5">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold">Matrícula Atualizada - Edifício Corporate</p>
              <p className="text-[10px] text-muted-foreground">Resolvido por JARVIS em 08/06</p>
            </div>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center gap-5">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold">Renovação de Seguro Patrimonial</p>
              <p className="text-[10px] text-muted-foreground">Resolvido por JARVIS em 05/06</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
