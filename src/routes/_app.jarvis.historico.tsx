import { createFileRoute } from "@tanstack/react-router";
import { 
  History, 
  Search, 
  Calendar, 
  ChevronRight,
  ShieldCheck,
  Building2,
  FileText,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/jarvis/historico")({
  component: JarvisHistoryPage,
});

function JarvisHistoryPage() {
  const history = [
    {
      id: "1",
      date: "08/06/2026",
      time: "14:20",
      event: "Protocolo de Regularização Concluído",
      target: "Fazenda Santa Fé",
      details: "Matrícula atualizada e enviada para o cofre digital após validação da IA Documental.",
      type: "regularizacao"
    },
    {
      id: "2",
      date: "07/06/2026",
      time: "09:45",
      event: "Alerta de Risco Mitigado",
      target: "Holding Alpha",
      details: "CND Federal renovada automaticamente através da IA de Compliance.",
      type: "compliance"
    },
    {
      id: "3",
      date: "05/06/2026",
      time: "17:30",
      event: "Análise de Portfólio Executada",
      target: "Patrimônio Global",
      details: "Relatório gerencial de liquidez gerado e enviado para o conselho.",
      type: "executiva"
    }
  ];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase">Histórico de <span className="text-primary">Atividades</span></h2>
          <p className="text-muted-foreground text-sm font-medium">Registro cronológico de todas as ações e decisões tomadas pelo JARVIS.</p>
        </div>
        
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar eventos..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-[1px] bg-white/5" />
        
        <div className="space-y-12">
          {history.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative pl-20"
            >
              <div className="absolute left-[30px] top-0 h-4 w-4 rounded-full bg-primary/20 border-2 border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] z-10" />
              
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="md:w-32 shrink-0">
                  <p className="text-sm font-black italic">{item.date}</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </p>
                </div>

                <div className="flex-1 glass-card rounded-[2.5rem] p-8 border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all group">
                  <div className="flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="px-2.5 py-1 rounded bg-white/5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          {item.type}
                        </span>
                        <h4 className="text-xl font-black italic tracking-tight group-hover:text-primary transition-colors">{item.event}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-2xl">
                        {item.details}
                      </p>
                      
                      <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold">
                          <Building2 className="h-3 w-3 text-primary" />
                          {item.target}
                        </div>
                      </div>
                    </div>

                    <button className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all self-center">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
