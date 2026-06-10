import { createFileRoute } from "@tanstack/react-router";
import { 
  Sparkles, 
  BrainCircuit, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  MessageSquare, 
  ArrowRight,
  ChevronRight,
  LineChart,
  BarChart3,
  PieChart as PieIcon,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/inteligencia" as any)({
  component: InteligenciaIA,
});

function InteligenciaIA() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5 fill-primary/20" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">SALA DE GUERRA IA</span>
          </div>
          <h2 className="text-4xl font-black tracking-tight uppercase">Inteligência Estratégica</h2>
          <p className="text-muted-foreground text-lg">Processamento de dados massivos para recomendações patrimoniais em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-primary/10 text-primary border border-primary/20 rounded-2xl font-bold text-sm hover:bg-primary/20 transition-all flex items-center gap-2">
            <BrainCircuit className="h-4 w-4" />
            Recalibrar Modelos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Insights Panel */}
        <div className="xl:col-span-3 space-y-8">
          <div className="glass-card rounded-[2.5rem] p-10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles className="h-48 w-48 text-primary" />
            </div>
            
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-500" />
              Insights de Alta Prioridade
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InsightCard 
                title="Otimização Tributária"
                description="Detectamos uma oportunidade de redução de 12% no ITR da Fazenda Santa Fé via retificação de área de preservação."
                impact="R$ 142.000,00 / ano"
                category="Fiscal"
                action="Aplicar Sugestão"
              />
              <InsightCard 
                title="Alerta de Liquidez"
                description="O fluxo de caixa projetado para a Holding Alencar indica necessidade de aporte em Outubro/2026."
                impact="R$ 2.4M (Déficit)"
                category="Financeiro"
                action="Ver Projeção"
                variant="warning"
              />
              <InsightCard 
                title="Consolidação Societária"
                description="A fusão das holdings Agroinvest e SP Urbanismo pode reduzir custos administrativos em 18%."
                impact="R$ 850.000,00 / ano"
                category="Societário"
                action="Simular Fusão"
              />
              <InsightCard 
                title="Risco Documental"
                description="A matrícula do Edifício Corporate possui uma averbação de 1992 que pode gerar contestação judicial."
                impact="Risco Moderado"
                category="Legal"
                action="Análise Jurídica"
                variant="danger"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <LineChart className="h-5 w-5 text-primary" />
                Saúde Patrimonial (IA Predict)
              </h3>
              <div className="h-48 flex items-end gap-3 px-2">
                {[45, 62, 58, 75, 82, 96, 92].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div 
                      className="w-full bg-primary/20 rounded-t-lg group-hover:bg-primary/40 transition-all" 
                      style={{ height: `${h}%` }}
                    >
                      <div className="h-1 bg-primary rounded-full w-full opacity-0 group-hover:opacity-100" />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">M{i+1}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed text-center px-4">
                Tendência de crescimento de <span className="text-primary font-bold">+4.2%</span> para os próximos 6 meses baseada no mercado atual.
              </p>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PieIcon className="h-5 w-5 text-primary" />
                Alocação por Risco
              </h3>
              <div className="flex items-center justify-between gap-6">
                <div className="h-32 w-32 rounded-full border-[12px] border-primary/10 border-t-primary border-r-emerald-500/50 border-b-orange-500/50 flex items-center justify-center">
                   <span className="text-lg font-black tracking-tighter">96.8</span>
                </div>
                <div className="flex-1 space-y-3">
                   <RiskLegend label="Baixo Risco" color="bg-primary" perc="82%" />
                   <RiskLegend label="Médio Risco" color="bg-emerald-500" perc="14%" />
                   <RiskLegend label="Alto Risco" color="bg-orange-500" perc="4%" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Chat Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 h-full flex flex-col min-h-[600px] border-primary/10">
            <div className="flex items-center gap-3 mb-8">
               <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                  <Sparkles className="h-5 w-5" />
               </div>
               <div>
                  <h4 className="font-bold text-sm">IA Patrium</h4>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Sempre Online</p>
               </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto pr-2 scrollbar-none">
               <ChatMessage 
                text="Olá, Dr. Alencar. Analisei o portfólio hoje e notei que a Holding Alencar possui um excesso de liquidez não alocada de R$ 4.2M. Gostaria de ver opções de ativos rurais?"
                isAi
               />
               <ChatMessage 
                text="Sim, me mostre ativos rurais no Mato Grosso com VGV entre R$ 10M e R$ 20M."
               />
               <ChatMessage 
                text="Encontrei 3 propriedades que encaixam no perfil. Uma delas é lindeira à sua Fazenda Santa Fé, o que facilitaria a gestão operacional."
                isAi
               />
            </div>

            <div className="pt-6 border-t border-white/5 mt-6">
               <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Perguntar à IA..." 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-sm focus:ring-primary/50"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                    <ArrowRight className="h-5 w-5" />
                  </button>
               </div>
               <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase tracking-widest font-bold opacity-50">Powered by Patrium Intelligence</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCard({ title, description, impact, category, action, variant = "default" }: any) {
  const variants: Record<string, string> = {
    default: "border-primary/10 bg-primary/5 text-primary",
    warning: "border-orange-500/10 bg-orange-500/5 text-orange-500",
    danger: "border-red-500/10 bg-red-500/5 text-red-500",
  };

  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all space-y-4">
      <div className="flex items-center justify-between">
        <span className={cn("px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border", variants[variant])}>
          {category}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Impacto Estimado</span>
      </div>
      <div>
        <h4 className="font-bold text-lg">{title}</h4>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center justify-between pt-4">
        <p className={cn("text-sm font-black", variant === 'danger' ? 'text-red-400' : variant === 'warning' ? 'text-orange-400' : 'text-primary')}>{impact}</p>
        <button className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline group">
          {action}
          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function RiskLegend({ label, color, perc }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
        <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      </div>
      <span className="text-xs font-black">{perc}</span>
    </div>
  );
}

function ChatMessage({ text, isAi }: any) {
  return (
    <div className={cn("flex", isAi ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed",
        isAi ? "bg-white/5 border border-white/10 text-muted-foreground" : "bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/10"
      )}>
        {text}
      </div>
    </div>
  );
}
