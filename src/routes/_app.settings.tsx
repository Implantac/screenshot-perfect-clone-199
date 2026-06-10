import { createFileRoute } from "@tanstack/react-router";
import { Settings, Shield, Bell, Lock, User, Palette, Globe, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-10 animate-in fade-in duration-700 overflow-x-hidden max-w-[1800px] mx-auto w-full">
      <div className="space-y-1">
        <h2 className="text-3xl font-black tracking-tight uppercase">Configurações</h2>
        <p className="text-muted-foreground text-lg">Gerencie suas preferências e segurança da plataforma.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 pb-20 md:pb-0">
        <div className="lg:col-span-1 space-y-2">
          <SettingsTab icon={User} label="Perfil Executivo" active />
          <SettingsTab icon={Shield} label="Segurança & Acesso" />
          <SettingsTab icon={Bell} label="Notificações" />
          <SettingsTab icon={Palette} label="Personalização" />
          <SettingsTab icon={Globe} label="Integrações" />
          <SettingsTab icon={HelpCircle} label="Manual da Plataforma" />
        </div>

        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-10 space-y-10">
          <section className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações do Perfil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nome Completo</label>
                <input type="text" defaultValue="Gestor de Patrimônio" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-primary/50 focus:border-primary/50" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">E-mail Corporativo</label>
                <input type="email" defaultValue="holding@usepatrium.com" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-primary/50 focus:border-primary/50" />
              </div>
            </div>
          </section>

          <section className="space-y-6 pt-10 border-t border-white/5">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Segurança da Conta
            </h3>
            <div className="flex items-center justify-between p-6 rounded-3xl bg-white/5 border border-white/5">
              <div>
                <p className="font-bold">Autenticação de Dois Fatores (2FA)</p>
                <p className="text-xs text-muted-foreground mt-1">Adicione uma camada extra de segurança à sua conta.</p>
              </div>
              <button className="px-6 py-2 bg-primary/10 text-primary border border-primary/10 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                Ativar
              </button>
            </div>
          </section>

          <div className="flex justify-end gap-4 pt-6">
             <button className="px-8 py-4 bg-white/5 text-foreground rounded-2xl font-bold text-sm hover:bg-white/10 transition-all">Descartar</button>
             <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-all">Salvar Alterações</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all",
      active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
    )}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
