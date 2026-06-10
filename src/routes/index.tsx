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
  ArrowRight
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

      {/* Comparison */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Análise" title="Por que o Patrium?" />
        <ComparisonTable />
      </section>

      {/* Pricing */}
      <section className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto">
        <SectionHeader badge="Planos" title="Investimento Estratégico" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <PricingCard plan="Professional" price="R$ 997" desc="Para escritórios e consultorias." features={["Governança Patrimonial", "Gestão Documental", "Suporte Básico"]} />
          <PricingCard plan="Business" price="R$ 2.997" desc="Para holdings e empresas." highlighted={true} features={["Tudo do Professional", "Digital Twin", "Compliance 360", "Knowledge Graph"]} />
          <PricingCard plan="Enterprise" price="R$ 7.997" desc="Para grupos econômicos e FOs." features={["Jarvis AI Autônomo", "Gestão de Riscos", "Due Diligence Avançada", "Suporte Dedicated"]} />
        </div>
      </section>
    </div>
  );
}

