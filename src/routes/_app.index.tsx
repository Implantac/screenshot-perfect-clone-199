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
    <div className="space-y-10 animate-in fade-in duration-1000">
      {/* Executive Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1 bg-primary rounded-full shadow-[0_0_12px_var(--color-primary)]" />
            <h2 className="text-4xl font-black tracking-tighter text-foreground uppercase">Centro de Comando</h2>
          </div>
          <p className="text-muted-foreground text-lg font-medium max-w-2xl leading-relaxed">
            Gestão estratégica de <span className="text-foreground font-bold">Governança Patrimonial, Compliance e Inteligência Documental</span>.
          </p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
             <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Patrimônio Líquido</p>
             <p className="text-3xl font-black text-foreground">
                R$ {(totalValue / 1000000).toFixed(1)}<span className="text-xs ml-1 opacity-50">M</span>
             </p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[2rem] border border-white/5 backdrop-blur-md">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Compliance Score</p>
              <p className="text-2xl font-black text-primary">{avgCompliance.toFixed(1)}<span className="text-xs ml-1 opacity-50">%</span></p>
            </div>
            <div className="h-10 w-[1px] bg-white/10 mx-2" />
            <div className="h-14 w-14 rounded-full border-4 border-primary/20 border-t-primary flex items-center justify-center relative">
               <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>
      </div>


      {/* Primary Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <HealthCard 
          title="Saúde Patrimonial" 
          value={`R$ ${(totalValue / 1000000).toFixed(1)}M`}
          status="Em Alta"
          color="primary"
          icon={Landmark}
          description="Valor total de ativos sob gestão"
          metrics={[
            { label: "Urbanos", val: `${((assets?.filter(a => a.type === 'urbano').length || 0) / (assets?.length || 1) * 100).toFixed(0)}%` },
            { label: "Rurais", val: `${((assets?.filter(a => a.type === 'rural').length || 0) / (assets?.length || 1) * 100).toFixed(0)}%` }
          ]}
        />
        <HealthCard 
          title="Saúde Documental" 
          value="94.2%" 
          status="Regular"
          color="blue"
          icon={FileSearch}
          description="Validação de matrículas e ônus"
          metrics={[{ label: "Validados", val: "1.2k" }, { label: "Pendentes", val: "42" }]}
        />
        <HealthCard 
          title="Saúde Regulatória" 
          value="98.1%" 
          status="Excelente"
          color="emerald"
          icon={ShieldCheck}
          description="Certidões e licenças ativas"
          metrics={[{ label: "SLA", val: "100%" }, { label: "Alertas", val: "0" }]}
        />
      </div>


      {/* Intelligence & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Compliance Evolution */}
        <div className="lg:col-span-8 glass-card rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
             <TrendingUp className="h-32 w-32" />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-3">
                <Activity className="h-5 w-5 text-primary" />
                Inteligência de Compliance
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Evolução histórica do score de governança</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Relatório IA</button>
            </div>
          </div>
          
          <div className="h-[350px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={complianceData}>
                <defs>
                  <linearGradient id="compGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11, fontWeight: 700 }} 
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip 
                  cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1 }}
                  contentStyle={{ 
                    backgroundColor: "oklch(0.1 0.015 250)", 
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: "20px",
                    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#compGradient)" 
                  strokeWidth={4}
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Pendências Críticas
            </h3>
            <div className="space-y-4">
              {risks?.slice(0, 4).map((risk) => (
                <RiskItem 
                  key={risk.id}
                  title={risk.title} 
                  target={(risk.entities as any)?.name || (risk.assets as any)?.name} 
                  days={risk.due_date ? new Date(risk.due_date).toLocaleDateString() : "IA"} 
                  severity={risk.severity}
                />
              ))}
              {(!risks || risks.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum risco crítico detectado.</p>
              )}
            </div>
            <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
              Central de Riscos
            </button>
          </div>

          <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
             <h3 className="text-lg font-bold flex items-center gap-2">
                <Boxes className="h-5 w-5 text-blue-500" />
                Estrutura Societária
             </h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground">Holdings</p>
                   <p className="text-xl font-black mt-1">{entities?.length.toString().padStart(2, '0')}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                   <p className="text-[10px] uppercase font-bold text-muted-foreground">Sócios</p>
                   <p className="text-xl font-black mt-1">12</p>
                </div>
             </div>
             <div className="flex -space-x-3 items-center">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-accent overflow-hidden">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i+10}`} alt="Sócio" />
                  </div>
                ))}
                <div className="h-10 w-10 rounded-full border-2 border-background bg-white/10 flex items-center justify-center text-[10px] font-bold">
                  +8
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
