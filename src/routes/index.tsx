import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Network, Database, Building2, Cpu, Target, Box, FileText, Scale, Search, HardHat, AlertTriangle, Users, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotAnERP, JarvisAlerts, DigitalTwin, RelationshipChain, Segments, Market, CompetitorTable, Differentiators, ROI, Roadmap } from "@/components/LandingSections";
import { SectionHeader, FeatureCard, ArchitectureFlow, ModuleGrid, KnowledgeGraphAnimation, ComparisonTable, PricingCard } from "@/components/LandingPageComponents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "USE PATRIUM OS | Sistema Operacional do Patrimônio" },
      { name: "description", content: "Centralize patrimônio, compliance, holdings e agronegócio com o JARVIS, seu Diretor Patrimonial Digital." },
      { property: "og:title", content: "USE PATRIUM OS | Sistema Operacional do Patrimônio" },
      { property: "og:description", content: "Governança patrimonial com inteligência executiva 24/7." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-[#020202] text-white font-sans overflow-x-hidden selection:bg-primary/20">
      {/* Top Nav */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg premium-gradient" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em]">Patrium <span className="text-primary">OS</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">
            <a href="#jarvis" className="hover:text-primary transition-colors">Jarvis</a>
            <a href="#modulos" className="hover:text-primary transition-colors">Módulos</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Investimento</a>
          </nav>
          <Button asChild className="h-9 px-5 rounded-xl bg-primary text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white"><Link to="/login">Demo</Link></Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative pt-32">

        <div className="absolute inset-0 executive-grid opacity-[0.03] pointer-events-none" />
        <div className="max-w-5xl mx-auto space-y-10 z-10">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-primary/20 bg-primary/5 text-[10px] font-black uppercase tracking-[0.4em] text-primary backdrop-blur-md shadow-2xl shadow-primary/10">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Ecossistema Patrium OS v2.0
          </div>
          <h1 className="text-6xl md:text-[9rem] font-black uppercase italic leading-[0.85] tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/50">
            USE PATRIUM <span className="text-primary">OS</span>
          </h1>
          <p className="text-xl md:text-3xl text-white/60 italic font-light max-w-3xl mx-auto leading-relaxed">
            A primeira plataforma brasileira capaz de centralizar patrimônio, compliance, documentação, holdings, agronegócio e inteligência executiva em um único ambiente.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Button asChild className="h-16 px-10 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all shadow-xl shadow-primary/20 hover:bg-white"><Link to="/login">Solicitar Demonstração</Link></Button>
            <Button asChild className="h-16 px-10 rounded-2xl bg-white/5 border border-white/10 text-foreground hover:bg-white/10 font-black uppercase tracking-[0.2em] text-xs transition-all hover:border-primary/50"><Link to="/login">Conhecer o Jarvis</Link></Button>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 md:py-40 px-6 bg-[#020202]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="O DESAFIO ATUAL" badge="Governança Patrimonial" subtitle="Sua organização ainda sofre com processos descentralizados e riscos invisíveis?" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-12 md:p-16 rounded-[3rem] bg-white/[0.02] border border-white/5 space-y-8">
              <h3 className="text-2xl font-black italic uppercase">O Cenário Atual</h3>
              <ul className="space-y-4 text-white/50 font-medium italic text-lg">
                <li>• Fragmentação de ativos e documentos</li>
                <li>• Riscos jurídicos e fiscais latentes</li>
                <li>• Compliance manual e ineficiente</li>
                <li>• Falta de visão de governança 360°</li>
              </ul>
            </div>
            <div className="p-12 md:p-16 rounded-[3rem] bg-primary/[0.03] border border-primary/10 space-y-8">
              <h3 className="text-2xl font-black italic uppercase text-primary">A Consequência</h3>
              <ul className="space-y-4 text-white/80 font-bold italic text-lg">
                <li>• Multas e passivos evitáveis</li>
                <li>• Ineficiência na sucessão patrimonial</li>
                <li>• Perda de valor e segurança jurídica</li>
                <li>• Decisões baseadas em dados obsoletos</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="NÃO É MAIS UM SOFTWARE" badge="Categoria" />
          <NotAnERP />
        </div>
      </section>
      <span id="jarvis" />
      {/* JARVIS */}
      <section className="py-20 md:py-40 px-6 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="CONHEÇA O JARVIS" badge="Seu Diretor Patrimonial Digital" subtitle="O Jarvis monitora continuamente seu ecossistema, transformando dados brutos em decisões estratégicas de alto valor." />
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: "Monitoramento Preditivo", desc: "Detecta riscos e oportunidades de compliance antes que virem prejuízos." },
              { icon: Cpu, title: "Insights Inteligentes", desc: "IA Especializada com Knowledge Graph para inteligência executiva." },
              { icon: Target, title: "Plano de Ação", desc: "Execução prioritária baseada na criticidade do seu portfólio." }
            ].map((f, i) => <FeatureCard key={i} {...f} delay={i * 0.1} />)}
          </div>
          <JarvisAlerts />
        </div>
      </section>

      {/* Architecture */}
      <section className="py-20 md:py-40 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <SectionHeader title="ARQUITETURA" badge="Sistema Operacional Patrimonial" subtitle="Do dado bruto ao insight executivo." />
          <ArchitectureFlow />
        </div>
      </section>

      <span id="modulos" />
      {/* Modules */}
      <section className="py-20 md:py-40 px-6 bg-[#020202] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="MÓDULOS" badge="Ecossistema Completo" />
          <ModuleGrid />
        </div>
      </section>

      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="DIGITAL TWIN" badge="Gêmeo Digital" subtitle="Cada ativo com documentos, histórico, contratos, proprietários, riscos e compliance." />
          <DigitalTwin />
        </div>
      </section>
      {/* Knowledge Graph */}
      <section className="py-20 md:py-40 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter">KNOWLEDGE GRAPH</h2>
            <p className="text-2xl text-white/50 leading-relaxed font-light italic">A correlação total entre ativos, sócios, licenças e processos. Visualize a integridade da sua estrutura patrimonial em tempo real.</p>
          </div>
          <KnowledgeGraphAnimation />
        </div>
        <div className="max-w-7xl mx-auto"><RelationshipChain /></div>
      </section>
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="PARA QUEM" badge="Segmentos" subtitle="Do family office ao setor público." />
          <Segments />
        </div>
      </section>
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="MERCADO" badge="Oportunidade" subtitle="Holdings, family offices e agro patrimonial crescem e exigem compliance." />
          <Market />
        </div>
      </section>


      {/* Comparison */}
      <section className="py-20 md:py-40 px-6 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="DIFERENCIAIS" badge="Posicionamento de Mercado" subtitle="Comparativo estratégico: O Patrium OS redefine a categoria." />
          <CompetitorTable />
        </div>
      </section>

      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="DIFERENCIAIS ÚNICOS" badge="Por que Patrium" />
          <Differentiators />
        </div>
      </section>
      <span id="pricing" />
      {/* Pricing */}
      <section className="py-20 md:py-40 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="INVESTIMENTO" badge="Projeção Estratégica" subtitle="Escalabilidade para qualquer estrutura de capital." />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PricingCard plan="Professional" price="R$ 997–1.997" desc="Para escritórios e consultorias." features={["Governança Básica", "Gestão Documental", "Suporte Padrão"]} />
            <PricingCard highlighted plan="Business" price="R$ 2.997–4.997" desc="Para holdings e empresas." features={["Jarvis AI (Diretor Digital)", "Compliance 360", "Knowledge Graph Engine"]} />
            <PricingCard plan="Enterprise" price="R$ 7.997–19.997" desc="Para Family Offices e Grupos." features={["Digital Twin de Ativos", "Agro Patrimonial", "Data Room Estratégico"]} />
            <PricingCard plan="Corporate" price="Sob Consulta" desc="Para grandes grupos econômicos." features={["Customização Total", "SLA Exclusivo", "Integração via API"]} />
          </div>
          <ROI />
          <div className="mt-20 p-12 rounded-[3rem] bg-white/[0.02] border border-white/5 text-center max-w-4xl mx-auto backdrop-blur-3xl shadow-2xl">
            <h3 className="text-2xl font-black italic uppercase mb-6">Visão de Futuro</h3>
            <p className="text-lg text-white/50 leading-relaxed italic">
              "O USE PATRIUM está construindo a próxima geração da Governança Patrimonial no Brasil. Estamos criando um cérebro patrimonial capaz de proteger, organizar e potencializar o patrimônio de empresas, holdings e famílias por gerações."
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="ROADMAP" badge="Evolução em 8 Fases" />
          <Roadmap />
        </div>
      </section>
      {/* CTA Final */}
      <section className="py-20 md:py-40 px-6 text-center bg-gradient-to-b from-[#020202] to-[#080808]">
        <div className="max-w-4xl mx-auto space-y-12">
          <h2 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-none">Pronto para transformar sua gestão patrimonial?</h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button asChild className="h-16 px-10 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all"><Link to="/login">Solicitar Demonstração</Link></Button>
            <Button asChild className="h-16 px-10 rounded-2xl bg-white/5 border border-white/10 text-foreground hover:bg-white/10 font-black uppercase tracking-[0.2em] text-xs transition-all"><Link to="/login">Falar com Especialista</Link></Button>
            <Button asChild className="h-16 px-10 rounded-2xl bg-white/5 border border-white/10 text-foreground hover:bg-white/10 font-black uppercase tracking-[0.2em] text-xs"><Link to="/login">Conhecer o Jarvis</Link></Button>
          </div>
        </div>
      </section>

      <footer className="py-20 text-center border-t border-white/5 text-[9px] font-black uppercase tracking-[0.5em] text-white/20">
        PATRIUM OS — © 2026 — SISTEMA DE GOVERNANÇA ESTRATÉGICA
      </footer>
    </div>
  );
}
