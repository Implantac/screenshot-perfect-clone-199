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
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 font-sans overflow-x-hidden">
      <nav className="fixed top-0 w-full z-50 px-4 md:px-8 py-4 md:py-6 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-6 md:h-8" />
          <span className="font-black tracking-widest text-base md:text-lg uppercase italic truncate">USE PATRIUM</span>
        </div>
        
        <div className="hidden md:flex items-center gap-6">
          <a href="/login" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">Acessar Sistema</a>
          <Button className="rounded-full px-8 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-white/90">Solicitar Demo</Button>
        </div>

        <button className="md:hidden p-2 text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Hero */}
      <section className="pt-32 md:pt-48 pb-20 md:pb-32 px-4 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-[#050505] to-[#050505]" />
        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            <Sparkles className="h-4 w-4" /> Strategic Asset Intelligence
          </motion.div>
          <h1 className="text-5xl md:text-9xl font-black tracking-tighter leading-[0.85] italic uppercase">
            USE PATRIUM <span className="text-primary">OS</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            A primeira plataforma brasileira capaz de centralizar patrimônio, compliance e inteligência executiva.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button size="lg" className="rounded-2xl px-12 h-16 bg-primary text-white font-black uppercase tracking-[0.2em] text-xs">Solicitar Demonstração</Button>
            <Button size="lg" variant="outline" className="rounded-2xl px-12 h-16 border-white/10 bg-white/5 font-black uppercase tracking-[0.2em] text-xs">Conhecer o Jarvis</Button>
          </div>
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
            <div className="flex-1 w-full aspect-square bg-white/5 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl">
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


