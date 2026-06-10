import { motion } from "framer-motion";
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
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    { name: "Governança Patrimonial", patrium: true, traditional: "Parcial", erp: "Não" },
    { name: "IA Especializada (Jarvis)", patrium: true, traditional: false, erp: false },
    { name: "Knowledge Graph", patrium: true, traditional: false, erp: false },
    { name: "Digital Twin de Ativos", patrium: true, traditional: false, erp: false },
    { name: "Compliance Autônomo", patrium: true, traditional: "Manual", erp: "Módulos Fixos" },
    { name: "Gestão de Holdings", patrium: true, traditional: false, erp: "Contábil apenas" },
    { name: "Family Office Services", patrium: true, traditional: false, erp: false },
    { name: "Agro Patrimonial", patrium: true, traditional: false, erp: false },
  ];

  return (
    <div className="overflow-x-auto rounded-[2rem] border border-white/5 bg-white/[0.01] w-full scrollbar-thin scrollbar-thumb-primary/20">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-white/5">
            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Funcionalidade</th>
            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-primary">USE PATRIUM OS</th>
            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sistemas Tradicionais</th>
            <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">ERPs Comuns</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
              <td className="p-6 font-bold text-sm">{f.name}</td>
              <td className="p-6">
                {f.patrium ? (
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Nativo</span>
                  </div>
                ) : null}
              </td>
              <td className="p-6 text-sm text-muted-foreground">{f.traditional === false ? "—" : f.traditional}</td>
              <td className="p-6 text-sm text-muted-foreground">{f.erp === false ? "—" : f.erp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricingCard({ plan, price, desc, features, highlighted = false }: any) {
  return (
    <Card className={`p-8 md:p-10 rounded-[2.5rem] flex flex-col h-full bg-[#0A0A0A] border-white/5 relative overflow-hidden transition-all duration-500 hover:scale-[1.02] ${highlighted ? 'ring-2 ring-primary border-transparent' : ''}`}>
      {highlighted && (
        <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1 rounded-bl-xl">
          Most Popular
        </div>
      )}
      <div className="space-y-4 mb-8">
        <h3 className="text-2xl font-black uppercase italic tracking-tighter">{plan}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl md:text-4xl font-black">{price}</span>
          <span className="text-muted-foreground text-xs font-medium">/mês</span>
        </div>
        <p className="text-muted-foreground text-sm font-medium">{desc}</p>
      </div>
      <div className="space-y-4 mb-10 flex-grow">
        {features.map((f: string, i: number) => (
          <div key={i} className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-xs font-medium text-white/80">{f}</span>
          </div>
        ))}
      </div>
      <Button className={`w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] ${highlighted ? 'bg-primary hover:bg-primary/90' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}>
        Selecionar Plano
      </Button>
    </Card>
  );
}
