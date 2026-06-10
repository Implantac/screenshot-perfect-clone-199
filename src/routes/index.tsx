import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Network, 
  Lock, 
  CheckCircle2,
  Cpu,
  Zap,
  ChevronRight,
  Database,
  Building2,
  Globe,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const textScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div ref={containerRef} className="min-h-[300vh] bg-[#030303] text-white selection:bg-primary/20 font-sans overflow-x-hidden relative">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div 
          style={{ y: backgroundY }}
          className="absolute inset-0 executive-grid opacity-20" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#030303]/80 to-[#030303]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      </div>

      <nav className="fixed top-0 w-full z-[100] px-6 md:px-12 py-8 flex items-center justify-between border-b border-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-10 flex items-center justify-center">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
            <div className="relative h-6 w-6 bg-primary rounded-sm rotate-45 border border-white/20" />
          </div>
          <div className="flex flex-col">
            <span className="font-black tracking-[0.4em] text-lg uppercase italic leading-none">USE PATRIUM</span>
            <span className="text-[7px] font-bold tracking-[0.6em] uppercase text-primary/80 mt-1">Institutional Governance</span>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-12">
          {["Ecossistema", "Inteligência", "Governança", "Legado"].map((item) => (
            <a key={item} href="#" className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-primary transition-all hover:tracking-[0.5em]">
              {item}
            </a>
          ))}
          <div className="h-4 w-px bg-white/10" />
          <Button className="rounded-full bg-white text-black font-black uppercase text-[10px] tracking-[0.2em] px-10 h-12 hover:bg-primary transition-colors border-none">
            Solicitar Acesso
          </Button>
        </div>
      </nav>

      {/* Cinematic Hero */}
      <section className="sticky top-0 h-screen flex flex-col items-center justify-center px-6 text-center z-10">
        <motion.div style={{ scale: textScale, opacity }} className="max-w-7xl mx-auto space-y-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-[0.5em] text-primary"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#d4a355]" />
            Patrimonial Operating System
          </motion.div>
          
          <h1 className="text-8xl md:text-[14rem] font-black uppercase italic leading-[0.75] tracking-tighter mix-blend-difference">
            THE NEW <br />
            <span className="text-primary italic">STANDARD.</span>
          </h1>

          <p className="text-xl md:text-3xl text-white/60 font-light italic max-w-3xl mx-auto leading-relaxed">
            A infraestrutura definitiva para a gestão de grandes patrimônios e holdings. 
            Não é um software, é o seu novo cérebro institucional.
          </p>

          <div className="flex flex-col md:row items-center justify-center gap-6 pt-12">
            <Button size="lg" className="h-24 px-16 rounded-[2rem] bg-primary text-black font-black uppercase tracking-[0.3em] text-xs hover:scale-105 transition-all shadow-[0_0_50px_rgba(212,163,85,0.2)]">
              Protocolo Demo
            </Button>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">
              <Plus className="h-4 w-4" /> Discover Jarvis AI
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-30"
        >
          <span className="text-[8px] font-black uppercase tracking-[0.5em] vertical-text">Scroll to explore</span>
          <div className="w-px h-12 bg-white/20" />
        </motion.div>
      </section>

      {/* The Vision Section */}
      <section className="relative z-20 py-60 px-6 md:px-12 bg-[#030303]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-32 items-end">
          <div className="space-y-12">
            <div className="inline-block text-[10px] font-black uppercase tracking-[0.5em] text-primary/60 italic border-b border-primary/20 pb-2">
              The Architecture of Legacy
            </div>
            <h2 className="text-6xl md:text-9xl font-black italic uppercase leading-[0.85] tracking-tighter">
              BEYOND <br />
              COMPLIANCE.
            </h2>
          </div>
          <div className="space-y-8">
            <p className="text-2xl md:text-3xl text-white/80 leading-relaxed italic font-light">
              "No topo da pirâmide patrimonial, a eficiência não é mais suficiente. 
              A governança moderna exige antecipação, conexão total e inteligência autônoma."
            </p>
            <div className="h-px w-24 bg-primary" />
            <p className="text-sm text-white/40 font-bold uppercase tracking-[0.2em] italic">USE PATRIUM STRATEGIC PAPER v2.0</p>
          </div>
        </div>

        <div className="mt-40 grid grid-cols-1 md:grid-cols-3 gap-1px bg-white/5 border border-white/5 overflow-hidden rounded-[4rem]">
          {[
            { icon: Network, title: "Knowledge Graph", desc: "Uma malha neural que conecta todos os ativos, holdings e CPFs em tempo real." },
            { icon: Lock, title: "Digital Twin Hub", desc: "O espelho digital perfeito do seu patrimônio físico e societário, com rastreabilidade absoluta." },
            { icon: Sparkles, title: "Jarvis Agent", desc: "A primeira IA brasileira que entende a complexidade do direito patrimonial e age preventivamente." }
          ].map((item, i) => (
            <div key={i} className="p-16 md:p-24 bg-[#030303] hover:bg-white/[0.02] transition-colors group flex flex-col justify-between aspect-square">
              <item.icon className="h-12 w-12 text-primary/40 group-hover:text-primary transition-all group-hover:scale-110" />
              <div className="space-y-6">
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">{item.title}</h3>
                <p className="text-white/40 text-base leading-relaxed italic group-hover:text-white/60 transition-colors">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Strategic Intelligence / Jarvis */}
      <section className="relative z-20 py-40 px-6 md:px-12 bg-white/[0.01] border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-24">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.5em] text-primary">
              <Sparkles className="h-4 w-4" /> Jarvis Strategic Director
            </div>
            <h2 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter leading-none">
              O PRIMEIRO DIRETOR <br />
              PATRIMONIAL DIGITAL.
            </h2>
          </div>

          <div className="relative w-full aspect-video rounded-[4rem] border border-white/5 bg-black overflow-hidden flex items-center justify-center group">
            <div className="absolute inset-0 executive-grid opacity-10 group-hover:opacity-20 transition-opacity" />
            <div className="relative z-10 flex flex-col items-center gap-12">
              <div className="h-32 w-32 md:h-48 md:w-48 rounded-full border border-primary/20 flex items-center justify-center p-4">
                <div className="h-full w-full rounded-full bg-primary/5 flex items-center justify-center animate-pulse">
                  <Cpu className="h-12 w-12 md:h-20 md:w-20 text-primary" />
                </div>
              </div>
              <div className="space-y-4 max-w-xl">
                <div className="px-6 py-4 rounded-2xl bg-primary/5 border border-primary/10 italic text-sm text-primary/80">
                  "Detectei uma vulnerabilidade na certidão da Holding Alfa. Protocolo de renovação iniciado automaticamente."
                </div>
                <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 italic text-sm text-white/40">
                  "Processando Due Diligence do Imóvel X. 98% de precisão documental atingida."
                </div>
              </div>
            </div>
          </div>
          
          <Button size="lg" variant="ghost" className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white italic">
            Visualizar Roadmap de Inteligência <ArrowRight className="ml-4 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* CTA / Final Section */}
      <section className="relative z-20 py-60 px-6 md:px-12 text-center bg-[#030303]">
        <div className="max-w-5xl mx-auto space-y-16">
          <h2 className="text-6xl md:text-[10rem] font-black italic uppercase leading-[0.8] tracking-tighter">
            THE FUTURE <br />
            IS <span className="text-primary italic">PRIVATE.</span>
          </h2>
          <p className="text-xl md:text-3xl text-white/60 italic font-light max-w-2xl mx-auto">
            Sua governança merece o estado da arte. Junte-se à nova categoria de infraestrutura estratégica.
          </p>
          <div className="pt-12">
            <Button size="lg" className="h-24 px-20 rounded-[2.5rem] bg-white text-black font-black uppercase tracking-[0.4em] text-xs hover:bg-primary transition-all">
              Agendar Board Meeting
            </Button>
          </div>
        </div>
      </section>

      <footer className="relative z-20 py-20 px-8 border-t border-white/5 text-center">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-7xl mx-auto gap-8 opacity-40">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 bg-white rounded-sm rotate-45" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">USE PATRIUM</span>
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.5em]">SYSTEMIC GOVERNANCE INFRASTRUCTURE © 2026</p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-[8px] font-black uppercase tracking-[0.5em]">LEGAL</a>
            <a href="#" className="text-[8px] font-black uppercase tracking-[0.5em]">PRIVACY</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
