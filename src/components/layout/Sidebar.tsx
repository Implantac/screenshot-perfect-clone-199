import { Link, useLocation } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Building2, 
  Users2, 
  FileText, 
  ShieldCheck, 
  Boxes, 
  Wrench, 
  MessageSquare, 
  Code2, 
  ClipboardCheck,
  Search,
  Settings,
  Bell,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navGroups = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/" },
      { label: "Central de Riscos", icon: ShieldAlert, to: "/riscos" },
    ]
  },
  {
    label: "Sectores",
    items: [
      { label: "Implantação", icon: Wrench, to: "/implantacao" },
      { label: "Suporte", icon: MessageSquare, to: "/suporte" },
      { label: "Desenvolvimento", icon: Code2, to: "/desenvolvimento" },
      { label: "Q.A", icon: ClipboardCheck, to: "/qa" },
    ]
  },
  {
    label: "Governança",
    items: [
      { label: "Imóveis", icon: Building2, to: "/imoveis" },
      { label: "Holdings", icon: Boxes, to: "/holdings" },
      { label: "Family Office", icon: Users2, to: "/family-office" },
      { label: "Compliance", icon: ShieldCheck, to: "/compliance" },
    ]
  }
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border relative z-20">
      {/* Brand */}
      <div className="flex h-20 items-center px-6 gap-3">
        <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
          <ShieldCheck className="text-primary-foreground h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground leading-none">USE PATRIUM</h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Governança Premium</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 scrollbar-none">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
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
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                      isActive 
                        ? "bg-primary/10 text-primary" 
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
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
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
        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/5 mt-4">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold truncate">Diretor Executivo</p>
            <p className="text-[10px] text-muted-foreground truncate">admin@usepatrium.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
