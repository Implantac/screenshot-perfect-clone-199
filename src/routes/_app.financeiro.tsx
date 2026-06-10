import { createFileRoute } from "@tanstack/react-router";
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  PieChart as PieIcon,
  Calendar,
  Building2,
  Boxes,
  FileText,
  CreditCard,
  Download,
  Filter,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";

export const Route = createFileRoute("/_app/financeiro" as any)({
  component: FluxoFinanceiro,
});

const cashflowData = [
  { name: "Jan", entrada: 420, saida: 180 },
  { name: "Fev", entrada: 380, saida: 210 },
  { name: "Mar", entrada: 510, saida: 190 },
  { name: "Abr", entrada: 490, saida: 250 },
  { name: "Mai", entrada: 620, saida: 200 },
  { name: "Jun", entrada: 580, saida: 230 },
];

function FluxoFinanceiro() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight uppercase">Fluxo Financeiro & Fiscal</h2>
          <p className="text-muted-foreground mt-2">Gestão consolidada de dividendos, custos de ativos e obrigações fiscais.</p>
        </div>
        <div className="flex gap-3">
          <button className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Relatório
          </button>
          <button className="h-12 px-6 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Novo Registro
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <FinancialMetric 
           label="Patrimônio Líquido" 
           val="R$ 482.5M" 
           trend="+1.2%" 
           up 
           icon={Wallet} 
         />
         <FinancialMetric 
           label="Receita Operacional" 
           val="R$ 1.8M" 
           trend="+8.5%" 
           up 
           icon={ArrowUpRight} 
           color="text-emerald-500" 
         />
         <FinancialMetric 
           label="Custos de Manutenção" 
           val="R$ 420k" 
           trend="-2.1%" 
           icon={ArrowDownRight} 
           color="text-red-500" 
         />
         <FinancialMetric 
           label="Obrigações Fiscais (Venc.)" 
           val="R$ 125k" 
           icon={Calendar} 
           color="text-orange-500" 
         />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cashflow Chart */}
        <div className="lg:col-span-8 glass-card rounded-[2.5rem] p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-primary" />
              Entradas vs Saídas
            </h3>
            <div className="flex gap-2">
               <button className="px-3 py-1 bg-primary/10 text-primary border border-primary/10 rounded-lg text-[10px] font-bold uppercase tracking-widest">Mensal</button>
               <button className="px-3 py-1 hover:bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-all">Anual</button>
            </div>
          </div>
          
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData}>
                <defs>
                  <linearGradient id="entryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="exitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.03)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11, fontWeight: 700 }} 
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "oklch(0.1 0.015 250)", 
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: "20px",
                    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6)"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="entrada" 
                  stroke="var(--color-primary)" 
                  fillOpacity={1} 
                  fill="url(#entryGradient)" 
                  strokeWidth={4}
                />
                <Area 
                  type="monotone" 
                  dataKey="saida" 
                  stroke="#ef4444" 
                  fillOpacity={1} 
                  fill="url(#exitGradient)" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transactions Sidebar */}
        <div className="lg:col-span-4 glass-card rounded-[2.5rem] p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Lançamentos</h3>
            <Filter className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-primary transition-colors" />
          </div>
          <div className="space-y-4">
             <TransactionItem 
               title="Recebimento Aluguel" 
               target="Corporate SP" 
               val="+R$ 45.000" 
               type="in" 
               icon={Building2}
             />
             <TransactionItem 
               title="Dividendos Holding" 
               target="Alencar S.A." 
               val="+R$ 12.500" 
               type="in" 
               icon={Boxes}
             />
             <TransactionItem 
               title="Manutenção Rural" 
               target="Fazenda Santa Fé" 
               val="-R$ 8.200" 
               type="out" 
               icon={FileText}
             />
             <TransactionItem 
               title="Taxa Adm. Office" 
               target="Gestão Patrium" 
               val="-R$ 5.000" 
               type="out" 
               icon={CreditCard}
             />
             <TransactionItem 
               title="IPTU 2026 - Lote 04" 
               target="Urbano SP" 
               val="-R$ 2.400" 
               type="out" 
               icon={FileText}
             />
          </div>
          <button className="w-full py-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all">
            Ver Extrato Consolidado
          </button>
        </div>
      </div>
    </div>
  );
}

function FinancialMetric({ label, val, trend, up, icon: Icon, color = "text-foreground" }: { label: string; val: string; trend?: string; up?: boolean; icon: any; color?: string }) {
  return (
    <div className="glass-card p-6 rounded-[2rem] space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground border border-white/5">
           <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className={cn("px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1", up ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
            {trend}
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{label}</p>
        <p className={cn("text-xl font-black mt-1", color)}>{val}</p>
      </div>
    </div>
  );
}

function TransactionItem({ title, target, val, type, icon: Icon }: any) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer group">
       <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-all">
          <Icon className="h-5 w-5" />
       </div>
       <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{title}</p>
          <p className="text-[10px] text-muted-foreground font-medium truncate">{target}</p>
       </div>
       <p className={cn("text-xs font-black", type === 'in' ? 'text-emerald-500' : 'text-red-500')}>
          {val}
       </p>
    </div>
  );
}
