import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";


import { 
  LayoutDashboard, 
  ShieldAlert, 
  Building2, 
  Users2, 
  ShieldCheck, 
  Boxes, 
  Handshake, 
  Settings, 
  User,
  Landmark,
  FileSearch,
  Sparkles,
  DollarSign,
  Scale,
  Map as MapIcon,
  PieChart,
  Network,
  LogOut
} from "lucide-react";

import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Inteligência",
    items: [
      { label: "Centro de Comando", icon: LayoutDashboard, to: "/" },
      { label: "Sala de Guerra IA", icon: Sparkles, to: "/inteligencia" },
      { label: "Central de Riscos", icon: ShieldAlert, to: "/riscos" },
      { label: "Saúde Documental", icon: FileSearch, to: "/saude-documental" },
    ]
  },
  {
    label: "Ativos",
    items: [
      { label: "Imóveis (U/R)", icon: Building2, to: "/imoveis" },
      { label: "Mapa Patrimonial", icon: MapIcon, to: "/mapa" },
      { label: "Holdings & Societário", icon: Boxes, to: "/holdings" },
      { label: "Family Office", icon: Users2, to: "/family-office" },
    ]
  },
  {
    label: "Governança",
    items: [
      { label: "Financeiro & Fiscal", icon: DollarSign, to: "/financeiro" },
      { label: "Assessoria Jurídica", icon: Scale, to: "/legal" },
      { label: "Compliance Score", icon: ShieldCheck, to: "/compliance" },
      { label: "Regularização", icon: Landmark, to: "/regularizacao" },
      { label: "Gestão de Fornecedores", icon: Handshake, to: "/fornecedores" },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };


  return (
    <div className="flex h-screen w-72 flex-col bg-sidebar border-r border-sidebar-border relative z-20 shadow-2xl">
      {/* Brand */}
      <div className="flex h-40 flex-col justify-center px-6 gap-4 group/logo cursor-pointer relative">
        <div className="relative w-20 h-20 [perspective:1200px] self-center">
          <motion.div
            animate={{ 
              rotateY: [0, 10, -10, 0],
              y: [0, -4, 0]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            style={{ transformStyle: "preserve-3d" }}
            className="w-full h-full relative"
          >
            <img 
              src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" 
              alt="Use Patrium" 
              className="w-full h-full object-contain filter drop-shadow-[0_8px_15px_rgba(0,0,0,0.3)] brightness-110 contrast-110"
            />
            {/* Subtle Reflection Layer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 mix-blend-overlay pointer-events-none rounded-full" />
          </motion.div>
          
          {/* Refined soft glow */}
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full -z-10 opacity-40 group-hover/logo:opacity-70 transition-opacity duration-1000" />
        </div>
        <h1 className="text-xl font-black tracking-[0.3em] text-center text-foreground leading-none uppercase font-sans bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/60 group-hover/logo:tracking-[0.4em] transition-all duration-1000 ease-out">
          USE PATRIUM
        </h1>
      </div>





      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h2 className="px-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/30">
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-3 rounded-2xl text-[13px] font-bold transition-all group border border-transparent",
                      isActive 
                        ? "bg-primary/5 text-primary border-primary/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]" 
                        : "text-muted-foreground/60 hover:bg-white/5 hover:text-foreground"
                    )}

                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User / Settings Footer */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/10"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-4 py-4 rounded-3xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-colors cursor-pointer">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 group-hover:scale-105 transition-transform">
            <User className="h-5 w-5 text-primary" />

          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">Gestor de Patrimônio</p>
            <p className="text-[10px] text-muted-foreground truncate">holding@usepatrium.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
