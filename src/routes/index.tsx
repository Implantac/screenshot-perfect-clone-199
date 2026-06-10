import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  ArrowRight, 
  Sparkles, 
  Lock, 
  Cpu,
  ChevronRight,
  Database,
  Building2,
  Globe,
  Plus,
  ShieldCheck,
  Network
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

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  return (
    <div ref={containerRef} className="min-h-[300vh] bg-[#020202] text-white selection:bg-primary/20 font-sans overflow-x-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0 executive-grid opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020202]/90 to-[#020202]" />
        <div className="absolute top-0 left-0 w-full h-screen bg-[radial-gradient(circle_at_50%_50%,rgba(212,163,85,0.05),transparent_70%)]" />
      </div>

      <nav className="fixed top-0 w-full z-[100] px-8 py-6 flex items-center justify-between border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-primary rotate-45" />
          <span className="font-black tracking-[0.3em] text-sm uppercase italic">PATRIUM OS</span>
        </div>
        <div className="flex items-center gap-8">
          <Button variant="ghost" className="text-[10px] uppercase tracking-[0.2em] hover:text-primary">Estratégia</Button>
          <Button className="rounded-full bg-white text-black font-black uppercase text-[9px] tracking-[0.2em] px-8 h-10 hover:bg-primary">Acesso</Button>
        </div>
      </nav>

      <section className="sticky top-0 h-screen flex items-center justify-center px-6 text-center z-10">
        <motion.div style={{ opacity: textOpacity }} className="max-w-5xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-[9px] font-black uppercase tracking-[0.4em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Protocolo Institucional v2.1
          </div>
          <h1 className="text-7xl md:text-[10rem] font-black uppercase italic leading-[0.8] tracking-tighter">
            O NOVO <span className="text-primary">LEGADO.</span>
          </h1>
          <p className="text-xl text-white/50 italic font-light">Infraestrutura autônoma para governança de fortunas.</p>
          <Button className="h-20 px-12 rounded-[2rem] bg-primary text-black font-black uppercase tracking-[0.3em] text-xs hover:scale-105 transition-all">
            Iniciativa Jarvis
          </Button>
        </motion.div>
      </section>

      <section className="relative z-20 py-60 px-6 bg-[#020202]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Network, title: "Malha Neural", desc: "Conexão total de ativos." },
            { icon: ShieldCheck, title: "Compliance", desc: "Rastreabilidade absoluta." },
            { icon: Sparkles, title: "Jarvis AI", desc: "Inteligência preditiva." }
          ].map((item, i) => (
            <div key={i} className="p-12 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all group">
              <item.icon className="h-10 w-10 text-primary mb-8" />
              <h3 className="text-2xl font-black uppercase italic mb-4">{item.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-20 py-20 text-center text-[9px] font-black uppercase tracking-[0.5em] text-white/20">
        PATRIUM OS © 2026 — SISTEMA DE GOVERNANÇA ESTRATÉGICA
      </footer>
    </div>
  );
}