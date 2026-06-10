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
  Gavel
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
      className="p-10 md:p-14 rounded-[3rem] bg-white/[0.01] border border-white/[0.05] hover:border-primary/30 transition-all duration-700 group relative overflow-hidden h-full flex flex-col justify-between hover:shadow-2xl hover:shadow-primary/5"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-20 w-20 text-primary" />
      </div>
      
      <div>
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-10 border border-white/[0.05] group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/40 transition-all duration-700 shadow-xl backdrop-blur-md">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-2xl font-black mb-4 tracking-tighter uppercase italic leading-none">{title}</h3>
        <p className="text-muted-foreground text-base leading-relaxed font-medium italic opacity-80 group-hover:opacity-100 transition-opacity">{desc}</p>
      </div>
      
      <div className="mt-12 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 group-hover:text-primary transition-colors cursor-pointer">
        Explore Solution
        <ArrowRight className="h-4 w-4" />
      </div>
    </motion.div>
  );
}

export function ComparisonTable() {
  const features = [
    { name: "Governança Patrimonial", patrium: true, competition: "Manual / Silos", value: "Protocolo 360°" },
    { name: "Jarvis AI (Cérebro Digital)", patrium: true, competition: "Não Possui", value: "Monitoramento 24/7" },
    { name: "Knowledge Graph Engine", patrium: true, competition: "Relatórios Estáticos", value: "Conectividade Total" },
    { name: "Digital Twin (Ativos Reais)", patrium: true, competition: "Pastas Físicas / Drive", value: "Rastreabilidade Digital" },
    { name: "Compliance Autônomo 360", patrium: true, competition: "Reativo / Multas", value: "Preditivo / Proteção" },
    { name: "Gestão de Estruturas (Holdings)", patrium: true, competition: "Planilhas Complexas", value: "Governança Unificada" },
    { name: "Agronegócio Patrimonial", patrium: true, competition: "Sistemas ERP Genéricos", value: "Vertical Especializada" },
  ];

  return (
    <div className="overflow-x-auto rounded-[3rem] border border-white/[0.05] bg-white/[0.01] w-full scrollbar-none backdrop-blur-3xl shadow-2xl">
      <table className="w-full text-left border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-white/[0.05]">
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Category / Feature</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-primary bg-primary/[0.02]">USE PATRIUM OS</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Sistemas Tradicionais</th>
            <th className="p-10 text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Vantagem Competitiva</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors group">
              <td className="p-8 px-10 font-bold text-base italic uppercase tracking-tight">{f.name}</td>
              <td className="p-8 px-10 bg-primary/[0.01]">
                <div className="flex items-center gap-3 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Full Protocol</span>
                </div>
              </td>
              <td className="p-8 px-10 text-sm text-muted-foreground/50 font-medium italic">{f.competition}</td>
              <td className="p-8 px-10 text-sm text-primary/80 font-black uppercase tracking-widest">{f.value}</td>
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
          Elite Standard
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
        Ativar Protocolo
      </Button>
    </Card>
  );
}

export function KnowledgeGraphAnimation() {
  return (
    <div className="relative w-full aspect-square md:aspect-video bg-black/40 rounded-[3rem] border border-white/5 overflow-hidden flex items-center justify-center">
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
              <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <item.icon className={`h-6 w-6 ${item.color || "text-white/40"}`} />
                
                {/* Visual lines simulation */}
                {i < 4 && (
                  <motion.div 
                    className="absolute h-px bg-primary/20 top-1/2 left-full w-24 origin-left"
                    animate={{ scaleX: [0, 1], opacity: [0, 1] }}
                    transition={{ repeat: Infinity, duration: 4, delay: i }}
                  />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60 italic">{item.label}</span>
            </motion.div>
          ))}
        </div>
        
        <div className="mt-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-primary/40 animate-pulse">Relacionamento em Tempo Real</p>
        </div>
      </div>
    </div>
  );
}
