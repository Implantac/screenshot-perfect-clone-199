import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Network, 
  Lock, 
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 font-sans">
      <nav className="fixed top-0 w-full z-50 px-8 py-6 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2">
          <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-8" />
          <span className="font-black tracking-widest text-lg uppercase italic">USE PATRIUM</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="/login" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">Acessar Sistema</a>
          <Button className="rounded-full px-8 bg-white text-black font-black uppercase tracking-widest text-[10px] hover:bg-white/90">Solicitar Demo</Button>
        </div>
      </nav>

      <section className="pt-48 pb-32 px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-[#050505] to-[#050505]" />
        <div className="max-w-6xl mx-auto text-center relative z-10 space-y-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Strategic Asset Intelligence
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-7xl md:text-9xl font-black tracking-tighter leading-[0.85] italic uppercase"
          >
            USE PATRIUM <span className="text-primary">OS</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-medium"
          >
            O Sistema Operacional da Governança Patrimonial. Inteligência autônoma para centralização de Holdings, Compliance e Ativos Corporativos.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap items-center justify-center gap-6 pt-12"
          >
            <Button size="lg" className="rounded-2xl px-12 h-16 bg-primary text-white font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-primary/20 hover:scale-105 transition-all" asChild>
              <a href="/login">Solicitar Demonstração</a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-2xl px-12 h-16 border-white/10 bg-white/5 font-black uppercase tracking-[0.2em] text-xs hover:bg-white/10 transition-all" asChild>
              <a href="/login">Conhecer o Jarvis</a>
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="py-32 px-8 bg-[#080808] border-y border-white/5">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
          <FeatureCard 
            icon={Network} 
            title="Knowledge Graph" 
            desc="Mapeamento total da rede societária, conectando holdings, sócios e ativos em tempo real."
          />
          <FeatureCard 
            icon={Lock} 
            title="Digital Twin" 
            desc="Espelhamento digital de ativos com rastreabilidade total de documentos, riscos e histórico."
          />
          <FeatureCard 
            icon={ShieldCheck} 
            title="Compliance 360" 
            desc="Monitoramento autônomo de regularidade, licenças e certidões com alertas preditivos."
          />
        </div>
      </section>

      <section className="py-32 px-8">
        <div className="max-w-6xl mx-auto glass-card p-16 rounded-[4rem] border-white/5 bg-gradient-to-br from-primary/5 via-transparent to-transparent relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] -z-10 animate-pulse" />
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8">
              <div className="h-16 w-16 rounded-[1.5rem] bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.2)]">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-5xl font-black tracking-tighter italic uppercase">JARVIS <span className="text-primary">AI</span></h2>
              <p className="text-muted-foreground text-xl leading-relaxed">
                Seu Diretor Patrimonial Digital. O Jarvis monitora continuamente seu patrimônio, detectando riscos antes que se tornem problemas e gerando planos de ação estratégicos automaticamente.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {['Riscos Preditivos', 'Análise de Matrículas', 'CNDs Automáticas', 'Gestão de Prazos'].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 w-full aspect-square max-w-[500px] bg-white/5 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-muted-foreground font-black italic tracking-widest uppercase text-xs opacity-50">Jarvis Intelligence Interface</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-20 px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" alt="Logo" className="h-6 opacity-50" />
            <span className="font-black tracking-widest text-sm uppercase italic">USE PATRIUM OS</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">© 2026 Strategy & Governance • Secure Infrastructure</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: any) {
  return (
    <div className="p-12 rounded-[3rem] bg-white/[0.01] border border-white/5 hover:border-primary/20 transition-all duration-700 group relative overflow-hidden">
      <div className="absolute -bottom-8 -right-8 h-32 w-32 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-500">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase italic">{title}</h3>
      <p className="text-muted-foreground leading-relaxed font-medium">{desc}</p>
    </div>
  );
}
