import { createFileRoute } from "@tanstack/react-router";
import { 
  MessageSquare, 
  Phone, 
  Zap, 
  Clock, 
  Filter, 
  Search, 
  MoreVertical, 
  User, 
  CheckCircle2, 
  AlertCircle,
  BrainCircuit,
  Paperclip,
  Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/suporte")({
  component: Suporte,
});

const tickets = [
  { id: "T-1042", user: "Beatriz Silva", client: "Holding Alencar", subject: "Erro emissão NF-e", priority: "critical", time: "2 min", category: "Fiscal" },
  { id: "T-1041", user: "Marcos Oliveira", client: "Blue Park", subject: "Acesso bloqueado", priority: "high", time: "15 min", category: "Acesso" },
  { id: "T-1040", user: "Lucia Santos", client: "Fazenda BV", subject: "Dúvida no Dashboard", priority: "low", time: "45 min", category: "Treinamento" },
  { id: "T-1039", user: "Ricardo Lima", client: "Tech Inc", subject: "Lentidão ao carregar matriculas", priority: "medium", time: "1h", category: "Performance" },
];

function Suporte() {
  return (
    <div className="h-[calc(100vh-160px)] flex gap-6 overflow-hidden">
      {/* Tickets List */}
      <div className="w-80 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Fila de Chamados</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground"><Filter className="h-4 w-4" /></button>
            <button className="p-2 hover:bg-white/5 rounded-lg text-muted-foreground"><Search className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-none">
          {tickets.map((ticket) => (
            <div 
              key={ticket.id} 
              className={cn(
                "glass-card p-4 rounded-2xl cursor-pointer hover:border-primary/50 transition-all border-l-4",
                ticket.priority === "critical" ? "border-l-red-500" : 
                ticket.priority === "high" ? "border-l-orange-500" : "border-l-transparent"
              )}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{ticket.id}</span>
                <span className="text-[10px] text-muted-foreground">{ticket.time}</span>
              </div>
              <h4 className="text-sm font-semibold mt-1 truncate">{ticket.subject}</h4>
              <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.client} • {ticket.user}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                  ticket.category === "Fiscal" ? "bg-red-500/10 text-red-400" : "bg-white/5 text-muted-foreground"
                )}>
                  {ticket.category}
                </span>
                {ticket.priority === "critical" && <Zap className="h-3 w-3 text-red-500 animate-pulse" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat / Conversation */}
      <div className="flex-1 glass-card rounded-3xl flex flex-col overflow-hidden relative">
        {/* Chat Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Beatriz" alt="Beatriz" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">Beatriz Silva</h3>
                <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
              </div>
              <p className="text-sm text-muted-foreground">Holding Alencar • Chamado T-1042</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="h-10 px-4 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-medium">Priorizar</button>
            <button className="h-10 px-4 rounded-xl bg-emerald-500 text-white transition-all text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Ligar
            </button>
            <button className="p-2 hover:bg-white/5 rounded-xl text-muted-foreground"><MoreVertical className="h-5 w-5" /></button>
          </div>
        </div>

        {/* IA Analysis Overlay */}
        <div className="px-6 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-primary">
            Análise IA: <span className="text-foreground">Problema detectado na configuração do certificado digital (Erro 502). Requer intervenção técnica imediata.</span>
          </p>
          <div className="ml-auto flex gap-2">
            <button className="text-[10px] px-2 py-0.5 bg-primary/10 rounded hover:bg-primary/20 transition-colors">Confirmar Erro</button>
            <button className="text-[10px] px-2 py-0.5 bg-white/5 rounded hover:bg-white/10 transition-colors">Sugestão de Treinamento?</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 scrollbar-none">
          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-[70%]">
              <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 text-sm">
                Olá, estou tentando emitir uma nota fiscal de serviço e está dando um erro de comunicação com a prefeitura. Podem me ajudar?
              </div>
              <p className="text-[10px] text-muted-foreground">14:02</p>
            </div>
          </div>

          <div className="flex gap-4 justify-end">
            <div className="space-y-2 max-w-[70%] text-right">
              <div className="p-4 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm">
                Claro, Beatriz. Já identifiquei aqui que o problema é no seu certificado digital que está expirando hoje. Vou te passar o link para renovação.
              </div>
              <p className="text-[10px] text-muted-foreground">14:03</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-[70%]">
              <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/5 text-sm">
                Ah, perfeito! Não tinha percebido a data. Vocês conseguem me enviar o link agora?
              </div>
              <p className="text-[10px] text-muted-foreground">14:04</p>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-2 pr-4 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <button className="p-2 hover:bg-white/10 rounded-xl text-muted-foreground"><Paperclip className="h-5 w-5" /></button>
            <input 
              type="text" 
              placeholder="Digite sua resposta aqui..." 
              className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none"
            />
            <button className="p-2 bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions / Info Panel */}
      <div className="w-80 flex flex-col gap-6">
        <div className="glass-card rounded-3xl p-6 space-y-6">
          <h3 className="text-lg font-bold">Resumo do Cliente</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-semibold text-primary">Holding Premium</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">SLA Restante</span>
              <span className="font-semibold text-emerald-500">54 min</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Ativos</span>
              <span className="font-semibold">12 Propriedades</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 flex-1 space-y-4">
          <h3 className="text-lg font-bold">Macros de Resposta</h3>
          <div className="space-y-2">
            <button className="w-full p-3 text-left text-xs bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors">
              [FISCAL] Erro de certificado digital
            </button>
            <button className="w-full p-3 text-left text-xs bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors">
              [ACESSO] Redefinição de senha
            </button>
            <button className="w-full p-3 text-left text-xs bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-colors">
              [TREINAMENTO] Agendar reciclagem
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
