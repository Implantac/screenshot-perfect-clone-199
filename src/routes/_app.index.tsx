import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  Landmark, 
  ArrowUpRight, 
  Building2, 
  Boxes,
  Briefcase,
  FileText,
  MapPin
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

const data = [
  { name: "Jan", saude: 82 },
  { name: "Fev", saude: 85 },
  { name: "Mar", saude: 84 },
  { name: "Abr", saude: 88 },
  { name: "Mai", saude: 92 },
  { name: "Jun", saude: 96 },
];

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Top Banner - Intelligence Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            Cérebro Patrimonial 
            <span className="text-primary h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
          </h2>
          <p className="text-muted-foreground mt-2 max-w-xl text-lg leading-relaxed">
            Gestão consolidada de holdings e ativos. Identificamos <span className="text-primary font-bold">5 inconsistências documentais</span> críticas que requerem sua atenção.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">Saúde Global</p>
            <p className="text-lg font-bold text-emerald-500 leading-none mt-1">Ótima</p>
          </div>
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
            Relatório Executivo
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Patrimônio Consolidado" 
          value="R$ 248.4M" 
          trend="+4.2%" 
          icon={Landmark} 
          color="text-primary"
          description="Avaliação em tempo real"
        />
        <StatCard 
          title="Compliance Score" 
          value="96.8" 
          trend="+1.4%" 
          icon={ShieldCheck} 
          color="text-emerald-500"
          description="Risco regulatório baixo"
        />
        <StatCard 
          title="Ativos Gerenciados" 
          value="32" 
          trend="+2" 
          icon={Building2} 
          color="text-blue-500"
          description="Imóveis, Rural e Sociedades"
        />
        <StatCard 
          title="Alertas de Risco" 
          value="05" 
          trend="-2" 
          icon={AlertTriangle} 
          color="text-orange-500"
          description="Pendências documentais"
        />
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 glass-card rounded-[2rem] p-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Performance de Governança</h3>
                <p className="text-xs text-muted-foreground">Evolução do índice de saúde patrimonial</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] font-bold uppercase hover:bg-white/10 transition-all">Exportar</button>
            </div>
          </div>
          
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12, fontWeight: 500 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "oklch(0.12 0.015 250)", 
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: "16px",
                    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="saude" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#chartGradient)" 
                  strokeWidth={4}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Critical Alerts & Quick Info */}
        <div className="space-y-6">
          <div className="glass-card rounded-[2rem] p-8 space-y-6">
            <h3 className="text-lg font-bold">Mapa Societário</h3>
            <div className="space-y-4">
              <HoldingItem name="Holding Alencar S.A." participation="Main" value="R$ 142M" />
              <HoldingItem name="Agroinvest Participações" participation="75%" value="R$ 54M" />
              <HoldingItem name="SP Urbanismo Ltda" participation="100%" value="R$ 52M" />
            </div>
            <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">
              Ver Organograma
            </button>
          </div>

          <div className="glass-card rounded-[2rem] p-8 space-y-6">
            <h3 className="text-lg font-bold">Saúde por Categoria</h3>
            <div className="space-y-5">
              <CategoryHealth label="Imóveis Urbanos" score={98} color="bg-emerald-500" />
              <CategoryHealth label="Agronegócio" score={82} color="bg-orange-500" />
              <CategoryHealth label="Documental" score={74} color="bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color, description }: any) {
  return (
    <div className="glass-card rounded-[2rem] p-7 space-y-5 relative overflow-hidden group hover:border-primary/20 transition-all">
      <div className="flex items-center justify-between">
        <div className={cn("p-3 rounded-2xl bg-white/5", color)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 rounded-full">
          {trend}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-semibold tracking-tight">{title}</p>
        <h4 className="text-2xl font-black mt-1 text-foreground">{value}</h4>
        <div className="flex items-center gap-2 mt-3">
          <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">{description}</p>
        </div>
      </div>
    </div>
  );
}

function HoldingItem({ name, participation, value }: any) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-all">
          <Boxes className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold truncate max-w-[120px]">{name}</p>
          <p className="text-[10px] text-muted-foreground font-bold">{participation}</p>
        </div>
      </div>
      <p className="text-sm font-bold text-primary">{value}</p>
    </div>
  );
}

function CategoryHealth({ label, score, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        <span>{score}%</span>
      </div>
      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className={cn("h-full", color)} 
        />
      </div>
    </div>
  );
}
