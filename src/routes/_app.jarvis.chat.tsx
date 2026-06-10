import { createFileRoute } from "@tanstack/react-router";
import { 
  Send, 
  Bot, 
  User as UserIcon, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  TrendingUp,
  FileText,
  Search,
  Brain
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis/chat")({
  component: JarvisChatPage,
});

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

function JarvisChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: "1",
      role: "assistant", 
      content: "Protocolos JARVIS em plena operação. Estou monitorando todos os seus ativos, holdings e documentação em tempo real. Como posso auxiliar em sua estratégia patrimonial hoje?",
      suggestions: [
        "Quais imóveis apresentam risco crítico?",
        "Qual o score de compliance da Holding Alpha?",
        "Resumo dos vencimentos do mês",
        "Análise de liquidez do patrimônio"
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Simulate Jarvis response
    setTimeout(() => {
      const jarvisMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: "assistant", 
        content: "Processando análise via PATRIUM AI CORE... Identifiquei que sua dúvida se refere à estrutura societária. Com base nos documentos extraídos, o risco de sucessão é o fator de maior exposição atualmente."
      };
      setMessages(prev => [...prev, jarvisMsg]);
    }, 1500);
  };

  return (
    <div className="h-[calc(100vh-280px)] flex flex-col gap-6">
      <div className="flex-1 flex gap-8 min-h-0">
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col glass-card rounded-[3rem] border-white/5 bg-white/[0.01] overflow-hidden">
          <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-black italic tracking-tighter uppercase leading-none">Canal Direto <span className="text-primary">JARVIS</span></h3>
                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">Conexão Criptografada & Ativa</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">IA Online</span>
            </div>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-none"
          >
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-6 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                  msg.role === "assistant" 
                    ? "bg-primary/10 text-primary border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]" 
                    : "bg-white/5 text-muted-foreground border-white/10"
                )}>
                  {msg.role === "assistant" ? <Bot className="h-6 w-6" /> : <UserIcon className="h-6 w-6" />}
                </div>

                <div className="space-y-4">
                  <div className={cn(
                    "p-6 rounded-[2rem] text-sm leading-relaxed",
                    msg.role === "assistant" 
                      ? "bg-white/[0.03] border border-white/5 text-foreground/90 font-medium" 
                      : "bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/10"
                  )}>
                    {msg.content}
                  </div>
                  
                  {msg.suggestions && (
                    <div className="flex flex-wrap gap-2">
                      {msg.suggestions.map((s) => (
                        <button 
                          key={s}
                          onClick={() => setInput(s)}
                          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="p-8 border-t border-white/5 bg-white/[0.01]">
            <div className="relative group">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte ao JARVIS sobre seu patrimônio..." 
                className="w-full bg-white/5 border border-white/10 rounded-3xl py-6 pl-8 pr-20 text-base font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30"
              />
              <button 
                onClick={handleSend}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-14 w-14 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Send className="h-6 w-6" />
              </button>
            </div>
            <p className="text-center mt-4 text-[10px] text-muted-foreground/40 font-black uppercase tracking-[0.3em]">
              Análise baseada em dados reais e compliance auditado
            </p>
          </div>
        </div>

        {/* Knowledge Context Panel */}
        <div className="w-[380px] space-y-6 hidden xl:block">
          <div className="glass-card rounded-[3rem] p-8 border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent h-full overflow-hidden flex flex-col">
            <h4 className="text-sm font-black italic tracking-tighter uppercase mb-6 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              Contexto Operacional
            </h4>
            
            <div className="flex-1 space-y-8 overflow-y-auto scrollbar-none pb-4">
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Agentes Ativos</p>
                <div className="space-y-3">
                  <AgentStatus label="IA Documental" status="Lendo Matrículas" />
                  <AgentStatus label="IA Compliance" status="Monitorando CNDs" />
                  <AgentStatus label="IA Risco" status="Calculando Score" />
                  <AgentStatus label="IA Agro" status="Validando CCIR" />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Entidades Relacionadas</p>
                <div className="grid grid-cols-2 gap-3">
                  <EntityBadge label="Holding Alpha" />
                  <EntityBadge label="Fazenda Santa Fé" />
                  <EntityBadge label="Patrium Participações" />
                  <EntityBadge label="Sócio Majoritário" />
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  Garantia Legal
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Todas as respostas do JARVIS são baseadas nos documentos auditados presentes no cofre digital.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function AgentStatus({ label, status }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
      <span className="text-xs font-bold text-foreground/80">{label}</span>
      <span className="text-[9px] font-black uppercase tracking-widest text-primary animate-pulse">{status}</span>
    </div>
  );
}

function EntityBadge({ label }: any) {
  return (
    <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground truncate text-center">
      {label}
    </div>
  );
}
