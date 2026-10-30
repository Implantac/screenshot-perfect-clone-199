import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {

  Shield,
  Bell,
  Lock,
  User,
  Globe,
  HelpCircle,
  Loader2,
  Check,
  LogOut,
  AlertTriangle,
  Mail,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useUserSettings } from "@/lib/userSettings";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const TABS = [
  { id: "perfil", label: "Perfil Executivo", icon: User },
  { id: "seguranca", label: "Segurança & Acesso", icon: Shield },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "integracoes", label: "Integrações", icon: Globe },
  { id: "manual", label: "Manual da Plataforma", icon: HelpCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SettingsPage() {
  const [tab, setTab] = useState<TabId>("perfil");
  const { settings, loaded, patch } = useUserSettings();
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [draftName, setDraftName] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setUserId(data.user?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setDraftName(settings.displayName || "");
    setDraftTitle(settings.jobTitle || "");
  }, [loaded, settings.displayName, settings.jobTitle]);

  const saveProfile = () => {
    patch({ displayName: draftName.trim(), jobTitle: draftTitle.trim() });
    toast.success("Perfil salvo neste dispositivo.");
  };

  return (
    <div className="space-y-8 lg:space-y-10 animate-in fade-in duration-700 max-w-[1800px] mx-auto w-full">
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tight uppercase">Configurações</h2>
        <p className="text-muted-foreground text-sm lg:text-base">
          Perfil, segurança da conta e preferências da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8 pb-20 md:pb-0">
        <div className="lg:col-span-1 space-y-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all text-left",
                tab === entry.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-white/5 text-muted-foreground border border-white/5 hover:bg-white/10",
              )}
            >
              <entry.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{entry.label}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 glass-card rounded-[2rem] p-6 lg:p-10 space-y-8 min-h-[420px]">
          {tab === "perfil" && (
            <>
              <Section title="Informações do Perfil" icon={User}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldText label="Nome de exibição" value={draftName} onChange={setDraftName} placeholder="Como você quer ser chamado" />
                  <FieldText label="Cargo" value={draftTitle} onChange={setDraftTitle} placeholder="Gestor de Patrimônio" />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      E-mail da conta
                    </label>
                    <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> {email || "carregando…"}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 ml-1">
                      Definido no provedor de autenticação — não editável aqui.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                      ID do usuário
                    </label>
                    <div className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-[11px] font-mono text-muted-foreground truncate">
                      {userId || "carregando…"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <p className="text-[10px] text-muted-foreground/60 max-w-sm">
                    As preferências de perfil são salvas no seu navegador (<span className="font-mono">localStorage</span>).
                  </p>
                  <button
                    onClick={saveProfile}
                    className="h-11 px-6 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2"
                  >
                    <Check className="h-3.5 w-3.5" /> Salvar
                  </button>
                </div>
              </Section>
            </>
          )}

          {tab === "seguranca" && <SecurityTab twoFactorEnabled={settings.twoFactorEnabled} onToggle2FA={(v) => patch({ twoFactorEnabled: v })} email={email} />}

          {tab === "notificacoes" && (
            <Section title="Notificações" icon={Bell}>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Os interruptores são gravados localmente. O envio de e-mail ainda não está conectado —
                os alertas continuam visíveis em <span className="font-mono">JARVIS → Alertas</span>.
              </p>
              <div className="space-y-3">
                <Toggle
                  label="Alertas de risco crítico"
                  description="Riscos com severidade crítica e prazo estourando."
                  checked={settings.notifications.riskAlerts}
                  onChange={(v) => patch({ notifications: { ...settings.notifications, riskAlerts: v } })}
                />
                <Toggle
                  label="Vencimento de documentos"
                  description="Aviso 30 dias antes do vencimento de matrículas e licenças."
                  checked={settings.notifications.documentExpiry}
                  onChange={(v) => patch({ notifications: { ...settings.notifications, documentExpiry: v } })}
                />
                <Toggle
                  label="Resumo semanal do JARVIS"
                  description="Consolidado de AUM, riscos e pendências toda segunda-feira."
                  checked={settings.notifications.weeklyDigest}
                  onChange={(v) => patch({ notifications: { ...settings.notifications, weeklyDigest: v } })}
                />
              </div>
            </Section>
          )}

          {tab === "integracoes" && (
            <Section title="Integrações" icon={Globe}>
              <Integration
                name="Supabase"
                description="Banco, autenticação e RLS do seu tenant."
                status="Conectado"
                ok
              />
              <Integration
                name="OpenAI / Gemini (JARVIS)"
                description="Chave lida apenas no servidor (process.env). Sem chave, o JARVIS responde com o analista local."
                status="Configurável por variável de ambiente"
              />
              <Integration
                name="Envio de e-mail"
                description="Necessário para notificações e convites de sócios."
                status="Não configurado"
              />
            </Section>
          )}

          {tab === "manual" && (
            <Section title="Manual da Plataforma" icon={HelpCircle}>
              <div className="space-y-4 text-[12px] text-muted-foreground leading-relaxed">
                <ManualItem title="Holdings & Ativos">
                  Cadastre a entidade (holding) e depois os ativos vinculados. O patrimônio consolidado aparece no
                  dashboard e no grafo.
                </ManualItem>
                <ManualItem title="Riscos e documentos">
                  Todo risco tem severidade e prazo; documentos têm data de vencimento. Ambos alimentam a tela de
                  Alertas do JARVIS automaticamente.
                </ManualItem>
                <ManualItem title="Fornecedores e processos">
                  Homologue fornecedores com um clique e acompanhe a exposição do contencioso por vara e audiência.
                </ManualItem>
                <ManualItem title="Trilha de auditoria">
                  Cada criação, alteração e exclusão é gravada por trigger no banco — visível em JARVIS → Histórico.
                </ManualItem>
                <ManualItem title="JARVIS">
                  Perguntas em linguagem natural sobre os seus dados. As respostas citam números reais do tenant; se
                  nenhum provedor de LLM estiver configurado, ele responde no modo analista local.
                </ManualItem>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityTab({
  twoFactorEnabled,
  onToggle2FA,
  email,
}: {
  twoFactorEnabled: boolean;
  onToggle2FA: (value: boolean) => void;
  email: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha atualizada.");
  };

  const sendReset = async () => {
    if (!email) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetting(false);
    if (error) toast.error(error.message);
    else toast.success(`Link de redefinição enviado para ${email}.`);
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <>
      <Section title="Senha" icon={Lock}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Nova senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
              Confirmar senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={changePassword}
            disabled={saving}
            className="h-11 px-6 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
            Atualizar senha
          </button>
          <button
            onClick={sendReset}
            disabled={resetting || !email}
            className="h-11 px-5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Enviar link por e-mail
          </button>
        </div>
      </Section>

      <Section title="Autenticação de dois fatores" icon={Shield}>
        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">2FA (TOTP)</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md">
              O projeto Supabase atual não tem MFA/TOTP habilitado. O interruptor abaixo registra a intenção
              no navegador — <strong>não</strong> protege a conta até o provedor ser configurado.
            </p>
          </div>
          <button
            onClick={() => {
              onToggle2FA(!twoFactorEnabled);
              toast.info(
                twoFactorEnabled
                  ? "Preferência de 2FA desativada (local)."
                  : "Preferência de 2FA registrada (local — configure no Supabase para valer).",
              );
            }}
            className={cn(
              "h-10 px-5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0",
              twoFactorEnabled
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10",
            )}
          >
            {twoFactorEnabled ? "Marcado como ativo" : "Ativar"}
          </button>
        </div>
        <div className="p-4 rounded-2xl bg-orange-500/[0.06] border border-orange-500/20 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Para 2FA real: habilite MFA no painel Supabase (Authentication → Providers → MFA) e troque este
            interruptor pelo fluxo <span className="font-mono">supabase.auth.mfa.enroll()</span>.
          </p>
        </div>
      </Section>

      <Section title="Sessão" icon={LogOut}>
        <button
          onClick={signOut}
          className="h-11 px-6 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-500/20 transition-all flex items-center gap-2"
        >
          <LogOut className="h-3.5 w-3.5" /> Encerrar sessão
        </button>
      </Section>
    </>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "h-7 w-12 rounded-full border transition-all relative shrink-0",
          checked ? "bg-primary border-primary" : "bg-white/10 border-white/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            checked ? "left-6" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

function Integration({
  name,
  description,
  status,
  ok,
}: {
  name: string;
  description: string;
  status: string;
  ok?: boolean;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-lg">{description}</p>
      </div>
      <span
        className={cn(
          "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0",
          ok
            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            : "bg-white/5 text-muted-foreground border-white/10",
        )}
      >
        {status}
      </span>
    </div>
  );
}

function ManualItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
      <p className="text-xs font-black uppercase tracking-widest text-foreground mb-1.5">{title}</p>
      <p>{children}</p>
    </div>
  );
}
