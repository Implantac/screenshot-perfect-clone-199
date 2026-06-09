import { Link, useLocation } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Building2, 
  Users2, 
  ShieldCheck, 
  Boxes, 
  Handshake, 
  Search, 
  Settings, 
  User,
  Landmark,
  FileSearch,
  Sparkles,
  DollarSign,
  Scale,
  Map as MapIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navGroups = [
  {
    label: "Inteligência",
    items: [
      { label: "Painel Executivo", icon: LayoutDashboard, to: "/" },
      { label: "Sala de Guerra IA", icon: Sparkles, to: "/inteligencia" },
      { label: "Central de Riscos", icon: ShieldAlert, to: "/riscos" },
      { label: "Saúde Documental", icon: FileSearch, to: "/saude-documental" },
    ]
  },
  {
    label: "Ativos",
    items: [
      { label: "Imóveis (Urbano/Rural)", icon: Building2, to: "/imoveis" },
      { label: "Cartografia Global", icon: MapIcon, to: "/mapa" },
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

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border relative z-20">
      {/* Brand */}
      <div className="flex h-20 items-center px-6 gap-3">
        <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="text-primary-foreground h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground leading-none">USE PATRIUM</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5 font-semibold">Cérebro Patrimonial</p>
        </div>
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                      isActive 
                        ? "bg-primary/10 text-primary border border-primary/10" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
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
      <div className="p-4 border-t border-sidebar-border space-y-3">
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
        <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/5 border border-white/5">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border border-primary/20">
            <User className="h-4 w-4 text-primary" />
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
