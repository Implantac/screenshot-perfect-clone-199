import { createFileRoute } from "@tanstack/react-router";
import { Send, Bot, User as UserIcon, Sparkles, ShieldCheck, Brain, Loader2, Database, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useJarvisChat } from "@/hooks/useJarvisChat";
import { MarkdownLite } from "@/components/jarvis/MarkdownLite";

export const Route = createFileRoute("/_app/jarvis/chat")({
  component: JarvisChatPage,
});

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  local: "Analítico local",
};

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function JarvisChatPage() {
  const { messages, send, isThinking, status, briefing, isBriefingLoading } = useJarvisChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const providerLabel = PROVIDER_LABEL[status?.provider ?? "local"] ?? "Analítico local";
  const hasData = (briefing?.totals.assets ?? 0) > 0 || (briefing?.totals.entities ?? 0) > 0;

  return (
    <div className="h-[calc(100vh-200px)] lg:h-[calc(100vh-280px)] flex flex-col gap-6 max-w-[1800px] mx-auto w-full">
      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col glass-card rounded-3xl lg:rounded-[3rem] border-white/5 bg-white/[0.01] overflow-hidden">
          <div className="px-6 lg:px-10 py-4 lg:py-6 border-b border-white/5 flex items-center justify-between gap-4 bg-white/[0.01]">
            <div className="flex items-center gap-3 lg:gap-4 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.1)] shrink-0">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base lg:text-lg font-black italic tracking-tighter uppercase leading-none truncate">
                  JARVIS <span className="text-primary lg:inline hidden">CHAT</span>
                </h3>
                <p className="text-[8px] lg:text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1 truncate">
                  Contexto: seu portfólio via RLS
                </p>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border shrink-0",
                status?.configured
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : "bg-primary/10 border-primary/20",
              )}
              title={
                status?.configured
                  ? `Modelo ${status.model}`
                  : "Sem provedor de LLM configurado: respostas geradas pelo analista local sobre os dados reais."
              }
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full animate-pulse",
                  status?.configured ? "bg-emerald-500" : "bg-primary",
                )}
              />
              <span
                className={cn(
                  "text-[8px] lg:text-[9px] font-black uppercase tracking-widest",
                  status?.configured ? "text-emerald-500" : "text-primary",
                )}
              >
                {status?.configured ? `IA Online · ${providerLabel}` : "Modo analítico local"}
              </span>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 lg:space-y-8 scrollbar-none">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 lg:gap-6 max-w-full lg:max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "",
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                    msg.role === "assistant"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-white/5 text-muted-foreground border-white/10",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="h-5 w-5 lg:h-6 lg:w-6" />
                  ) : (
                    <UserIcon className="h-5 w-5 lg:h-6 lg:w-6" />
                  )}
                </div>

                <div className="space-y-3 min-w-0">
                  <div
                    className={cn(
                      "p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] text-[13px] lg:text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-white/[0.03] border border-white/5 text-foreground/90 font-medium"
                        : "bg-primary text-primary-foreground font-bold shadow-xl shadow-primary/10 whitespace-pre-wrap",
                    )}
                  >
                    {msg.role === "assistant" ? <MarkdownLite text={msg.content} /> : msg.content}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((s) => (
                        <span
                          key={s.label}
                          className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[9px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                          {s.label}: <span className="text-foreground/80 normal-case tracking-normal">{s.value}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.followUps.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          disabled={isThinking}
                          className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm disabled:opacity-50 truncate max-w-[280px]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {isThinking && (
              <div className="flex gap-4 lg:gap-6">
                <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-xl lg:rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div className="px-5 py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Lendo patrimônio, riscos e vencimentos…
                </div>
              </div>
            )}
          </div>

          <div className="p-6 lg:p-8 border-t border-white/5 bg-white/[0.01] shrink-0">
            <div className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Pergunte ao JARVIS..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl lg:rounded-3xl py-4 lg:py-6 pl-6 lg:pl-8 pr-16 lg:pr-20 text-sm lg:text-base font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/30"
              />
              <button
                onClick={handleSend}
                disabled={isThinking || !input.trim()}
                className="absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 h-10 w-10 lg:h-14 lg:w-14 bg-primary text-primary-foreground rounded-xl lg:rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Send className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Context Panel — agora com números reais */}
        <div className="w-full lg:w-[320px] xl:w-[380px] hidden lg:block shrink-0">
          <div className="glass-card rounded-3xl lg:rounded-[3rem] p-6 lg:p-8 border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent h-full overflow-hidden flex flex-col">
            <h4 className="text-xs lg:text-sm font-black italic tracking-tighter uppercase mb-6 flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              Contexto operacional
            </h4>

            <div className="flex-1 space-y-6 overflow-y-auto scrollbar-none pb-4">
              {isBriefingLoading ? (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest">
                  <Loader2 className="h-3 w-3 animate-spin" /> Lendo dados…
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                      Base de dados
                    </p>
                    <ContextRow label="Patrimônio" value={brl(briefing?.totals.aum ?? 0)} />
                    <ContextRow label="Ativos" value={String(briefing?.totals.assets ?? 0)} />
                    <ContextRow label="Holdings" value={String(briefing?.totals.entities ?? 0)} />
                    <ContextRow
                      label="Riscos abertos"
                      value={`${briefing?.totals.risksOpen ?? 0} (${briefing?.totals.risksCritical ?? 0} crít.)`}
                    />
                    <ContextRow
                      label="Docs vencidos"
                      value={`${briefing?.totals.documentsOverdue ?? 0}`}
                    />
                  </div>

                  {(briefing?.entities.length ?? 0) > 0 && (
                    <div className="space-y-3">
                      <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                        Entidades monitoradas
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {briefing?.entities.map((e) => (
                          <div
                            key={e.name}
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-muted-foreground flex items-center justify-between gap-2"
                          >
                            <span className="truncate">{e.name}</span>
                            <span className="text-primary shrink-0">{e.compliance}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!hasData && (
                    <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-orange-400">
                        <AlertTriangle className="h-3 w-3" /> Sem dados
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        O JARVIS só responde sobre o que existe no seu tenant. Popule a demonstração no topo da
                        página para ver o agente trabalhando com números reais.
                      </p>
                    </div>
                  )}

                  <div className="p-4 lg:p-6 rounded-2xl lg:rounded-3xl bg-primary/5 border border-primary/20 space-y-3">
                    <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3 text-primary" />
                      Origem das respostas
                    </p>
                    <p className="text-[11px] lg:text-xs text-muted-foreground leading-relaxed">
                      {status?.configured
                        ? `Modelo ${status.model} via ${providerLabel}, alimentado apenas pelo briefing do seu patrimônio.`
                        : "Nenhum provedor de LLM configurado: as respostas são geradas pelo analista local determinístico, sobre os mesmos números."}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 flex items-center gap-1.5">
                      <Database className="h-3 w-3" /> consultas autenticadas, escopo por RLS
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
      <span className="text-[10px] lg:text-[11px] font-bold text-muted-foreground truncate">{label}</span>
      <span className="text-[11px] lg:text-xs font-black text-foreground tabular-nums shrink-0">{value}</span>
    </div>
  );
}
