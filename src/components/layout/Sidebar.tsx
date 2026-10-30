import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import {
  Boxes,
  Building2,
  CalendarClock,
  Cpu,
  DollarSign,
  FileSearch,
  FileText,
  Handshake,
  Landmark,
  Landmark as SuccessionIcon,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Scale,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  Users2,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Inteligência",
    items: [
      { label: "Centro de Comando", icon: LayoutDashboard, to: "/dashboard" },
      { label: "Jarvis (Diretor Digital)", icon: Sparkles, to: "/jarvis" },
      { label: "Central de Riscos", icon: ShieldAlert, to: "/riscos" },
      { label: "Saúde Documental", icon: FileSearch, to: "/saude-documental" },
      { label: "Sala de Guerra IA", icon: Cpu, to: "/inteligencia" },
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
    label: "Investimentos",
    items: [
      { label: "Custódia & Performance", icon: Wallet, to: "/custodia" },
      { label: "Importar extrato", icon: UploadCloud, to: "/importar" },
      { label: "Projeção de caixa", icon: CalendarClock, to: "/projecao" },
      { label: "Capital calls & privados", icon: Building2, to: "/privados" },
      { label: "Sucessão & Tributação", icon: SuccessionIcon, to: "/sucessorio" },
      { label: "Relatórios", icon: FileText, to: "/relatorios" },
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
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserEmail(data.user?.email ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border relative z-20 shadow-2xl overflow-hidden">
      {/* Brand */}
      <div className="flex flex-col justify-center px-6 py-10 lg:h-52 gap-6 group/logo cursor-pointer relative shrink-0">
        <div className="relative w-24 h-24 lg:w-28 lg:h-28 self-center">
          <motion.div
            animate={{ 
              rotateY: [0, 360]
            }}
            transition={{ 
              duration: 8, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{ 
              transformStyle: "preserve-3d",
              perspective: "1200px"
            }}
            className="w-full h-full relative flex items-center justify-center"
          >
            {[...Array(8)].map((_, i) => (
              <img 
                key={i}
                src="https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" 
                alt="" 
                className="absolute inset-0 w-full h-full object-contain"
                style={{ 
                  transform: `translateZ(${i - 4}px)`,
                  filter: i === 7 ? 'brightness(1.1) drop-shadow(0 0 10px rgba(var(--primary),0.2))' : 'brightness(0.7)',
                  opacity: i === 0 || i === 7 ? 1 : 0.8
                }}
              />
            ))}
          </motion.div>
          <div className="absolute inset-4 bg-primary/5 blur-[50px] rounded-full -z-10 opacity-60 group-hover/logo:opacity-100 transition-opacity duration-1000" />
        </div>
        <div className="relative group/text perspective-1000 flex flex-col items-center">
          <motion.h1 
            animate={{ 
              rotateY: [-3, 3, -3],
              filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="text-[10px] lg:text-[11px] font-black tracking-[0.15em] text-center uppercase font-sans bg-clip-text text-transparent bg-gradient-to-b from-[#f3d38c] via-[#c4924c] to-[#7a531e] drop-shadow-[0_2px_10px_rgba(196,146,76,0.2)] flex flex-col leading-[1.3]"
          >
            <span>USE</span>
            <span>PATRIUM</span>
          </motion.h1>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h2 className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/30">
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
                      "flex items-center gap-3 px-3.5 py-3 rounded-xl lg:rounded-2xl text-[13px] font-bold transition-all group border border-transparent",
                      isActive 
                        ? "bg-primary/5 text-primary border-primary/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)]" 
                        : "text-muted-foreground/60 hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 transition-colors shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] shrink-0"
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
      <div className="p-4 border-t border-sidebar-border space-y-2 shrink-0">
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="flex-1 flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Configurações</span>
          </Link>
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all border border-transparent hover:border-red-500/10"
            title="Sair"
          >
            <LogOut className="h-4 w-4 shrink-0" />
          </button>
        </div>

        <div className="flex items-center gap-4 px-4 py-4 rounded-3xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-colors cursor-pointer min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20 group-hover:scale-105 transition-transform shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold truncate">{userEmail ? "Gestor de Patrimônio" : "Sessão ativa"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userEmail ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
