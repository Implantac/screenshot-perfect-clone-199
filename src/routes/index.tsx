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
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SectionHeader, FeatureCard, ComparisonTable, PricingCard } from "@/components/LandingPageComponents";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

        <button className="md:hidden p-2 text-white bg-white/5 rounded-xl border border-white/10" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
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
              A nova categoria em inteligência patrimonial. Proteção, governança e conformidade em um ecossistema autônomo de alta performance.
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

      {/* Features */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Soluções" title="Governança Patrimonial Inteligente" subtitle="Não somos um software de gestão comum. Somos o sistema operacional para proteção e governança patrimonial de longo prazo." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard delay={0.1} icon={Network} title="Knowledge Graph" desc="Mapeamento total da rede societária, conectando holdings, sócios e ativos em tempo real." />
          <FeatureCard delay={0.2} icon={Lock} title="Digital Twin" desc="Espelhamento digital de ativos com rastreabilidade total de documentos, riscos e histórico." />
          <FeatureCard delay={0.3} icon={ShieldCheck} title="Compliance 360" desc="Monitoramento autônomo de regularidade, licenças e certidões com alertas preditivos." />
        </div>
      </section>

      <ProblemSection />

      {/* Comparison */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Análise" title="Por que o Patrium?" />
        <ComparisonTable />
      </section>

      <MarketAnalysis />

      {/* Pricing */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Planos" title="Investimento Estratégico" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PricingCard plan="Professional" price="R$ 997" desc="Para escritórios e consultorias." features={["Governança Patrimonial", "Gestão Documental", "Suporte Básico"]} />
          <PricingCard plan="Business" price="R$ 2.997" desc="Para holdings e empresas." highlighted={true} features={["Tudo do Professional", "Digital Twin", "Compliance 360", "Knowledge Graph"]} />
          <PricingCard plan="Enterprise" price="R$ 7.997" desc="Para grupos econômicos e FOs." features={["Jarvis AI Autônomo", "Gestão de Riscos", "Due Diligence Avançada", "Suporte Dedicated"]} />
          <PricingCard plan="Corporate" price="Sob Consulta" desc="Grandes grupos econômicos." features={["Customização Total", "Multi-Agentes Jarvis", "Segurança Militar", "SLA Garantido"]} />
        </div>
      </section>


      {/* Jarvis Special Section */}
      <section className="py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-transparent via-primary/5 to-transparent">
        <div className="max-w-6xl mx-auto glass-card p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] border-white/5 bg-black/40 backdrop-blur-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[120px] -z-10 animate-pulse" />
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase leading-none">CONHEÇA O <span className="text-primary">JARVIS</span></h2>
              <p className="text-muted-foreground text-xl leading-relaxed">
                Seu Diretor Patrimonial Digital. O Jarvis monitora continuamente seu patrimônio, detectando riscos antes que se tornem problemas e gerando planos de ação estratégicos automaticamente.
              </p>
              <div className="space-y-4">
                {["Monitoramento de Contratos e Imóveis", "Alertas de Certidões e Licenças", "Identificação de Riscos em Tempo Real", "Insights de Governança e Compliance"].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest">{item}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="rounded-2xl px-10 h-14 bg-primary text-white font-black uppercase tracking-widest text-[10px]">Ver em Ação</Button>
            </div>
            <div className="flex-1 w-full aspect-square bg-white/5 rounded-2xl md:rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
              <div className="text-center p-8">
                <Cpu className="h-16 w-16 text-primary mx-auto mb-6 opacity-50" />
                <p className="text-muted-foreground font-black italic tracking-widest uppercase text-xs opacity-50">Jarvis Intelligence Core</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VisionSection />

      {/* Roadmap */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Evolução" title="Roadmap Tecnológico" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { phase: "Fase 1", title: "Governança Patrimonial", status: "Nativo" },
            { phase: "Fase 2", title: "Compliance Automático", status: "Nativo" },
            { phase: "Fase 3", title: "Jarvis AI Avançado", status: "Beta" },
            { phase: "Fase 4", title: "Agro Patrimonial", status: "Próximo" }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">{item.phase}</span>
              <h4 className="text-lg font-bold mb-4">{item.title}</h4>
              <span className={`text-[8px] px-2 py-1 rounded-full font-black uppercase tracking-widest ${item.status === 'Nativo' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}

      <footer className="py-20 px-4 md:px-8 border-t border-white/5 bg-[#030303]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-6" />
                <span className="font-black tracking-widest text-lg uppercase italic">USE PATRIUM</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Líder em tecnologia para Governança Patrimonial e Inteligência Executiva no Brasil.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Plataforma</h4>
              <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Digital Twin</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Jarvis AI</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Knowledge Graph</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Empresa</h4>
              <ul className="space-y-4 text-sm text-muted-foreground font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre Nós</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Segurança</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Newsletter</h4>
              <div className="flex gap-2">
                <input type="email" placeholder="E-mail corporativo" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs w-full outline-none focus:border-primary/50 transition-all" />
                <Button className="rounded-xl h-10 w-10 p-0"><ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <p>© 2026 Strategy & Governance • Secure Infrastructure</p>
            <div className="flex gap-8">
              <a href="#">Privacidade</a>
              <a href="#">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProblemSection() {
  const problems = [
    { title: "Documentos Dispersos", desc: "Contratos, matrículas e licenças espalhados em múltiplas pastas e sistemas." },
    { title: "Riscos Invisíveis", desc: "Certidões vencidas e prazos perdidos que geram multas e insegurança jurídica." },
    { title: "Processos Manuais", desc: "Dependência de planilhas e memórias individuais para o controle do patrimônio." },
    { title: "Falta de Governança", desc: "Dificuldade em visualizar a estrutura sucessória e societária de forma clara." },
  ];

  return (
    <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
      <SectionHeader badge="O Desafio" title="A Complexidade Patrimonial" subtitle="Empresas e famílias perdem milhões anualmente por falta de visibilidade e controle sobre seus ativos." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {problems.map((p, i) => (
          <div key={i} className="p-8 rounded-[2rem] bg-red-500/[0.02] border border-red-500/10 space-y-4">
            <AlertTriangle className="h-6 w-6 text-red-500/50" />
            <h4 className="text-lg font-bold text-white/90">{p.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketAnalysis() {
  return (
    <section className="py-20 md:py-32 px-4 md:px-8 bg-[#080808] border-y border-white/5">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <SectionHeader badge="Mercado" title="Uma Nova Categoria" subtitle="O crescimento de Holdings e Family Offices no Brasil exige um novo padrão de tecnologia." />
          <div className="space-y-6">
            <div className="flex gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <TrendingUp className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h5 className="font-bold mb-1">+400% no volume de Holdings</h5>
                <p className="text-sm text-muted-foreground">Crescimento acelerado na busca por proteção patrimonial e sucessória no Brasil.</p>
              </div>
            </div>
            <div className="flex gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <Scale className="h-8 w-8 text-primary shrink-0" />
              <div>
                <h5 className="font-bold mb-1">Necessidade Rigorosa de Compliance</h5>
                <p className="text-sm text-muted-foreground">Novas regulamentações exigem monitoramento contínuo de ativos e sócios.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Holdings Familiares", icon: Building2 },
            { label: "Family Offices", icon: Users },
            { label: "Grupos do Agronegócio", icon: Globe },
            { label: "Escritórios de Advocacia", icon: Scale }
          ].map((item, i) => (
            <div key={i} className="aspect-square rounded-[2.5rem] bg-white/[0.01] border border-white/5 flex flex-col items-center justify-center p-6 text-center space-y-4 hover:border-primary/20 transition-colors">
              <item.icon className="h-10 w-10 text-primary/40" />
              <span className="text-[10px] font-black uppercase tracking-widest leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VisionSection() {
  return (
    <section className="py-20 md:py-40 px-4 md:px-8 text-center max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="space-y-12"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Nossa Visão</span>
        <h2 className="text-4xl md:text-7xl font-black italic uppercase tracking-tighter leading-[0.9]">
          CONSTRUINDO O FUTURO DA GOVERNANÇA.
        </h2>
        <p className="text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium italic">
          "Estamos criando um cérebro patrimonial capaz de proteger, organizar e potencializar o patrimônio de empresas, holdings e famílias por gerações."
        </p>
        <div className="pt-8">
          <Button size="lg" className="rounded-full px-12 h-16 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-white/90">Solicitar Demonstração</Button>
        </div>
      </motion.div>
    </section>
  );
}



