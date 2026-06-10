import { createFileRoute } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Network, Database, Building2, Globe, Cpu, Target, Box, FileText, Scale, Search, HardHat, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { SectionHeader, FeatureCard, ArchitectureFlow, ModuleGrid, KnowledgeGraphAnimation, ComparisonTable, PricingCard } from "@/components/LandingPageComponents";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="bg-[#020202] text-white font-sans overflow-x-hidden selection:bg-primary/20">
      {/* Hero Section */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative pt-32">
        <div className="absolute inset-0 executive-grid opacity-10 pointer-events-none" />
        <div className="max-w-5xl mx-auto space-y-8 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-[9px] font-black uppercase tracking-[0.4em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Protocolo Institucional v2.1
          </div>
          <h1 className="text-6xl md:text-[8rem] font-black uppercase italic leading-[0.8] tracking-tighter">
            USE PATRIUM <span className="text-primary">OS</span>
          </h1>
          <p className="text-xl text-white/50 italic font-light max-w-2xl mx-auto">A primeira plataforma brasileira capaz de centralizar patrimônio, compliance, documentação, holdings, agronegócio patrimonial e inteligência executiva em um único ambiente.</p>
          <div className="flex gap-4 justify-center pt-8">
            <Button className="h-16 px-8 rounded-full bg-primary text-black font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all">Solicitar Demonstração</Button>
            <Button className="h-16 px-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 font-black uppercase tracking-[0.2em] text-xs transition-all">Conhecer Jarvis</Button>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-40 px-6 bg-[#020202] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="O DESAFIO ATUAL" badge="Governança Patrimonial" subtitle="Sua organização ainda sofre com processos descentralizados e riscos invisíveis?" />
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-12 rounded-[3rem] bg-white/[0.02] border border-white/5 space-y-6">
              <h3 className="text-2xl font-black italic uppercase">O Cenário Atual</h3>
              <ul className="space-y-4 text-white/60 font-medium italic">
                <li>• Documentos espalhados</li>
                <li>• Contratos sem controle</li>
                <li>• Licenças vencidas</li>
                <li>• Processos descentralizados</li>
              </ul>
            </div>
            <div className="p-12 rounded-[3rem] bg-primary/[0.03] border border-primary/10 space-y-6">
              <h3 className="text-2xl font-black italic uppercase text-primary">O Resultado</h3>
              <ul className="space-y-4 text-white/80 font-bold italic">
                <li>• Multas e penalidades</li>
                <li>• Processos jurídicos</li>
                <li>• Perda patrimonial real</li>
                <li>• Insegurança jurídica total</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Jarvis Section */}
      <section className="py-40 px-6 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="JARVIS" badge="Seu Diretor Digital" subtitle="O Jarvis monitora continuamente imóveis, holdings, certidões e processos, transformando dados em decisões estratégicas." />
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: "Monitoramento Preditivo", desc: "Detecta riscos antes que virem prejuízos." },
              { icon: Cpu, title: "Insights Inteligentes", desc: "IA Especializada focada em patrimônio." },
              { icon: Target, title: "Plano de Ação", desc: "Cria planos de contingência automáticos." }
            ].map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-40 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <SectionHeader title="ARQUITETURA" badge="Inteligência de Dados" />
          <ArchitectureFlow />
        </div>
      </section>

      {/* Modules */}
      <section className="py-40 px-6 bg-[#020202] border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="MÓDULOS" badge="Ecossistema Completo" />
          <ModuleGrid />
        </div>
      </section>

      {/* Knowledge Graph */}
      <section className="py-40 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
          <div className="space-y-8">
            <h2 className="text-6xl font-black italic uppercase tracking-tighter">KNOWLEDGE GRAPH</h2>
            <p className="text-xl text-white/50 leading-relaxed font-light italic">A correlação total entre ativos, sócios, licenças e processos. Visualize a integridade da sua estrutura patrimonial em tempo real.</p>
          </div>
          <KnowledgeGraphAnimation />
        </div>
      </section>

      {/* Comparison */}
      <section className="py-40 px-6 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="DIFERENCIAIS" badge="Posicionamento de Mercado" subtitle="Comparativo estratégico com as principais soluções do mercado." />
          <ComparisonTable />
        </div>
      </section>

      {/* Pricing */}
      <section className="py-40 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="INVESTIMENTO" badge="Projeção Estratégica" />
          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard plan="Professional" price="R$ 997" desc="Para escritórios e consultorias." features={["Governança Básica", "Suporte", "Dashboard"]} />
            <PricingCard highlighted plan="Business" price="R$ 2.997" desc="Para holdings e empresas." features={["Jarvis AI", "Compliance Autônomo", "Knowledge Graph"]} />
            <PricingCard plan="Enterprise" price="R$ 7.997" desc="Para family offices." features={["Digital Twin", "Agro Patrimonial", "Full Support"]} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 text-center border-t border-white/5 text-[9px] font-black uppercase tracking-[0.5em] text-white/20">
        PATRIUM OS © 2026 — SISTEMA DE GOVERNANÇA ESTRATÉGICA
      </footer>
    </div>
  );
}
