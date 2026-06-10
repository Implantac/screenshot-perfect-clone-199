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
    <div className="space-y-4 mb-12 md:mb-16">
      {badge && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary"
        >
          {badge}
        </motion.div>
      )}
      <motion.h2 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-[0.9]"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
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
      className="p-8 md:p-10 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all duration-500 group relative overflow-hidden h-full"
    >
      <div className="absolute -bottom-8 -right-8 h-24 w-24 bg-primary/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="h-14 w-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-500">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-xl font-black mb-3 tracking-tighter uppercase italic">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed font-medium">{desc}</p>
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
