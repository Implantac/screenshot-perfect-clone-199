import { motion } from "framer-motion";
import { AlertTriangle, FileWarning, Leaf, Building2, Briefcase, Users, Landmark, Tractor, Scale, Gavel, Network, Box, Cpu, ShieldAlert, Sparkles, Layers, CheckCircle2, XCircle, MinusCircle, TrendingUp, FileText, History, UserCheck, ShieldCheck, Search, Ban } from "lucide-react";

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } };

export function NotAnERP() {
  const nots = ["ERP", "GED", "CRM", "Software Jurídico", "Software Imobiliário", "Software Agro"];
  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div className="flex flex-wrap gap-3">
        {nots.map((n) => (
          <motion.span key={n} {...fade} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-border bg-card/40 text-sm font-bold uppercase tracking-wider text-muted-foreground line-through decoration-primary/60">
            <Ban className="h-4 w-4 text-primary/60" /> {n}
          </motion.span>
        ))}
      </div>
      <motion.div {...fade} className="p-10 rounded-[2.5rem] border border-primary/30 bg-primary/5">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-4">Nova categoria</p>
        <h3 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none text-foreground">Sistema Operacional Patrimonial</h3>
        <p className="mt-6 text-muted-foreground text-lg italic leading-relaxed">Uma camada de inteligência acima de todos os seus sistemas, que conecta documentos, ativos, pessoas e obrigações em um único cérebro patrimonial.</p>
      </motion.div>
    </div>
  );
}

export function JarvisAlerts() {
  const alerts = [
    { icon: FileWarning, sev: "Crítico", text: "3 certidões vencidas na Holding Alpha", action: "Renovação automática sugerida" },
    { icon: Leaf, sev: "Alto", text: "Licença ambiental vence em 12 dias", action: "Plano de ação P1 criado" },
    { icon: Building2, sev: "Médio", text: "5 imóveis sem documentação atualizada", action: "Regularização priorizada" },
  ];
  return (
    <div className="mt-12 rounded-[2.5rem] border border-border bg-card/40 overflow-hidden">
      <div className="px-8 py-4 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary flex items-center gap-2"><Sparkles className="h-3 w-3" /> Jarvis · Monitoramento ao vivo (exemplo)</span>
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      </div>
      {alerts.map((a, i) => (
        <motion.div key={i} {...fade} transition={{ delay: i * 0.15 }} className="px-8 py-6 border-b border-border last:border-0 flex flex-col md:flex-row md:items-center gap-4">
          <a.icon className="h-6 w-6 text-primary shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-destructive/15 text-destructive w-fit">{a.sev}</span>
          <span className="flex-1 font-bold text-foreground">{a.text}</span>
          <span className="text-sm italic text-muted-foreground">→ {a.action}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function DigitalTwin() {
  const facets = [
    { icon: FileText, label: "Documentos", v: "48 arquivos" },
    { icon: History, label: "Histórico", v: "12 eventos" },
    { icon: Scale, label: "Contratos", v: "6 ativos" },
    { icon: UserCheck, label: "Proprietários", v: "3 sócios" },
    { icon: ShieldAlert, label: "Riscos", v: "2 abertos" },
    { icon: ShieldCheck, label: "Compliance", v: "92%" },
  ];
  return (
    <div className="grid lg:grid-cols-[1fr_1.4fr] gap-10 items-center">
      <motion.div {...fade} className="aspect-square rounded-[3rem] border border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
        <div className="absolute inset-0 executive-grid opacity-30" />
        <Box className="h-24 w-24 text-primary relative" />
        <p className="relative text-xl font-black italic uppercase text-foreground">Fazenda Santa Fé</p>
        <p className="relative text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Gêmeo digital do ativo</p>
      </motion.div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {facets.map((f, i) => (
          <motion.div key={f.label} {...fade} transition={{ delay: i * 0.08 }} className="p-6 rounded-3xl border border-border bg-card/40">
            <f.icon className="h-6 w-6 text-primary mb-4" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{f.label}</p>
            <p className="text-xl font-black text-foreground mt-1 tabular-nums">{f.v}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function RelationshipChain() {
  const chain = ["Empresa", "Holding", "Sócio", "Imóvel", "Contrato", "Licença", "Fornecedor", "Processo"];
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
      {chain.map((c, i) => (
        <motion.div key={c} {...fade} transition={{ delay: i * 0.12 }} className="flex items-center gap-3">
          <span className="px-5 py-3 rounded-2xl border border-primary/30 bg-primary/5 text-xs font-black uppercase tracking-widest text-foreground">{c}</span>
          {i < chain.length - 1 && <motion.span className="h-px w-8 bg-primary" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }} />}
        </motion.div>
      ))}
    </div>
  );
}

export function Segments() {
  const segs = [
    { icon: Briefcase, t: "Holdings Patrimoniais" }, { icon: Users, t: "Family Offices" },
    { icon: Building2, t: "Grupos Empresariais" }, { icon: Tractor, t: "Agronegócio" },
    { icon: Gavel, t: "Escritórios Jurídicos" }, { icon: Scale, t: "Consultorias e Contabilidades" },
    { icon: Landmark, t: "Setor Público e Municípios" }, { icon: FileText, t: "Cartórios" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {segs.map((s, i) => (
        <motion.div key={s.t} {...fade} transition={{ delay: i * 0.05 }} className="p-6 rounded-3xl border border-border bg-card/40 flex flex-col gap-4">
          <s.icon className="h-6 w-6 text-primary" />
          <span className="font-black uppercase italic tracking-tight text-foreground text-sm">{s.t}</span>
        </motion.div>
      ))}
    </div>
  );
}

export function Market() {
  const stats = [
    { v: "+30%", l: "Crescimento anual na criação de holdings familiares no Brasil (estimativa)" },
    { v: "R$ 2 tri+", l: "Patrimônio sob gestão de family offices e grupos familiares (estimativa)" },
    { v: "~25%", l: "Participação do agronegócio no PIB brasileiro" },
    { v: "100%", l: "Das estruturas sujeitas a exigências crescentes de compliance" },
  ];
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((s, i) => (
        <motion.div key={i} {...fade} transition={{ delay: i * 0.1 }} className="p-8 rounded-[2rem] border border-border bg-card/40">
          <TrendingUp className="h-5 w-5 text-primary mb-6" />
          <p className="text-4xl font-black italic text-primary tabular-nums">{s.v}</p>
          <p className="mt-3 text-sm text-muted-foreground italic leading-relaxed">{s.l}</p>
        </motion.div>
      ))}
    </div>
  );
}

type Cell = "y" | "p" | "n";
export function CompetitorTable() {
  const cols = ["USE PATRIUM", "SoftExpert", "Senior", "SAP", "Oracle", "Diligent", "GED", "Jurídicos"];
  const rows: [string, Cell[]][] = [
    ["Governança patrimonial", ["y", "p", "p", "p", "p", "y", "n", "n"]],
    ["Compliance", ["y", "y", "p", "p", "p", "y", "n", "p"]],
    ["IA especializada", ["y", "p", "p", "p", "p", "p", "n", "p"]],
    ["Knowledge Graph", ["y", "n", "n", "n", "n", "n", "n", "n"]],
    ["Digital Twin", ["y", "n", "n", "p", "n", "n", "n", "n"]],
    ["Jarvis (Diretor Digital)", ["y", "n", "n", "n", "n", "n", "n", "n"]],
    ["Family Office", ["y", "n", "n", "n", "n", "p", "n", "n"]],
    ["Agro patrimonial", ["y", "n", "p", "p", "n", "n", "n", "n"]],
  ];
  const icon = (c: Cell) => c === "y" ? <CheckCircle2 className="h-5 w-5 text-primary mx-auto" /> : c === "p" ? <MinusCircle className="h-5 w-5 text-muted-foreground mx-auto" /> : <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto" />;
  return (
    <div className="overflow-x-auto rounded-[2.5rem] border border-border bg-card/30">
      <table className="w-full min-w-[900px] text-left">
        <thead><tr className="border-b border-border">
          <th className="p-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Capacidade</th>
          {cols.map((c, i) => <th key={c} className={`p-6 text-[10px] font-black uppercase tracking-widest text-center ${i === 0 ? "text-primary bg-primary/5" : "text-muted-foreground"}`}>{c}</th>)}
        </tr></thead>
        <tbody>{rows.map(([n, cells]) => (
          <tr key={n} className="border-b border-border last:border-0">
            <td className="p-6 font-bold text-foreground">{n}</td>
            {cells.map((c, i) => <td key={i} className={`p-6 ${i === 0 ? "bg-primary/5" : ""}`}>{icon(c)}</td>)}
          </tr>
        ))}</tbody>
      </table>
      <p className="px-6 py-4 text-xs text-muted-foreground italic border-t border-border">● Nativo &nbsp; ◐ Parcial ou via customização &nbsp; ○ Não disponível — análise comparativa indicativa.</p>
    </div>
  );
}

export function Differentiators() {
  const d = [
    { icon: Sparkles, t: "Jarvis", d: "Diretor patrimonial digital que age, não só responde." },
    { icon: Network, t: "Knowledge Graph", d: "Todas as relações patrimoniais conectadas." },
    { icon: Box, t: "Digital Twin", d: "Cada ativo com seu gêmeo digital completo." },
    { icon: Cpu, t: "IA Multiagente", d: "Agentes documental, compliance, risco e agro." },
    { icon: ShieldAlert, t: "Central de Riscos", d: "Riscos priorizados antes de virarem prejuízo." },
    { icon: Layers, t: "Sistema Operacional", d: "Uma camada única acima de todos os sistemas." },
  ];
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {d.map((x, i) => (
        <motion.div key={x.t} {...fade} transition={{ delay: i * 0.06 }} className="p-8 rounded-[2rem] border border-border bg-card/40 hover:border-primary/40 transition-colors">
          <x.icon className="h-7 w-7 text-primary mb-6" />
          <h4 className="text-xl font-black italic uppercase text-foreground">{x.t}</h4>
          <p className="mt-2 text-muted-foreground italic">{x.d}</p>
        </motion.div>
      ))}
    </div>
  );
}

export function ROI() {
  const items = [
    { v: "até 80%", l: "menos tempo em auditorias documentais" },
    { v: "R$ 500 mil+", l: "em multas e passivos evitáveis por ano em grupos médios" },
    { v: "24/7", l: "monitoramento sem aumentar equipe" },
  ];
  return (
    <div className="mt-12 p-10 rounded-[2.5rem] border border-primary/30 bg-primary/5">
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-8">Potencial de ROI (estimativas ilustrativas)</p>
      <div className="grid md:grid-cols-3 gap-8">
        {items.map((r) => (
          <div key={r.l}><p className="text-4xl font-black italic text-foreground tabular-nums">{r.v}</p><p className="mt-2 text-muted-foreground italic">{r.l}</p></div>
        ))}
      </div>
    </div>
  );
}

export function Roadmap() {
  const phases = ["Governança", "Compliance", "Regularização Imobiliária", "Agro", "Jarvis Autônomo", "Marketplace", "Cartórios", "Municípios"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {phases.map((p, i) => (
        <motion.div key={p} {...fade} transition={{ delay: i * 0.06 }} className={`p-6 rounded-3xl border ${i < 2 ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Fase {String(i + 1).padStart(2, "0")}</p>
          <p className="mt-3 font-black italic uppercase text-foreground">{p}</p>
          <p className="mt-2 text-xs text-muted-foreground">{i < 2 ? "Em operação" : "Planejado"}</p>
        </motion.div>
      ))}
    </div>
  );
}

export { Search };
