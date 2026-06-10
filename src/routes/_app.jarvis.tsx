import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Sparkles, 
  ShieldAlert, 
  ClipboardList, 
  MessageSquare, 
  History,
  Activity
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/jarvis")({
  component: JarvisLayout,
});

const jarvisMenu = [
  { label: "Central de Inteligência", icon: Activity, to: "/jarvis" },
  { label: "Insights", icon: Sparkles, to: "/jarvis/insights" },
  { label: "Alertas", icon: ShieldAlert, to: "/jarvis/alertas" },
  { label: "Plano de Ação", icon: ClipboardList, to: "/jarvis/acoes" },
  { label: "Conversar com Jarvis", icon: MessageSquare, to: "/jarvis/chat" },
  { label: "Histórico", icon: History, to: "/jarvis/historico" },
];

function JarvisLayout() {
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
      {/* Jarvis Hero Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-white/5 p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2 animate-pulse" />
        
        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
          <div className="relative">
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 6, repeat: Infinity }}
              className="h-24 w-24 rounded-3xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_50px_rgba(var(--primary),0.2)]"
            >
              <Sparkles className="h-12 w-12 text-primary" />
            </motion.div>
            <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full -z-10" />
          </div>
          
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase text-foreground">
              JARVIS <span className="text-primary">PATRIUM</span>
            </h1>
            <p className="text-muted-foreground text-lg font-medium max-w-xl">
              Diretor Patrimonial Digital em operação. Monitorando ativos, riscos e governança proativamente.
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
