import { createFileRoute } from "@tanstack/react-router";
import { 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  FileWarning, 
  ArrowUpRight, 
  Building, 
  Landmark,
  FileText
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

const data = [
  { name: "Jan", compliance: 85, risks: 12 },
  { name: "Fev", compliance: 88, risks: 10 },
  { name: "Mar", compliance: 82, risks: 15 },
  { name: "Abr", compliance: 90, risks: 8 },
  { name: "Mai", compliance: 94, risks: 5 },
  { name: "Jun", compliance: 96, risks: 4 },
];

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Cérebro Patrimonial</h2>
          <p className="text-muted-foreground mt-2 max-w-lg">
            Visão 360° da sua governança. Detectamos <span className="text-primary font-semibold">4 novos riscos</span> críticos na última hora.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-10 rounded-full border-2 border-background bg-secondary flex items-center justify-center overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="Avatar" />
              </div>
            ))}
          </div>
          <div className="h-10 px-4 flex items-center bg-white/5 border border-white/10 rounded-xl text-xs font-medium">
            +12 ativos compartilhados
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Compliance Score" 
          value="96.8%" 
          trend="+2.4%" 
          icon={ShieldCheck} 
          color="text-primary"
          description="Saúde global regulatória"
        />
        <StatCard 
          title="Saúde Patrimonial" 
          value="R$ 142.5M" 
          trend="+R$ 1.2M" 
          icon={Landmark} 
          color="text-emerald-500"
          description="Avaliação de mercado"
        />
        <StatCard 
          title="Saúde Documental" 
          value="1,420" 
          trend="82 pendentes" 
          icon={FileText} 
          color="text-blue-500"
          description="Documentos validados"
        />
        <StatCard 
          title="Riscos Ativos" 
          value="14" 
          trend="-2 este mês" 
          icon={AlertTriangle} 
          color="text-orange-500"
          description="Incidentes detectados"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Evolução de Governança
            </h3>
            <select className="bg-transparent border-none text-xs text-muted-foreground focus:ring-0 cursor-pointer">
              <Last6Months />
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "oklch(0.15 0.02 250)", 
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: "12px",
                    color: "#fff"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="compliance" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#colorComp)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8 space-y-6">
          <h3 className="text-lg font-semibold">Pendências Críticas</h3>
          <div className="space-y-4">
            <PendingItem 
              title="Escritura Fazenda Santa Fé" 
              status="Vence em 2 dias" 
              type="Documental"
              severity="critical"
            />
            <PendingItem 
              title="Renovação AVCB Sede SP" 
              status="Atrasado" 
              type="Regulatório"
              severity="high"
            />
            <PendingItem 
              title="Certidão Negativa SEFAZ" 
              status="Pendente" 
              type="Compliance"
              severity="medium"
            />
            <PendingItem 
              title="IPTU Unidade Curitiba" 
              status="Pendente" 
              type="Patrimonial"
              severity="medium"
            />
          </div>
          <button className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
            Ver todas as 14 pendências
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color, description }: any) {
  return (
    <div className="glass-card rounded-3xl p-6 space-y-4 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-xl bg-white/5", color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
          {trend}
          <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <h4 className="text-2xl font-bold mt-1">{value}</h4>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">{description}</p>
      </div>
    </div>
  );
}

function PendingItem({ title, status, type, severity }: any) {
  const severityColors: any = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-blue-500",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
      <div className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", severityColors[severity])} />
      <div className="flex-1 overflow-hidden">
        <p className="text-sm font-medium truncate">{title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-wider">{type}</span>
          <span className="text-[10px] text-red-400 font-medium">{status}</span>
        </div>
      </div>
    </div>
  );
}

function Last6Months() {
  return (
    <>
      <option>Últimos 6 meses</option>
      <option>Últimos 12 meses</option>
      <option>Este ano</option>
    </>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
