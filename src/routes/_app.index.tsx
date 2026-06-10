import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Landmark, 
  ArrowUpRight, 
  Building2, 
  Boxes,
  FileText,
  PieChart,
  TrendingUp,
  FileSearch,
  Users2,
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

export const Route = createFileRoute("/_app/")({
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Executive Header - Futuristic Layout */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-4 border-b border-white/5">
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.1)]">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Sistema de Governança</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-none">
                Comando <span className="text-primary">Estratégico</span>
              </h2>
            </div>
          </motion.div>
          <p className="text-muted-foreground text-lg font-medium max-w-2xl leading-relaxed">
            Visão consolidada de <span className="text-foreground font-bold border-b-2 border-primary/30">Holdings, Patrimônio e Compliance</span>. 
            IA ativa processando dados em tempo real.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 xl:gap-8">
          <div className="p-6 glass-card rounded-[2rem] flex flex-col items-end min-w-[200px] border-primary/10">
             <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-black mb-1">AUM Global</p>
             <p className="text-4xl font-black text-foreground tabular-nums">
                R$ {(totalValue / 1000000).toFixed(1)}<span className="text-sm ml-1 text-primary">M</span>
             </p>
             <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold mt-1">
                <ArrowUpRight className="h-3 w-3" /> +12.4% vs LY
             </div>
          </div>

          <div className="flex items-center gap-6 bg-primary/5 p-6 rounded-[2rem] border border-primary/20 backdrop-blur-xl group hover:bg-primary/10 transition-all duration-500">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-black">Score de Compliance</p>
              <p className="text-3xl font-black text-foreground tabular-nums">{avgCompliance.toFixed(1)}<span className="text-xs ml-1 opacity-50">%</span></p>
            </div>
            <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary flex items-center justify-center relative shadow-[0_0_15px_rgba(var(--primary),0.2)]">
               <ShieldCheck className="h-6 w-6 text-primary" />
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-0 rounded-full border border-dashed border-primary/30"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Primary Health Indicators - High Contrast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <HealthCard 
          title="Saúde Patrimonial" 
          value={`R$ ${(totalValue / 1000000).toFixed(1)}M`}
          status="Otimizado"
          color="primary"
          icon={Landmark}
          description="Alocação estratégica e valorização de ativos ativos."
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
          description="Rastreabilidade total de matrículas e ônus reais."
          metrics={[{ label: "Doc. Validados", val: "1.248" }, { label: "Alertas IA", val: "03" }]}
        />
        <HealthCard 
          title="Fronteira Regulatória" 
          value="98.1%" 
          status="Impecável"
          color="emerald"
          icon={ShieldCheck}
          description="Blindagem institucional e conformidade total."
          metrics={[{ label: "SLA Resposta", val: "100%" }, { label: "Certidões", val: "Ativas" }]}
        />
      </div>


      {/* Intelligence & Analytics Grid - Pro Dark Theme */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Compliance Evolution - Wide Glass Panel */}
        <div className="lg:col-span-8 glass-card rounded-[3rem] p-10 space-y-8 relative overflow-hidden group border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="absolute -top-24 -right-24 h-64 w-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/20 transition-all duration-700" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <h3 className="text-2xl font-black flex items-center gap-3 tracking-tight italic">
                <Activity className="h-6 w-6 text-primary animate-pulse" />
                DYNAMICS ANALYSIS
              </h3>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-60">Evolução do Score de Governança Proativa</p>
            </div>
            <div className="flex gap-2">
              <button className="px-6 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-primary text-white transition-all shadow-lg shadow-primary/10">Gerar Relatório IA</button>
            </div>
          </div>
          
          <div className="h-[400px] w-full relative z-10 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceData}>
                <defs>
                  <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 10, fontWeight: 800 }} 
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{ stroke: 'var(--color-primary)', strokeWidth: 2, strokeDasharray: '4 4' }}
                  contentStyle={{ 
                    backgroundColor: "rgba(0,0,0,0.8)", 
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "24px",
                    padding: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#compGradient)" 
                  strokeWidth={5}
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk & Structure - Side Stack */}
        <div className="lg:col-span-4 space-y-8">
          {/* Critical Issues - High Intensity */}
          <div className="glass-card rounded-[3rem] p-8 space-y-8 border-orange-500/10 bg-gradient-to-b from-orange-500/[0.02] to-transparent">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-3 tracking-tight italic">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                RISKS
              </h3>
              <span className="h-6 px-2 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-black flex items-center">CRÍTICO</span>
            </div>
            <div className="space-y-3">
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
                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                  <ShieldCheck className="h-12 w-12 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhum risco detectado</p>
                </div>
              )}
            </div>
            <button className="w-full py-5 bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-orange-500 hover:text-white transition-all duration-500">
              Acessar Central de Crise
            </button>
          </div>

          {/* Holdings Structure - Dark Tech Style */}
          <div className="glass-card rounded-[3rem] p-8 space-y-8 border-blue-500/10">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black flex items-center gap-3 tracking-tight italic">
                  <Boxes className="h-6 w-6 text-blue-500" />
                  STRUCTURE
                </h3>
                <div className="flex -space-x-3 items-center">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-accent overflow-hidden grayscale hover:grayscale-0 transition-all cursor-pointer">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+10}`} alt="Sócio" />
                    </div>
                  ))}
                  <div className="h-8 w-8 rounded-full border-2 border-background bg-white/10 flex items-center justify-center text-[10px] font-black">
                    +8
                  </div>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
                   <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Holdings</p>
                   <p className="text-3xl font-black mt-1 text-foreground">{entities?.length.toString().padStart(2, '0')}</p>
                </div>
                <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
                   <p className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">Conselho</p>
                   <p className="text-3xl font-black mt-1 text-foreground">12</p>
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
    <div className="glass-card rounded-[2.5rem] p-8 space-y-6 group hover:border-white/20 transition-all border border-transparent">
      <div className="flex items-start justify-between">
        <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 duration-500", colors[color] || colors.primary)}>
          <Icon className="h-8 w-8" />
        </div>
        <div className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest", colors[color] || colors.primary)}>
          {status}
        </div>
      </div>
      
      <div>
        <p className="text-sm font-bold text-muted-foreground tracking-tight">{title}</p>
        <h4 className="text-3xl font-black mt-1">{value}</h4>
        <p className="text-xs text-muted-foreground/60 mt-2 leading-relaxed">{description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        {metrics?.map((m: any) => (
          <div key={m.label}>
            <p className="text-[10px] font-black uppercase text-muted-foreground/40">{m.label}</p>
            <p className="text-sm font-bold text-foreground mt-0.5">{m.val}</p>
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
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", sev[severity])} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{target}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-xs font-black", severity === 'critical' ? 'text-red-400' : 'text-foreground')}>{days}</p>
      </div>
    </div>
  );
}
