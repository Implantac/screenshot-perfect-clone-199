import { motion, useScroll, useTransform } from "framer-motion";
import { 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Network, 
  Lock, 
  CheckCircle2,
  FileText,
  Building2,
  Briefcase,
  Layers,
  Search,
  AlertTriangle,
  Zap,
  TrendingUp,
  Cpu,
  Globe,
  Database,
  Users,
  BarChart3,
  Scale,
  Target,
  PieChart,
  HardHat,
  Gavel,
  ChevronRight,
  Shield,
  ZapOff,
  Activity,
  Box,
  Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRef } from "react";

export function SectionHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="space-y-6 mb-16 md:mb-24">
      {badge && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-black uppercase tracking-[0.4em] text-primary shadow-lg shadow-primary/5 backdrop-blur-md"
        >
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          {badge}
        </motion.div>
      )}
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.85] max-w-4xl"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed italic font-medium"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export function FeatureCard({ icon: Icon, title, desc, delay = 0 }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="p-10 md:p-14 rounded-[3.5rem] bg-white/[0.01] border border-white/[0.05] hover:border-primary/30 transition-all duration-700 group relative overflow-hidden h-full flex flex-col justify-between hover:shadow-2xl hover:shadow-primary/5"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-24 w-24 text-primary" />
      </div>
      
      <div>
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-10 border border-white/[0.05] group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/40 transition-all duration-700 shadow-xl backdrop-blur-md">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase italic leading-none">{title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed font-medium italic opacity-80 group-hover:opacity-100 transition-opacity">{desc}</p>
      </div>
      
      <div className="mt-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 group-hover:text-primary transition-colors cursor-pointer">
        Explorar Solução
        <ArrowRight className="h-4 w-4" />
      </div>
    </motion.div>
  );
}

export function ComparisonTable() {
  const features = [
    { name: "Governança Patrimonial", patrium: true, sap: "Limitado", legacy: "Parcial", soft: "Sim" },
    { name: "Compliance Autônomo 360", patrium: true, sap: "Estático", legacy: "Manual", soft: "Não" },
    { name: "Jarvis AI (Diretor Digital)", patrium: true, sap: "Não", legacy: "Não", soft: "Não" },
    { name: "Knowledge Graph Engine", patrium: true, sap: "Não", legacy: "Não", soft: "Não" },
    { name: "Digital Twin (Ativos)", patrium: true, sap: "Não", legacy: "Não", soft: "Não" },
    { name: "Gestão de Holdings", patrium: true, sap: "Parcial", legacy: "Manual", soft: "Não" },
    { name: "Agro Patrimonial", patrium: true, sap: "Não", legacy: "Não", soft: "Não" },
  ];

  return (
    <div className="overflow-x-auto rounded-[3rem] border border-white/[0.05] bg-white/[0.01] w-full scrollbar-none backdrop-blur-3xl shadow-2xl">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="border-b border-white/[0.05]">
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Funcionalidade / Solução</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-primary bg-primary/[0.02]">USE PATRIUM OS</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 text-center">SAP / Oracle</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 text-center">SoftExpert</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 text-center">Legado / Planilha</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors group">
              <td className="p-8 px-10 font-bold text-base italic uppercase tracking-tight">{f.name}</td>
              <td className="p-8 px-10 bg-primary/[0.01]">
                <div className="flex items-center gap-3 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">NATIVO</span>
                </div>
              </td>
              <td className="p-8 px-10 text-center text-sm text-muted-foreground/50 font-medium italic">{f.sap}</td>
              <td className="p-8 px-10 text-center text-sm text-muted-foreground/50 font-medium italic">{f.soft}</td>
              <td className="p-8 px-10 text-center text-sm text-muted-foreground/50 font-medium italic">{f.legacy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricingCard({ plan, price, desc, features, highlighted = false }: any) {
  return (
    <Card className={`p-10 md:p-14 rounded-[3.5rem] flex flex-col h-full bg-[#080808] border-white/[0.05] relative overflow-hidden transition-all duration-700 hover:scale-[1.03] hover:shadow-2xl hover:shadow-primary/10 ${highlighted ? 'ring-2 ring-primary/50 border-primary/20 shadow-primary/5' : ''}`}>
      {highlighted && (
        <div className="absolute top-0 right-0 bg-primary text-black text-[9px] font-black uppercase tracking-[0.3em] px-6 py-2 rounded-bl-3xl">
          Escolha dos Líderes de Mercado
        </div>
      )}
      
      <div className="space-y-6 mb-12">
        <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">{plan}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl md:text-5xl font-black italic">{price}</span>
          <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">/ mensal</span>
        </div>
        <p className="text-muted-foreground text-sm font-medium leading-relaxed italic opacity-80">{desc}</p>
      </div>
      
      <div className="h-px w-full bg-white/[0.05] mb-12" />
      
      <div className="space-y-5 mb-14 flex-grow">
        {features.map((f: string, i: number) => (
          <div key={i} className="flex items-start gap-4 group/item">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5 opacity-40 group-hover/item:opacity-100 transition-opacity" />
            <span className="text-xs font-bold text-white/70 italic uppercase tracking-wide group-hover/item:text-white transition-colors">{f}</span>
          </div>
        ))}
      </div>
      
      <Button className={`w-full h-16 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-[10px] transition-all duration-500 shadow-xl ${highlighted ? 'bg-primary text-black hover:bg-primary/90 shadow-primary/20' : 'bg-white/[0.03] hover:bg-white/[0.08] text-white border border-white/[0.08]'}`}>
        Solicitar Demonstração
      </Button>
    </Card>
  );
}

export function ArchitectureFlow() {
  const steps = [
    { label: "Dados", icon: Database },
    { label: "Knowledge Graph", icon: Network },
    { label: "Digital Twin", icon: Box },
    { label: "IA Especializada", icon: Cpu },
    { label: "Jarvis", icon: Sparkles, color: "text-primary" },
    { label: "Decisões", icon: Target },
    { label: "Ações", icon: Zap }
  ];

  return (
    <div className="w-full py-20 px-4 md:px-8 overflow-x-auto scrollbar-none">
      <div className="flex items-center justify-between min-w-[1000px] max-w-7xl mx-auto gap-4 relative">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 -z-10" />
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-6 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`h-20 w-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-3xl group relative overflow-hidden`}
            >
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <step.icon className={`h-8 w-8 ${step.color || "text-white/60"}`} />
            </motion.div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">{step.label}</span>
            {i < steps.length - 1 && (
              <ChevronRight className="absolute -right-4 top-8 h-4 w-4 text-white/10" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModuleGrid() {
  const modules = [
    { title: "Governança Patrimonial", icon: Shield, desc: "Controle absoluto de estruturas societárias." },
    { title: "Gestão Documental", icon: FileText, desc: "Centralização inteligente de certidões e contratos." },
    { title: "Compliance", icon: Scale, desc: "Monitoramento contínuo de riscos e regularidade." },
    { title: "Holdings", icon: Building2, desc: "Estruturação e blindagem de grupos econômicos." },
    { title: "Family Office", icon: Users, desc: "Tecnologia para gestão de fortunas e herança." },
    { title: "Regularização Imobiliária", icon: HardHat, desc: "Sanamento total de ativos e matrículas." },
    { title: "Agronegócio Patrimonial", icon: Globe, desc: "Governança dedicada ao setor produtivo." },
    { title: "Data Room", icon: Database, desc: "Repositório seguro para transações críticas." },
    { title: "Due Diligence", icon: Search, desc: "Análise profunda de riscos em fusões e aquisições." },
    { title: "Central de Riscos", icon: AlertTriangle, desc: "Monitoramento preditivo de ameaças sistêmicas." }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
      {modules.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.05] hover:border-primary/20 transition-all group backdrop-blur-xl hover:bg-white/[0.04]"
        >
          <div className="h-12 w-12 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/10 transition-all">
            <m.icon className="h-5 w-5 text-primary/60 group-hover:text-primary transition-colors" />
          </div>
          <h4 className="text-sm font-black italic uppercase tracking-tight text-white/90 leading-none mb-3">{m.title}</h4>
          <p className="text-[10px] text-muted-foreground font-medium leading-relaxed italic">{m.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}

export function KnowledgeGraphAnimation() {
  return (
    <div className="relative w-full aspect-square md:aspect-video bg-black/40 rounded-[3.5rem] border border-white/5 overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 executive-grid opacity-20" />
      <div className="relative z-10 w-full max-w-2xl px-8 py-12 flex flex-col items-center justify-center gap-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full">
          {[
            { label: "Empresa", icon: Building2 },
            { label: "Holding", icon: Briefcase },
            { label: "Sócio", icon: Users },
            { label: "Imóvel", icon: Building2 },
            { label: "Contrato", icon: FileText },
            { label: "Licença", icon: ShieldCheck },
            { label: "Processo", icon: Scale },
            { label: "Jarvis", icon: Sparkles, color: "text-primary" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="h-20 w-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <item.icon className={`h-8 w-8 ${item.color || "text-white/40"}`} />
                <motion.div 
                  className="absolute h-px bg-primary/20 top-1/2 left-full w-24 origin-left"
                  animate={{ scaleX: [0, 1], opacity: [0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 4, delay: i }}
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60 italic">{item.label}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center p-4 rounded-full bg-white/[0.02] border border-white/10">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-primary/40 animate-pulse">Motor de Grafo Ativo</p>
        </div>
      </div>
    </div>
  );
}
