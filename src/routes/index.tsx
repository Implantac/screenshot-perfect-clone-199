import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Network, 
  Building2, 
  Lock, 
  TrendingUp,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-8" />
          <span className="font-black tracking-widest text-lg">USE PATRIUM</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="/login" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Acessar Conta</a>
          <Button className="rounded-full px-6 bg-white text-black hover:bg-white/90">Solicitar Demonstração</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-[#050505] to-[#050505] opacity-50" />
        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Nova Era da Governança Patrimonial
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-7xl md:text-8xl font-black tracking-tighter leading-[0.9]"
          >
            USE PATRIUM <span className="text-primary">OS</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          >
            O Sistema Operacional do Patrimônio Corporativo. Centralize holdings, ativos e compliance em uma inteligência unificada.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4 pt-8"
          >
            <Button size="lg" className="rounded-2xl px-8 h-14 text-base font-bold bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20" asChild>
              <a href="/login">Solicitar Demonstração <ArrowRight className="ml-2 h-5 w-5" /></a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-2xl px-8 h-14 text-base font-bold border-white/10 bg-white/5 hover:bg-white/10" asChild>
              <a href="/login">Conhecer o Jarvis</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features Grid - Simplified Section */}
      <section className="py-24 px-8 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-black tracking-tighter text-center mb-16 italic">Governança Patrimonial Inteligente</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Network} 
              title="Knowledge Graph" 
              desc="Mapeamento total da rede societária, holdings e ativos."
            />
            <FeatureCard 
              icon={Lock} 
              title="Digital Twin" 
              desc="Histórico, contratos e riscos de cada ativo, 360°."
            />
            <FeatureCard 
              icon={ShieldCheck} 
              title="Compliance 360" 
              desc="Monitoramento autônomo de licenças, certidões e prazos."
            />
          </div>
        </div>
      </section>

      {/* Jarvis Section - High Intent */}
      <section className="py-24 px-8">
        <div className="max-w-5xl mx-auto glass-card p-16 rounded-[3rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter italic">Conheça o JARVIS</h2>
              <p className="text-muted-foreground text-lg">
                Seu Diretor Patrimonial Digital. Ele não armazena dados, ele os transforma em planos de ação, detecta riscos antes que ocorram e prioriza suas decisões executivas.
              </p>
              <ul className="space-y-4">
                {['Detecção de riscos em tempo real', 'Gestão de prazos e licenças', 'Insights de valorização patrimonial'].map((item) => (
                  <li key={item} className="flex items-center gap-3 font-bold text-sm">
                    <CheckCircle2 className="h-5 w-5 text-primary" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full h-[400px] bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center text-muted-foreground font-black italic shadow-2xl">
              Visualização Jarvis AI
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-white/5 text-center text-sm text-muted-foreground">
        © 2026 Use Patrium • O Sistema Operacional do Patrimônio
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500 group">
      <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-xl font-bold mb-2 tracking-tight">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
