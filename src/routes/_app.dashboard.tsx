import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Landmark, 
  ArrowUpRight, 
  Building2, 
  Boxes,
  FileSearch,
  Loader2
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useAssets, useRisks, useEntities } from "@/hooks/usePatrimonio";

const complianceData = [
  { name: "Jan", score: 82 },
  { name: "Fev", score: 85 },
  { name: "Mar", score: 84 },
  { name: "Abr", score: 88 },
  { name: "Mai", score: 92 },
  { name: "Jun", score: 96 },
];

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardExecutivo,
});

function DashboardExecutivo() {
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: risks, isLoading: risksLoading } = useRisks();
  const { data: entities, isLoading: entitiesLoading } = useEntities();

  if (assetsLoading || risksLoading || entitiesLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const totalValue = assets?.reduce((sum, asset) => sum + (Number(asset.value) || 0), 0) || 0;
  const avgCompliance = entities && entities.length > 0 
    ? entities.reduce((sum, ent) => sum + (Number(ent.compliance_score) || 0), 0) / entities.length 
    : 0;

  return (
    <div className="space-y-12 lg:space-y-20 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-[1800px] mx-auto overflow-x-hidden w-full relative">
      <div className="fixed inset-0 noise-overlay opacity-[0.02] pointer-events-none" />
      
      {/* Executive Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10 lg:gap-14 pb-12 border-b border-white/[0.05] executive-grid">
        <div className="space-y-6 lg:space-y-10 relative z-10">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-6 lg:gap-8"
          >
            <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl lg:rounded-[2rem] bg-primary/5 flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/10 group hover:scale-110 transition-all duration-700 shrink-0 backdrop-blur-xl">
              <Building2 className="h-8 w-8 lg:h-10 lg:w-10 text-primary drop-shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] lg:text-[12px] font-black uppercase tracking-[0.5em] text-primary/70 leading-none italic">Institutional Command Center</p>
              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem] font-black tracking-tighter text-foreground uppercase italic leading-[0.85]">
                DASHBOARD <span className="text-primary drop-shadow-[0_0_40px_rgba(212,163,85,0.2)]">ESTRATÉGICO</span>
              </h2>
            </div>
          </motion.div>
          <p className="text-muted-foreground text-lg lg:text-2xl font-medium max-w-3xl leading-relaxed italic opacity-80">
            Monitoramento de alta fidelidade para <span className="text-foreground font-black border-b-2 border-primary/40">Holdings, Ativos e Compliance</span>. 
            <Link to="/jarvis" className="text-primary font-black hover:text-white transition-colors ml-1 uppercase tracking-widest text-xs">Jarvis: Diretor Patrimonial Digital Ativo</Link>.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-8 xl:gap-14 relative z-10">
          <div className="p-10 lg:p-12 glass-card rounded-[3rem] lg:rounded-[4rem] flex flex-col items-center sm:items-end min-w-0 sm:min-w-[280px] border-primary/20 bg-primary/[0.02] shadow-2xl relative overflow-hidden group/aum">
             <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover/aum:opacity-100 transition-opacity duration-700" />
             <p className="text-[10px] lg:text-[12px] uppercase tracking-[0.4em] text-primary font-black mb-4 italic opacity-80 relative z-10">Portfolio Value (AUM)</p>
             <p className="text-4xl lg:text-7xl font-black text-foreground tabular-nums tracking-tighter italic relative z-10 drop-shadow-2xl">
                R$ {(totalValue / 1000000).toFixed(1)}<span className="text-lg lg:text-2xl ml-1 text-primary">M</span>
             </p>
             <div className="flex items-center gap-2 text-[10px] lg:text-xs text-emerald-500 font-black mt-4 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 relative z-10 shadow-lg shadow-emerald-500/5">
                <ArrowUpRight className="h-4 w-4 animate-bounce-subtle" /> +12.4% <span className="opacity-60 font-bold ml-1 uppercase tracking-widest">Growth</span>
             </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-8 lg:gap-12 bg-white/[0.01] p-10 lg:p-12 rounded-[3rem] lg:rounded-[4rem] border border-white/[0.05] backdrop-blur-3xl group hover:bg-white/[0.03] transition-all duration-1000 shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 executive-grid opacity-20 pointer-events-none" />
            <div className="text-left sm:text-right space-y-2 relative z-10">
              <p className="text-[10px] lg:text-[12px] uppercase tracking-[0.4em] text-primary font-black italic">Compliance Score</p>
              <p className="text-3xl lg:text-5xl font-black text-foreground tabular-nums tracking-tighter italic">{avgCompliance.toFixed(1)}<span className="text-sm lg:text-base ml-1 opacity-30">%</span></p>
            </div>
            <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-full border-[4px] border-primary/10 border-t-primary flex items-center justify-center relative shadow-[0_0_40px_rgba(var(--primary),0.2)] shrink-0 z-10">
               <ShieldCheck className="h-8 w-8 lg:h-10 lg:w-10 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]" />
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-0 rounded-full border border-dashed border-primary/30 scale-125"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-10">
        <HealthCard 
          title="Saúde Patrimonial" 
          value={`R$ ${(totalValue / 1000000).toFixed(1)}M`}
          status="Otimizado"
          color="primary"
          icon={Landmark}
          description="Alocação estratégica e valorização proativa de ativos sob gestão direta."
          metrics={[
            { label: "Ativos Urbanos", val: `${((assets?.filter(a => a.type === 'urbano').length || 0) / (assets?.length || 1) * 100).toFixed(0)}%` },
            { label: "Reserva Rural", val: `${((assets?.filter(a => a.type === 'rural').length || 0) / (assets?.length || 1) * 100).toFixed(0)}%` }
          ]}
        />
        <HealthCard 
          title="Saúde Documental" 
          value="94.2%" 
          status="Monitorado"
          color="blue"
          icon={FileSearch}
          description="Rastreabilidade total de matrículas, ônus reais e regularidade cartorária."
          metrics={[{ label: "Doc. Validados", val: "1.248" }, { label: "Alertas IA", val: "03" }]}
        />
        <HealthCard 
          title="Fronteira Regulatória" 
          value="98.1%" 
          status="Impecável"
          color="emerald"
          icon={ShieldCheck}
          description="Blindagem institucional, CNDs e conformidade regulatória total."
          metrics={[{ label: "SLA Resposta", val: "100%" }, { label: "Certidões", val: "Ativas" }]}
        />
      </div>

      {/* Intelligence & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-8 glass-card rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-12 space-y-8 lg:space-y-10 relative overflow-hidden group border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent shadow-2xl">
          <div className="absolute -top-32 -right-32 h-80 w-80 bg-primary/10 rounded-full blur-[120px] pointer-events-none group-hover:bg-primary/20 transition-all duration-1000" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <h3 className="text-2xl lg:text-3xl font-black flex items-center gap-4 tracking-tighter italic">
                <Activity className="h-6 w-6 lg:h-8 lg:w-8 text-primary animate-pulse" />
                DYNAMICS ANALYSIS
              </h3>
              <p className="text-[10px] lg:text-[11px] text-muted-foreground uppercase tracking-[0.3em] font-black opacity-50">Evolução do Score de Governança</p>
            </div>
            <button className="px-6 lg:px-8 py-2.5 lg:py-3 bg-primary/10 border border-primary/20 rounded-full text-[10px] lg:text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary text-white transition-all shadow-xl shadow-primary/10 active:scale-95 w-full sm:w-auto">Gerar Relatório IA</button>
          </div>
          
          <div className="h-[300px] md:h-[450px] xl:h-[550px] w-full relative z-10 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceData}>
                <defs>
                  <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 900 }} 
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{ stroke: 'var(--color-primary)', strokeWidth: 3, strokeDasharray: '6 6' }}
                  contentStyle={{ 
                    backgroundColor: "rgba(10,10,10,0.95)", 
                    backdropFilter: "blur(30px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "20px",
                    padding: "15px",
                    boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#compGradient)" 
                  strokeWidth={4}
                  animationDuration={3000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8 lg:space-y-10">
          <div className="glass-card rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 space-y-8 lg:space-y-10 border-orange-500/10 bg-gradient-to-b from-orange-500/[0.03] to-transparent shadow-2xl shadow-orange-500/5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl lg:text-2xl font-black flex items-center gap-4 tracking-tighter italic">
                <AlertTriangle className="h-6 w-6 lg:h-7 lg:w-7 text-orange-500" />
                RISKS
              </h3>
              <span className="h-7 px-3 rounded-full bg-orange-500/15 text-orange-500 text-[10px] lg:text-[11px] font-black flex items-center tracking-widest border border-orange-500/20">CRÍTICO</span>
            </div>
            <div className="space-y-4">
              {risks?.slice(0, 4).map((risk) => (
                <RiskItem 
                  key={risk.id}
                  title={risk.title} 
                  target={(risk.entities as any)?.name || (risk.assets as any)?.name} 
                  days={risk.due_date ? new Date(risk.due_date).toLocaleDateString() : "URGENTE"} 
                  severity={risk.severity}
                />
              ))}
              {(!risks || risks.length === 0) && (
                <div className="flex flex-col items-center justify-center py-12 opacity-40">
                  <ShieldCheck className="h-12 w-12 lg:h-16 lg:w-16 mb-4 text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Ambiente Seguro</p>
                </div>
              )}
            </div>
            <button className="w-full py-5 lg:py-6 bg-white/5 border border-white/10 rounded-[1.5rem] lg:rounded-[2rem] text-[10px] lg:text-[11px] font-black uppercase tracking-[0.4em] hover:bg-orange-500 hover:text-white transition-all duration-700 active:scale-95">
              Acessar Central de Crise
            </button>
          </div>

          <div className="glass-card rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-10 space-y-8 lg:space-y-10 border-blue-500/10 shadow-2xl">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <h3 className="text-xl lg:text-2xl font-black flex items-center gap-4 tracking-tighter italic">
                  <Boxes className="h-6 w-6 lg:h-7 lg:w-7 text-blue-500" />
                  STRUCTURE
                </h3>
                <div className="flex -space-x-3 items-center">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border-2 border-sidebar bg-accent overflow-hidden grayscale hover:grayscale-0 transition-all cursor-pointer hover:scale-110">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+10}`} alt="Sócio" />
                    </div>
                  ))}
                  <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full border-2 border-sidebar bg-white/10 flex items-center justify-center text-[10px] font-black backdrop-blur-md">
                    +8
                  </div>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4 lg:gap-6">
                <div className="p-6 lg:p-8 bg-white/[0.03] rounded-2xl lg:rounded-[2.5rem] border border-white/5 group hover:border-blue-500/40 transition-all duration-500">
                   <p className="text-[9px] lg:text-[11px] uppercase font-black text-muted-foreground/50 tracking-[0.3em]">Holdings</p>
                   <p className="text-2xl lg:text-4xl font-black mt-2 text-foreground tabular-nums tracking-tighter">{entities?.length.toString().padStart(2, '0')}</p>
                </div>
                <div className="p-6 lg:p-8 bg-white/[0.03] rounded-2xl lg:rounded-[2.5rem] border border-white/5 group hover:border-blue-500/40 transition-all duration-500">
                   <p className="text-[9px] lg:text-[11px] uppercase font-black text-muted-foreground/50 tracking-[0.3em]">Conselho</p>
                   <p className="text-2xl lg:text-4xl font-black mt-2 text-foreground tabular-nums tracking-tighter">12</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ title, value, status, color, icon: Icon, description, metrics }: any) {
  const colors: Record<string, string> = {
    primary: "text-primary bg-primary/10 border-primary/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  };

  return (
    <div className="glass-card rounded-[2rem] lg:rounded-[2.5rem] p-6 lg:p-8 space-y-6 group hover:border-white/20 transition-all border border-transparent">
      <div className="flex items-start justify-between">
        <div className={cn("p-3 lg:p-4 rounded-xl lg:rounded-2xl transition-transform group-hover:scale-110 duration-500 shrink-0", colors[color] || colors.primary)}>
          <Icon className="h-6 w-6 lg:h-8 lg:w-8" />
        </div>
        <div className={cn("px-2.5 py-1 rounded-full text-[9px] lg:text-[10px] font-black uppercase tracking-widest", colors[color] || colors.primary)}>
          {status}
        </div>
      </div>
      
      <div>
        <p className="text-xs lg:text-sm font-bold text-muted-foreground tracking-tight">{title}</p>
        <h4 className="text-2xl lg:text-3xl font-black mt-1">{value}</h4>
        <p className="text-[11px] lg:text-xs text-muted-foreground/60 mt-2 leading-relaxed line-clamp-2 lg:line-clamp-none">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        {metrics?.map((m: any) => (
          <div key={m.label}>
            <p className="text-[9px] lg:text-[10px] font-black uppercase text-muted-foreground/40">{m.label}</p>
            <p className="text-xs lg:text-sm font-bold text-foreground mt-0.5">{m.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskItem({ title, target, days, severity }: any) {
  const sev: Record<string, string> = {
    critical: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
    high: "bg-orange-500",
    medium: "bg-blue-500",
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/5 group">
      <div className={cn("h-2 w-2 lg:h-2.5 lg:w-2.5 rounded-full shrink-0", sev[severity])} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] lg:text-xs font-bold truncate group-hover:text-primary transition-colors">{title}</p>
        <p className="text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 font-medium truncate">{target}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn("text-[11px] lg:text-xs font-black", severity === 'critical' ? 'text-red-400' : 'text-foreground')}>{days}</p>
      </div>
    </div>
  );
}
