import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Search, Bell, Sparkles, X, Send, Bot, User as UserIcon, ArrowUpRight, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { text: "Protocolos JARVIS iniciados. Como posso auxiliar em sua estratégia patrimonial hoje, Gestor?", isAi: true }
  ]);

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setMessages(prev => [...prev, { text: userMsg, isAi: false }]);
    setChatInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, { text: "Analisando sua solicitação com base nos dados do patrimônio... Em que mais posso ajudar?", isAi: true }]);
    }, 1000);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.div 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-72 bg-sidebar border-r border-sidebar-border shadow-2xl transition-transform lg:translate-x-0",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar />
      </motion.div>
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 bg-background/50 backdrop-blur-xl z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-xl"
            >
              <Menu className="h-6 w-6 text-muted-foreground" />
            </button>
            <div className="relative w-full max-w-xl group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input 
                type="text" 
                placeholder="Pesquisar em todo o patrimônio..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors relative group shrink-0">
              <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-primary rounded-full border-2 border-background" />
            </button>
            
            <button 
              onClick={() => setIsAiOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden lg:inline">Jarvis AI</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="p-4 lg:p-8 pb-20"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* AI Copilot Side Drawer */}
        <AnimatePresence>
          {isAiOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAiOpen(false)}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
              />
              <motion.div 
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 h-full w-full lg:w-[450px] bg-card border-l border-white/5 z-[60] shadow-2xl flex flex-col"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" 
                      alt="Logo" 
                      className="h-8 w-auto object-contain"
                    />
                    <div>
                      <h2 className="font-bold text-lg leading-tight uppercase tracking-tighter">JARVIS PATRIUM</h2>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Diretor Patrimonial Digital</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsAiOpen(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-none">
                  <div className="p-5 rounded-3xl bg-primary/5 border border-primary/20 space-y-4">
                     <p className="text-xs font-bold flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        Sugestão do Dia
                     </p>
                     <p className="text-xs text-muted-foreground leading-relaxed">
                        Detectamos uma variação positiva de mercado para ativos rurais no Centro-Oeste. Sua Fazenda Santa Fé valorizou aproximadamente <span className="text-primary font-bold">R$ 2.4M</span> no último trimestre.
                     </p>
                     <button className="w-full py-3 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/20 transition-all">
                        Ver Dossiê de Mercado
                        <ArrowUpRight className="h-3.5 w-3.5" />
                     </button>
                  </div>

                  <div className="space-y-6">
                    {messages.map((msg, i) => (
                      <AiBubble key={i} isAi={msg.isAi} text={msg.text} />
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-background/50">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Descreva sua dúvida estratégica..." 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:ring-primary/50"
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function AiBubble({ text, isAi }: { text: string; isAi?: boolean }) {
  return (
    <div className={cn("flex gap-3", isAi ? "flex-row" : "flex-row-reverse")}>
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
        isAi ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/5 text-muted-foreground border border-white/10"
      )}>
        {isAi ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed",
        isAi ? "bg-white/5 border border-white/5 text-muted-foreground" : "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/10"
      )}>
        {text}
      </div>
    </div>
  );
}
