import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { IsolationPanel } from "@/components/security/IsolationPanel";
import { getSecurityState, updateSecurityPolicy } from "@/lib/api/security.functions";
import {
  POLICY_LABELS,
  assessMfa,
  evaluatePassword,
  evaluatePosture,
  type SecurityPolicy,
} from "@/lib/security/policy";

export const Route = createFileRoute("/_app/seguranca")({
  component: Seguranca,
});

function Seguranca() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["security_state"],
    queryFn: () => getSecurityState(),
  });

  const [enrollment, setEnrollment] = useState<{ factorId: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const policy = data?.policy;
  const mfa = useMemo(
    () =>
      assessMfa({
        verifiedFactors: data?.verifiedFactors ?? 0,
        policy,
        scope: "admin",
        aal: data?.aal ?? "aal1",
      }),
    [data],
  );
  const posture = useMemo(
    () => (policy ? evaluatePosture({ policy, myMfa: mfa }) : null),
    [policy, mfa],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["security_state"] });

  const startEnrollment = async () => {
    setBusy(true);
    try {
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setEnrollment({
        factorId: enrolled.id,
        secret: enrolled.totp.secret,
        uri: enrolled.totp.uri,
      });
    } catch (error) {
      toast.error("Não foi possível iniciar o cadastro do autenticador", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmEnrollment = async () => {
    if (!enrollment) return;
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.factorId,
      });
      if (challengeError) throw challengeError;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("Segundo fator ativado");
      setEnrollment(null);
      setCode("");
      refresh();
    } catch (error) {
      toast.error("Código inválido ou expirado", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const removeFactors = async () => {
    setBusy(true);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const factor of list?.totp ?? []) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      toast.success("Segundo fator removido");
      refresh();
    } catch (error) {
      toast.error("Não foi possível remover o fator", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Governança de acesso
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Segurança de acesso</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Senha, segundo fator e expiração de sessão em uma régua só — aplicada no app{" "}
            <strong>e no banco</strong>. A partir desta wave, exigir MFA no convite deixa de ser uma
            promessa: o RLS recusa escrita sem sessão verificada.
          </p>
        </div>
        {posture ? (
          <div className="glass-card flex items-center gap-4 rounded-2xl border border-white/5 px-5 py-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                Nota de postura
              </p>
              <p className="text-2xl font-black tabular-nums">
                {posture.score}
                <span className="ml-1 text-sm text-muted-foreground">/100</span>
              </p>
            </div>
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black",
                posture.grade === "A"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : posture.grade === "B"
                    ? "bg-primary/15 text-primary"
                    : posture.grade === "C"
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400",
              )}
            >
              {posture.grade}
            </span>
          </div>
        ) : null}
      </header>

      {data?.migrationPending ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Migration <code>{data.migrationPending}</code> não aplicada: a política está em uso no app,
          mas o banco ainda não tem a trava. Rode <code>supabase/APLICAR-TUDO.sql</code>.
        </div>
      ) : null}

      <IsolationPanel />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* -------------------------------------------------- segundo fator */}
        <section className="glass-card rounded-[2rem] border border-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
              <Smartphone className="h-3.5 w-3.5 text-primary" /> Segundo fator (TOTP)
            </h2>
            <span
              className={cn(
                "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                mfa.status === "ativo"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : mfa.status === "pendente"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400",
              )}
            >
              {mfa.status}
            </span>
          </div>

          <p className="mb-3 text-[11px] text-muted-foreground">{mfa.nextStep}</p>

          {!enrollment ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
                <span className="text-muted-foreground">Fatores verificados</span>
                <span className="font-bold tabular-nums">{mfa.verifiedFactors}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
                <span className="text-muted-foreground">Nível da sessão</span>
                <span className={cn("font-bold uppercase", mfa.elevated ? "text-emerald-400" : "text-amber-400")}>
                  {data?.aal ?? "aal1"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={startEnrollment}
                  disabled={busy}
                  className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {mfa.verifiedFactors > 0 ? "Adicionar outro fator" : "Ativar segundo fator"}
                </button>
                {mfa.verifiedFactors > 0 ? (
                  <button
                    onClick={removeFactors}
                    disabled={busy}
                    className="flex h-10 items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/20 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Remover
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Chave para o autenticador (digitação manual)
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className="break-all font-mono text-[11px] tracking-wider">{enrollment.secret}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(enrollment.secret);
                      toast.success("Chave copiada");
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Código de 6 dígitos do app
                </span>
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-lg tracking-[0.4em]"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={confirmEnrollment}
                  disabled={busy || code.length !== 6}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Confirmar
                </button>
                <button
                  onClick={() => {
                    setEnrollment(null);
                    setCode("");
                  }}
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-muted-foreground/60">
                O PATRIUM não gera QR code: a chave acima é o mesmo segredo que o QR carrega. Cole em
                Google Authenticator, 1Password, Authy ou Bitwarden (opção "inserir chave manualmente").
              </p>
            </div>
          )}
        </section>

        {/* -------------------------------------------------- postura */}
        <section className="glass-card rounded-[2rem] border border-white/5 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> O que trava a nota
          </h2>
          {posture && posture.findings.length === 0 ? (
            <p className="flex items-center gap-2 text-[11px] text-emerald-400">
              <Check className="h-3.5 w-3.5" /> Nenhum achado: política aplicada e sessão verificada.
            </p>
          ) : (
            <div className="space-y-2">
              {(posture?.findings ?? []).map((finding) => (
                <div key={finding.id} className="flex items-start gap-2 text-[11px]">
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                      finding.severity === "alta"
                        ? "bg-red-500"
                        : finding.severity === "media"
                          ? "bg-amber-500"
                          : "bg-white/30",
                    )}
                  />
                  <span>
                    <strong className="mr-1 text-[9px] uppercase tracking-widest">{finding.severity}</strong>
                    <span className="text-muted-foreground">{finding.text}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
            {(posture?.breakdown ?? []).map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="tabular-nums">
                    {item.points}/{item.max}
                  </span>
                </div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(item.points / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {policy ? <PolicyPanel policy={policy} canEdit={Boolean(data?.isAdmin)} onSaved={refresh} /> : null}

      <PasswordLab policy={policy} />

      <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/60">
        Limite declarado: o Supabase Auth em projeto gerenciado não aceita política de senha
        customizada no servidor. A régua abaixo é aplicada no app antes de{" "}
        <code>signUp</code> / <code>updateUser</code> — e o banco garante o piso de 6 caracteres. O que
        o banco garante sozinho é o que importa mais: <strong>sessão sem segundo fator não escreve
        convite de acesso</strong>.
      </p>
    </div>
  );
}

function PolicyPanel({
  policy,
  canEdit,
  onSaved,
}: {
  policy: SecurityPolicy;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<SecurityPolicy>(policy);
  useEffect(() => setDraft(policy), [policy]);

  const save = useMutation({
    mutationFn: (next: SecurityPolicy) =>
      updateSecurityPolicy({
        data: {
          mfa_required_admin: next.mfa_required_admin,
          mfa_required_portal: next.mfa_required_portal,
          min_password_length: next.min_password_length,
          require_mixed_case: next.require_mixed_case,
          require_number: next.require_number,
          require_symbol: next.require_symbol,
          block_common_passwords: next.block_common_passwords,
          password_history: next.password_history,
          session_timeout_minutes: next.session_timeout_minutes,
          max_failed_attempts: next.max_failed_attempts,
          mfa_grace_days: next.mfa_grace_days,
        },
      }),
    onSuccess: () => {
      toast.success("Política atualizada");
      onSaved();
    },
    onError: (error: Error) => toast.error("Não foi possível salvar", { description: error.message }),
  });

  const toggles: (keyof SecurityPolicy)[] = [
    "mfa_required_admin",
    "mfa_required_portal",
    "require_mixed_case",
    "require_number",
    "require_symbol",
    "block_common_passwords",
  ];
  const numbers: (keyof SecurityPolicy)[] = [
    "min_password_length",
    "password_history",
    "session_timeout_minutes",
    "max_failed_attempts",
    "mfa_grace_days",
  ];

  return (
    <section className="glass-card rounded-[2rem] border border-white/5 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <Lock className="h-3.5 w-3.5 text-primary" /> Política do tenant
        </h2>
        {!canEdit ? (
          <span className="text-[10px] text-muted-foreground/60">somente leitura — precisa de admin</span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          {toggles.map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 text-[11px]">
              <span>{POLICY_LABELS[key]}</span>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={Boolean(draft[key])}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                className="h-3.5 w-3.5 accent-[oklch(0.72_0.14_155)]"
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {numbers.map((key) => (
            <label key={key} className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                {POLICY_LABELS[key]}
              </span>
              <input
                type="number"
                disabled={!canEdit}
                value={Number(draft[key])}
                onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] tabular-nums"
              />
            </label>
          ))}
        </div>
      </div>

      {canEdit ? (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => save.mutate(draft)}
            disabled={save.isPending}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar política
          </button>
        </div>
      ) : null}
    </section>
  );
}

function PasswordLab({ policy }: { policy?: SecurityPolicy }) {
  const [password, setPassword] = useState("");
  const evaluation = useMemo(
    () => (policy ? evaluatePassword(password, policy) : null),
    [password, policy],
  );

  return (
    <section className="glass-card rounded-[2rem] border border-white/5 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
        <KeyRound className="h-3.5 w-3.5 text-primary" /> Teste da régua de senha
      </h2>
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Digite uma senha para ver a avaliação (nada é enviado)"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px]"
      />
      {evaluation && password ? (
        <div className="mt-3 space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                evaluation.score >= 70 ? "bg-emerald-500" : evaluation.score >= 40 ? "bg-amber-500" : "bg-red-500",
              )}
              style={{ width: `${evaluation.score}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            nota {evaluation.score}/100 · ~{evaluation.entropyBits} bits de entropia ·{" "}
            {evaluation.ok ? "aceita pela política" : "recusada"}
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {evaluation.passed.map((item) => (
              <p key={item} className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <Check className="h-3 w-3" /> {item}
              </p>
            ))}
            {evaluation.issues.map((issue) => (
              <p key={issue.code} className="flex items-center gap-1.5 text-[10px] text-red-400">
                <X className="h-3 w-3" /> {issue.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
