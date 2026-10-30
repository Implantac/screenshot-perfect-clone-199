import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Search, Bell, Sparkles, X, Send, Bot, User as UserIcon, Menu, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJarvisChat } from "@/hooks/useJarvisChat";
import { MarkdownLite } from "@/components/jarvis/MarkdownLite";
import { DemoBanner } from "@/components/demo/DemoBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const { messages, send, isThinking, status, briefing } = useJarvisChat();

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    send(chatInput);
    setChatInput("");
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans w-full max-w-[100vw]">
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
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
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
              aria-label="Abrir menu"
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
              <DemoBanner />
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg leading-tight uppercase tracking-tighter">JARVIS PATRIUM</h2>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest truncate">
                        {status?.configured ? `Diretor Digital · ${status.model}` : "Diretor Digital · modo local"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAiOpen(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors shrink-0"
                    aria-label="Fechar JARVIS"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
                  <div className="p-5 rounded-3xl bg-primary/5 border border-primary/20 space-y-3">
                    <p className="text-xs font-bold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Base de contexto
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {briefing
                        ? `${briefing.totals.assets} ativos · ${briefing.totals.entities} holdings · ${briefing.totals.risksOpen} riscos abertos · ${briefing.totals.documentsOverdue} documentos vencidos.`
                        : "Lendo seu patrimônio…"}
                    </p>
                  </div>

                  <div className="space-y-6">
                    {messages.slice(-6).map((msg) => (
                      <AiBubble key={msg.id} isAi={msg.role === "assistant"} text={msg.content} />
                    ))}
                    {isThinking && (
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> analisando…
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-background/50">
                  <div className="relative">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Descreva sua dúvida estratégica..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={isThinking || !chatInput.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50"
                      aria-label="Enviar"
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
      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          isAi
            ? "bg-primary/10 text-primary border border-primary/20"
            : "bg-white/5 text-muted-foreground border border-white/10",
        )}
      >
        {isAi ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed min-w-0",
          isAi
            ? "bg-white/5 border border-white/5 text-muted-foreground"
            : "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/10 whitespace-pre-wrap",
        )}
      >
        {isAi ? <MarkdownLite text={text} /> : text}
      </div>
    </div>
  );
}
