import { createFileRoute } from "@tanstack/react-router";
import { 
  GitBranch, 
  Layers, 
  History, 
  Cpu, 
  Zap, 
  Code2, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search, 
  Terminal,
  FileCode,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/desenvolvimento")({
  component: Desenvolvimento,
});

const sprintItems = [
  { id: "UP-442", title: "Integração IA Documental v2", status: "In Progress", priority: "high", dev: "Alex M.", progress: 65 },
  { id: "UP-441", title: "Otimização Queries PostgreSQL", status: "In Progress", priority: "medium", dev: "Sofia L.", progress: 40 },
  { id: "UP-440", title: "Refatoração Layout Suporte", status: "Done", priority: "low", dev: "Alex M.", progress: 100 },
  { id: "UP-439", title: "Correção bug cache Realtime", status: "To Do", priority: "critical", dev: "-", progress: 0 },
];

function Desenvolvimento() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Software House</h2>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">Sprint #24</span>
          </div>
          <p className="text-muted-foreground mt-2">
            Controle de engenharia, backlogs e automação de documentação.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-foreground rounded-2xl text-sm font-semibold hover:bg-white/10 transition-all">
            <Terminal className="h-4 w-4" />
            Console IA
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            Nova Task
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <DevStat icon={GitBranch} title="Active Branches" value="12" detail="4 merging" />
        <DevStat icon={Layers} title="Backlog Items" value="142" detail="+8 this week" />
        <DevStat icon={Clock} title="Cycle Time" value="4.2d" detail="-12% vs last month" />
        <DevStat icon={Zap} title="Deployment Frequency" value="14/wk" detail="Stable" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sprint Board (Simplified) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Active Sprint</h3>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Kaban View</button>
              <button className="text-xs px-3 py-1 rounded-lg bg-primary/10 text-primary border border-primary/10">List View</button>
            </div>
          </div>
          
          <div className="space-y-3">
            {sprintItems.map((item) => (
              <div key={item.id} className="glass-card p-4 rounded-2xl hover:border-primary/30 transition-all flex items-center gap-6 group">
                <div className="w-16">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{item.title}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1">Assignee: {item.dev}</p>
                </div>
                <div className="w-32 hidden md:block">
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
                <div className="w-24 text-right">
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase ${
                    item.status === "Done" ? "bg-emerald-500/10 text-emerald-500" :
                    item.status === "In Progress" ? "bg-blue-500/10 text-blue-500" : "bg-white/5 text-muted-foreground"
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Documentation / Releases */}
        <div className="space-y-8">
          <div className="glass-card rounded-3xl p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              Documentador IA
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Analisei 14 commits recentes. Deseja gerar o **Changelog Automático** e as **Release Notes** para os clientes?
            </p>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-medium hover:bg-white/10 transition-all">
                Gerar Tech Docs
                <ArrowRight className="h-4 w-4" />
              </button>
              <button className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs font-medium hover:bg-white/10 transition-all">
                Release Notes (Clientes)
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-8 space-y-6">
            <h3 className="text-lg font-semibold">Últimas Releases</h3>
            <div className="space-y-4">
              <ReleaseItem version="v2.4.0" date="Ontem" type="Stable" />
              <ReleaseItem version="v2.3.5" date="5 dias atrás" type="Hotfix" />
              <ReleaseItem version="v2.3.0" date="12 dias atrás" type="Stable" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DevStat({ icon: Icon, title, value, detail }: any) {
  return (
    <div className="glass-card p-6 rounded-3xl space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-bold">{value}</h4>
        <span className="text-[10px] text-emerald-500">{detail}</span>
      </div>
    </div>
  );
}

function ReleaseItem({ version, date, type }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <FileCode className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-bold">{version}</p>
          <p className="text-[10px] text-muted-foreground">{date}</p>
        </div>
      </div>
      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
        type === "Stable" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"
      }`}>
        {type}
      </span>
    </div>
  );
}
