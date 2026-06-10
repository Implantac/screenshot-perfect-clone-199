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
import { 
  SectionHeader, 
  FeatureCard, 
  ComparisonTable, 
  PricingCard,
  KnowledgeGraphAnimation 
} from "@/components/LandingPageComponents";

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

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-3xl pt-32 px-8 flex flex-col gap-8 md:hidden"
          >
            {["Soluções", "Tecnologia", "Análise", "Empresa"].map((item) => (
              <a key={item} href="#" className="text-2xl font-black uppercase tracking-widest text-white/70 hover:text-white">{item}</a>
            ))}
            <div className="h-px w-full bg-white/10 my-4" />
            <a href="/login" className="text-2xl font-black uppercase tracking-widest text-primary">Acessar</a>
            <Button className="rounded-2xl h-16 bg-primary text-black font-black uppercase tracking-widest text-xs">Solicitar Demonstração</Button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Seção 2: O Problema */}
      <ProblemSection />

      {/* Features - A Solução */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="A Solução" title="Governança Patrimonial Inteligente" subtitle="O USE PATRIUM não é apenas um software. É o Sistema Operacional que unifica todas as verticais de gestão e conformidade." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard delay={0.1} icon={Network} title="Knowledge Graph" desc="Mapeamento total da rede societária, conectando holdings, sócios e ativos em tempo real." />
          <FeatureCard delay={0.2} icon={Lock} title="Digital Twin" desc="Espelhamento digital de ativos com rastreabilidade total de documentos, riscos e histórico." />
          <FeatureCard delay={0.3} icon={ShieldCheck} title="Compliance 360" desc="Monitoramento autônomo de regularidade, licenças e certidões com alertas preditivos." />
        </div>
      </section>

      {/* Knowledge Graph Preview */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Tecnologia" title="Relacionamentos Conectados" subtitle="Visualize a capilaridade total do seu patrimônio. Da Holding ao Ativo final, tudo interligado pelo Knowledge Graph." />
        <KnowledgeGraphAnimation />
      </section>

      {/* Jarvis Section */}
      <section className="py-20 md:py-32 px-4 md:px-8 bg-gradient-to-b from-transparent via-primary/5 to-transparent relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 blur-[150px] -z-10 animate-pulse" />
        <div className="max-w-6xl mx-auto glass-card p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] border-white/5 bg-black/40 backdrop-blur-3xl">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase leading-none">CONHEÇA O <span className="text-primary">JARVIS</span></h2>
              <p className="text-primary/60 font-black tracking-widest uppercase text-xs">Seu Diretor Patrimonial Digital</p>
              <p className="text-muted-foreground text-xl leading-relaxed">
                O Jarvis monitora continuamente seu patrimônio. Ele detecta riscos, gera insights estratégicos e cria planos de ação automáticos para garantir a conformidade total.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  "Detecta riscos em tempo real", 
                  "Gera planos de ação", 
                  "Prioriza problemas críticos", 
                  "Sugere decisões executivas"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{item}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" className="rounded-2xl px-10 h-16 bg-primary text-black font-black uppercase tracking-widest text-[10px]">Ativar Jarvis Intelligence</Button>
            </div>
            <div className="flex-1 w-full bg-white/[0.02] rounded-[3rem] border border-white/10 p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium italic text-white/80">"Detectei 3 certidões que vencem nos próximos 15 dias. Deseja que eu gere o protocolo de renovação?"</p>
                </div>
                <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/10 translate-x-4">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-xs font-medium italic text-white/80">"Uma licença ambiental para a Fazenda X expira em 12 dias. Plano de ação prioritário criado."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Análise de Mercado" title="Patrium vs Legacy Systems" subtitle="A governança patrimonial de alta performance exige tecnologia de nova geração." />
        <ComparisonTable />
      </section>

      {/* Market Analysis / Quem utiliza */}
      <MarketAnalysis />

      {/* Pricing */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Planos" title="Investimento Estratégico" subtitle="Estruturas de custo escaláveis para escritórios, holdings e grupos econômicos." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <PricingCard plan="Professional" price="R$ 997" desc="Para escritórios e consultorias." features={["Governança Patrimonial", "Gestão Documental", "Suporte Básico"]} />
          <PricingCard plan="Business" price="R$ 2.997" desc="Para holdings e empresas." highlighted={true} features={["Tudo do Professional", "Digital Twin", "Compliance 360", "Knowledge Graph"]} />
          <PricingCard plan="Enterprise" price="R$ 7.997" desc="Para grupos econômicos e FOs." features={["Jarvis AI Autônomo", "Gestão de Riscos", "Due Diligence Avançada", "Suporte Dedicated"]} />
          <PricingCard plan="Corporate" price="Sob Consulta" desc="Grandes grupos econômicos." features={["Customização Total", "Multi-Agentes Jarvis", "Segurança Militar", "SLA Garantido"]} />
        </div>
      </section>

      {/* Vision Section */}
      <VisionSection />

      {/* Roadmap */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Futuro" title="Roadmap Tecnológico" subtitle="Nossa trajetória rumo à autonomia total da governança patrimonial." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { phase: "Fase 1", title: "Governança Patrimonial", status: "Operacional" },
            { phase: "Fase 2", title: "Compliance Preditivo", status: "Operacional" },
            { phase: "Fase 3", title: "Regularização Imobiliária", status: "Beta" },
            { phase: "Fase 4", title: "Jarvis Autônomo 2.0", status: "Próximo" }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-4">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">{item.phase}</span>
              <h4 className="text-lg font-bold italic uppercase">{item.title}</h4>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-4 md:px-8 border-t border-white/5 bg-[#030303]">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-8" />
                <span className="font-black tracking-widest text-xl uppercase italic">USE PATRIUM</span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed italic font-medium">
                O futuro da Governança Patrimonial. Protegendo legados através de inteligência executiva de alta performance.
              </p>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-primary">Plataforma</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-white/60">
                <li><a href="#" className="hover:text-primary transition-colors">Jarvis Intelligence</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Digital Twin Hub</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Compliance Protocol</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-primary">Governança</h4>
              <ul className="space-y-4 text-xs font-bold uppercase tracking-widest text-white/60">
                <li><a href="#" className="hover:text-primary transition-colors">Holdings</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Agronegócio</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Family Office</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 text-primary">Corporativo</h4>
              <div className="flex gap-2">
                <Button className="rounded-xl flex-grow h-12 bg-white text-black font-black uppercase tracking-widest text-[10px]">Falar com Especialista</Button>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] font-black uppercase tracking-[0.4em] text-white/20">
            <p>© 2026 PATRIUM OS • SYSTEMIC GOVERNANCE INFRASTRUCTURE</p>
            <div className="flex gap-8">
              <a href="#">Security Protocol</a>
              <a href="#">Terms of Intelligence</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProblemSection() {
  const problems = [
    { title: "Silos de Dados", desc: "Documentação dispersa em múltiplos ambientes gerando opacidade operacional." },
    { title: "Riscos Invisíveis", desc: "Prazos críticos negligenciados que resultam em passivos jurídicos e financeiros." },
    { title: "Falta de Governança", desc: "Processos manuais e dependência de pessoal-chave sem trilha de auditoria." },
    { title: "Risco Sucessório", desc: "Patrimônios vulneráveis a quebras de compliance e falta de visibilidade societária." },
  ];

  return (
    <section className="py-20 md:py-40 px-4 md:px-8 max-w-7xl mx-auto">
      <SectionHeader badge="O Desafio Executivo" title="A Complexidade Silenciosa" subtitle="Patrimônios complexos sem um sistema operacional centralizado estão expostos a riscos sistêmicos inevitáveis." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {problems.map((p, i) => (
          <div key={i} className="p-10 rounded-[3rem] bg-red-500/[0.01] border border-red-500/10 space-y-6 hover:bg-red-500/[0.02] transition-colors group">
            <div className="h-12 w-12 rounded-xl bg-red-500/5 flex items-center justify-center border border-red-500/10 group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-6 w-6 text-red-500/50" />
            </div>
            <h4 className="text-xl font-black italic uppercase tracking-tighter text-white/90 leading-none">{p.title}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed italic font-medium opacity-80">{p.desc}</p>
          </div>
        ))}
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
          <SectionHeader badge="Intelligence Report" title="Verticalização Setorial" subtitle="O USE PATRIUM é desenhado para as estruturas patrimoniais mais complexas do país." />
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
                <p className="text-sm text-muted-foreground italic font-medium leading-relaxed">Gestão de fazendas, matrículas, CAR, licenças e ativos biológicos com precisão militar.</p>
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

function VisionSection() {
  return (
    <section className="py-20 md:py-60 px-4 md:px-8 text-center max-w-5xl mx-auto relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[150px] -z-10 animate-pulse" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="space-y-16"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Próxima Geração</span>
        <h2 className="text-5xl md:text-[8rem] font-black italic uppercase tracking-tighter leading-[0.8] drop-shadow-2xl">
          THE FUTURE OF <br /> <span className="text-primary">PATRIMONY.</span>
        </h2>
        <p className="text-xl md:text-4xl text-muted-foreground leading-tight font-medium italic max-w-4xl mx-auto">
          "O USE PATRIUM está construindo um cérebro patrimonial capaz de proteger, organizar e potencializar o patrimônio de gerações."
        </p>
        <div className="pt-12">
          <Button size="lg" className="rounded-full px-16 h-20 bg-white text-black font-black uppercase tracking-[0.3em] text-xs hover:scale-105 transition-all shadow-2xl border-none">Solicitar Demonstração</Button>
        </div>
      </motion.div>
    </section>
  );
}
