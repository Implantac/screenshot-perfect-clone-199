import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Sparkles, 
  ShieldAlert, 
  ClipboardList, 
  MessageSquare, 
  History,
  Activity,
  Network
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis")({
  component: JarvisLayout,
});

const jarvisMenu = [
  { label: "Central de Inteligência", icon: Activity, to: "/jarvis" },
  { label: "Insights", icon: Sparkles, to: "/jarvis/insights" },
  { label: "Rede (Grafo)", icon: Network, to: "/jarvis/grafo" },
  { label: "Alertas", icon: ShieldAlert, to: "/jarvis/alertas" },
  { label: "Plano de Ação", icon: ClipboardList, to: "/jarvis/acoes" },
  { label: "Conversar com Jarvis", icon: MessageSquare, to: "/jarvis/chat" },
  { label: "Histórico", icon: History, to: "/jarvis/historico" },
];

function JarvisLayout() {
  return (
    <div className="space-y-12 max-w-[1600px] mx-auto pb-24 overflow-x-hidden relative">
      <div className="fixed inset-0 noise-overlay opacity-[0.015] pointer-events-none" />
      
      {/* Jarvis Hero Header */}
      <div className="relative overflow-hidden rounded-[4rem] bg-black/40 border border-white/[0.05] p-16 shadow-2xl executive-grid">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent opacity-50" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] -z-10 translate-x-1/2 -translate-y-1/2 animate-pulse" />
        
        <div className="flex flex-col md:flex-row items-center gap-14 relative z-10">
          <div className="relative group">
            <motion.div
              animate={{ 
                scale: [1, 1.08, 1],
                rotate: [0, 8, -8, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="h-32 w-32 rounded-[2.5rem] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_60px_rgba(var(--primary),0.25)] backdrop-blur-3xl group-hover:scale-110 transition-transform duration-700"
            >
              <Sparkles className="h-14 w-14 text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.6)]" />
            </motion.div>
            <div className="absolute -inset-8 bg-primary/10 blur-[40px] rounded-full -z-10 animate-pulse" />
          </div>
          
          <div className="space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-[0.4em] text-primary">
              <Activity className="h-3 w-3" />
              Intelligence Protocol Active
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic uppercase text-foreground leading-none">
              JARVIS <span className="text-primary drop-shadow-[0_0_30px_rgba(212,163,85,0.2)]">CORE</span>
            </h1>
            <p className="text-muted-foreground text-xl font-medium max-w-2xl italic leading-relaxed opacity-80">
              O primeiro Diretor Patrimonial Digital operando em infraestrutura neural. Monitoramento autônomo, conformidade e governança estratégica.
            </p>
          </div>
        </div>

        {/* Jarvis Sub-Navigation */}
        <div className="mt-12 flex flex-wrap gap-3">
          {jarvisMenu.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              activeProps={{ className: "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" }}
              inactiveProps={{ className: "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground" }}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-full text-xs font-black uppercase tracking-[0.15em] border transition-all duration-300"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Outlet />
      </div>
    </div>
  );
}
