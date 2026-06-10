import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Sparkles, 
  Network, 
  Lock, 
  CheckCircle2,
  Menu,
  X,
  Building2,
  Briefcase,
  Users,
  BarChart3,
  Scale,
  ArrowRight,
  Cpu,
  AlertTriangle,
  TrendingUp,
  Globe,
  Database,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { 
  SectionHeader, 
  FeatureCard, 
  ComparisonTable, 
  PricingCard,
  KnowledgeGraphAnimation,
  ArchitectureFlow,
  ModuleGrid
} from "@/components/LandingPageComponents";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30 font-sans overflow-x-hidden w-full relative">
      <div className="fixed inset-0 noise-overlay z-[100]" />
      
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-12 py-6 md:py-8 flex items-center justify-between bg-background/60 backdrop-blur-2xl border-b border-white/[0.03]">
        <div className="flex items-center gap-3">
          <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-7 md:h-10" />
          <div className="flex flex-col">
            <span className="font-black tracking-[0.3em] text-sm md:text-base uppercase italic leading-none">USE PATRIUM</span>
            <span className="text-[8px] font-bold tracking-[0.5em] uppercase text-primary/80 mt-1">Strategic Intelligence</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <div className="flex items-center gap-8">
            {["Soluções", "Tecnologia", "Análise", "Empresa"].map((item) => (
              <a key={item} href="#" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-white transition-colors">{item}</a>
            ))}
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-6">
            <a href="/login" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:text-white transition-colors">Acessar</a>
            <Button className="rounded-full px-10 h-12 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-white/90 border-none">Solicitar Demonstração</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 md:pt-64 pb-20 md:pb-40 px-4 md:px-8 relative overflow-hidden w-full executive-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-background" />
        <div className="max-w-7xl mx-auto text-center relative z-10 space-y-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/[0.02] border border-white/[0.05] text-[10px] font-black uppercase tracking-[0.4em] text-primary backdrop-blur-xl shadow-2xl"
          >
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Governance & Strategic Intelligence
          </motion.div>
          
          <div className="space-y-6">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl md:text-[11rem] font-black tracking-tighter leading-[0.8] italic uppercase"
            >
              USE PATRIUM <span className="text-primary drop-shadow-[0_0_50px_rgba(212,163,85,0.2)]">OS</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xl md:text-3xl text-muted-foreground max-w-4xl mx-auto leading-relaxed font-medium italic"
            >
              O Sistema Operacional do Patrimônio Corporativo. A primeira plataforma brasileira capaz de centralizar governança, compliance e inteligência executiva em um único ambiente.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-12"
          >
            <Button size="lg" className="rounded-2xl px-14 h-20 bg-primary text-black font-black uppercase tracking-[0.25em] text-xs hover:scale-105 transition-all shadow-2xl shadow-primary/20 border-none">Solicitar Demonstração</Button>
            <Button size="lg" variant="outline" className="rounded-2xl px-14 h-20 border-white/10 bg-white/[0.02] font-black uppercase tracking-[0.25em] text-xs backdrop-blur-xl hover:bg-white/5 transition-all">Conhecer o Jarvis</Button>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto space-y-40">
        <ProblemSection />
        <SolutionSection />
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Arquitetura" title="Fluxo Inteligente" subtitle="A integração profunda entre dados, inteligência e ação executiva." />
        <ArchitectureFlow />
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="O Jarvis" title="Seu Diretor Patrimonial Digital" subtitle="Monitoramento 24/7 de ativos, certidões e contratos com inteligência preditiva." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <p className="text-xl text-muted-foreground italic leading-relaxed">O Jarvis não apenas armazena; ele entende. Ao monitorar continuamente holdings, imóveis e certidões, ele detecta riscos e sugere planos de ação imediatos.</p>
            <div className="space-y-4">
              {[
                "Detecção autônoma de vencimentos",
                "Alertas preditivos de compliance",
                "Insights de regularização imobiliária",
                "Priorização de ações críticas"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest opacity-80">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-8 rounded-[3rem] bg-white/[0.02] border border-white/10 space-y-6">
            <div className="flex gap-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs italic font-medium">"Detectei 3 certidões vencidas na Holding X. Deseja iniciar o protocolo de renovação?"</p>
            </div>
            <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 translate-x-4">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-xs italic font-medium">"Uma licença ambiental na Fazenda Y vence em 12 dias. Plano de ação prioritário criado."</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Módulos" title="Plataforma Integrada" subtitle="Ferramentas especializadas para cada camada da governança patrimonial." />
        <ModuleGrid />
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Tecnologia" title="Knowledge Graph & Digital Twin" subtitle="Visualize e controle cada ativo com precisão absoluta." />
        <KnowledgeGraphAnimation />
      </section>

      <MarketAnalysis />

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Comparativo" title="Patrium vs Mercado" subtitle="A diferença entre gestão passiva e governança inteligente." />
        <ComparisonTable />
      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Planos" title="Investimento Estratégico" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PricingCard plan="Professional" price="R$ 997+" desc="Escritórios e consultorias patrimoniais." features={["Governança Patrimonial", "Gestão Documental", "Suporte Básico", "ROI: 3x no primeiro ano"]} />
          <PricingCard plan="Business" price="R$ 2.997+" desc="Holdings e empresas familiares." highlighted={true} features={["Tudo do Professional", "Digital Twin Hub", "Compliance 360", "Knowledge Graph", "ROI: 5x em eficiência"]} />
          <PricingCard plan="Enterprise" price="R$ 7.997+" desc="Family Offices e grupos econômicos." features={["Jarvis AI Autônomo", "Gestão de Riscos", "Due Diligence Avançada", "Suporte Dedicated", "ROI: Proteção de Legado"]} />
          <PricingCard plan="Corporate" price="Custom" desc="Grandes grupos e prefeituras." features={["Customização Total", "Multi-Agentes Jarvis", "Segurança Militar", "SLA Garantido", "ROI: Governança Infinita"]} />
        </div>
        <div className="mt-12 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary/40">Ticket médio estimado por complexidade de estrutura.</p>
        </div>

      </section>

      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Evolução" title="Roadmap Tecnológico" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { phase: "Fase 1", title: "Governança Patrimonial", status: "Operational" },
            { phase: "Fase 2", title: "Compliance Preditivo", status: "Operational" },
            { phase: "Fase 3", title: "Regularização Imobiliária", status: "Operational" },
            { phase: "Fase 4", title: "Agronegócio Patrimonial", status: "Beta" },
            { phase: "Fase 5", title: "Jarvis Autônomo", status: "Development" },
            { phase: "Fase 6", title: "Marketplace de Ativos", status: "Planning" },
            { phase: "Fase 7", title: "Integração Cartórios", status: "Planning" },
            { phase: "Fase 8", title: "GovTech Unificada", status: "Vision" }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.phase}</span>
              <h4 className="text-base font-bold italic uppercase leading-tight">{item.title}</h4>
              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">{item.status}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-40 px-4 md:px-8 text-center max-w-5xl mx-auto">
        <SectionHeader badge="Visão de Futuro" title="THE NEXT GENERATION OF GOVERNANCE." />
        <p className="text-xl md:text-3xl text-muted-foreground italic font-medium leading-relaxed max-w-4xl mx-auto">"O USE PATRIUM está construindo a próxima geração da Governança Patrimonial no Brasil. Estamos criando um cérebro patrimonial capaz de proteger, organizar e potencializar o patrimônio de gerações."</p>
      </section>

      <footer className="py-20 px-4 md:px-8 border-t border-white/5 bg-[#030303] mt-32">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter">Transforme seu Legado.</h2>
          <Button className="rounded-full px-12 h-16 bg-primary text-black font-black uppercase tracking-widest text-xs">Falar com Especialista</Button>
        </div>
      </footer>
    </div>
  );
}

function ProblemSection() {
  return (
    <section>
      <SectionHeader badge="O Desafio" title="A Complexidade Silenciosa" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-muted-foreground italic font-medium leading-relaxed">
        <p>A fragmentação de documentos em silos analógicos e digitais, a invisibilidade de riscos e a dependência de processos manuais criam uma opacidade que coloca em risco legados multigeracionais.</p>
        <p>Multas, processos inesperados e a perda de controle sobre a rede societária são as consequências de uma governança patrimonial que não evoluiu tecnologicamente.</p>
      </div>
    </section>
  );
}

function SolutionSection() {
  return (
    <section>
      <SectionHeader badge="A Solução" title="Governança Patrimonial Inteligente" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard icon={Network} title="Knowledge Graph" desc="Mapeamento total da rede societária, conectando holdings, sócios e ativos." />
        <FeatureCard icon={Lock} title="Digital Twin" desc="Espelhamento digital de ativos com rastreabilidade total de documentos e riscos." />
        <FeatureCard icon={ShieldCheck} title="Compliance 360" desc="Monitoramento autônomo de regularidade com alertas preditivos." />
      </div>
    </section>
  );
}

function MarketAnalysis() {
  return (
    <section className="py-20 md:py-40 px-4 md:px-8 bg-white/[0.01] border-y border-white/[0.03] relative overflow-hidden">
      <div className="absolute inset-0 executive-grid opacity-30" />
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center relative z-10">
        <div className="space-y-12">
          <SectionHeader badge="Relatório de Inteligência" title="Quem Utiliza a Patrium" subtitle="Verticalização setorial para as estruturas patrimoniais mais complexas do país." />
          <div className="space-y-8">
            <div className="flex gap-6 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] hover:border-primary/20 transition-all backdrop-blur-xl">
              <Building2 className="h-10 w-10 text-primary shrink-0" />
              <div>
                <h5 className="font-black italic uppercase tracking-tight text-lg mb-2">Holdings & Family Offices</h5>
                <p className="text-sm text-muted-foreground italic font-medium leading-relaxed">Centralização de múltiplas empresas e sócios em um único grafo de governança.</p>
              </div>
            </div>
            <div className="flex gap-6 p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] hover:border-primary/20 transition-all backdrop-blur-xl">
              <Globe className="h-10 w-10 text-primary shrink-0" />
              <div>
                <h5 className="font-black italic uppercase tracking-tight text-lg mb-2">Agronegócio Patrimonial</h5>
                <p className="text-sm text-muted-foreground italic font-medium leading-relaxed">Gestão de fazendas, matrículas, CAR e ativos biológicos com precisão militar.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {[
            { label: "Consultorias", icon: Briefcase },
            { label: "Boutiques Jurídicas", icon: Scale },
            { label: "Grupos do Agro", icon: Globe },
            { label: "Family Offices", icon: Users }
          ].map((item, i) => (
            <div key={i} className="aspect-square rounded-[3.5rem] bg-white/[0.02] border border-white/[0.05] flex flex-col items-center justify-center p-8 text-center space-y-6 hover:border-primary/40 transition-all group backdrop-blur-xl">
              <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/[0.05] group-hover:scale-110 group-hover:bg-primary/10 transition-all">
                <item.icon className="h-8 w-8 text-primary/60 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-tight italic">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
