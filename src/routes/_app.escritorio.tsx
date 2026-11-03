import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createOffice,
  getOfficeWorkspace,
  grantOfficeAccess,
  inviteOfficeMember,
  revokeOfficeAccess,
  updateOfficeMember,
} from "@/lib/api/office.functions";

export const Route = createFileRoute("/_app/escritorio")({
  component: Escritorio,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number, digits = 1) => `${value.toFixed(digits).replace(".", ",")}%`;

const ROLE_LABEL: Record<string, string> = {
  socio: "Sócio",
  gestor: "Gestor",
  analista: "Analista",
  leitor: "Leitor",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  convidado: "Convidado",
  suspenso: "Suspenso",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

const CONCENTRATION_TONE: Record<string, string> = {
  baixa: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  moderada: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  alta: "text-orange-400 border-orange-500/20 bg-orange-500/10",
};

function Escritorio() {
  const queryClient = useQueryClient();
  const workspaceQuery = useQuery({
    queryKey: ["office-workspace"],
    queryFn: () => getOfficeWorkspace(),
    retry: false,
  });

  const [officeName, setOfficeName] = useState("");
  const [officeSlug, setOfficeSlug] = useState("");
  const [inviteOffice, setInviteOffice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"socio" | "gestor" | "analista" | "leitor">("analista");
  const [grantSlug, setGrantSlug] = useState("");
  const [grantLabel, setGrantLabel] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "erro"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["office-workspace"] });
  const fail = (error: unknown) => setFeedback({ tone: "erro", text: (error as Error).message });

  const createMutation = useMutation({
    mutationFn: () => createOffice({ data: { name: officeName, slug: officeSlug || undefined } }),
    onSuccess: (office) => {
      setOfficeName("");
      setOfficeSlug("");
      setFeedback({ tone: "ok", text: `Escritório "${office.name}" criado. Você entrou como sócio.` });
      refresh();
    },
    onError: fail,
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteOfficeMember({ data: { officeId: inviteOffice, email: inviteEmail, role: inviteRole } }),
    onSuccess: (member) => {
      setInviteEmail("");
      setFeedback({
        tone: "ok",
        text: `Convite registrado para ${member.email}. O vínculo é criado no primeiro acesso dessa pessoa.`,
      });
      refresh();
    },
    onError: fail,
  });

  const memberMutation = useMutation({
    mutationFn: (input: { memberId: string; role?: "socio" | "gestor" | "analista" | "leitor"; status?: "ativo" | "suspenso" }) =>
      updateOfficeMember({ data: input }),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const grantMutation = useMutation({
    mutationFn: () => grantOfficeAccess({ data: { officeSlug: grantSlug, label: grantLabel } }),
    onSuccess: (link) => {
      setGrantSlug("");
      setGrantLabel("");
      setFeedback({
        tone: "ok",
        text: `Acesso concedido a ${link.officeName}. Você aparece no consolidado como "${link.label}".`,
      });
      refresh();
    },
    onError: fail,
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => revokeOfficeAccess({ data: { grantId } }),
    onSuccess: () => {
      setFeedback({ tone: "ok", text: "Acesso revogado. O vínculo fica no histórico como encerrado." });
      refresh();
    },
    onError: fail,
  });

  const copySlug = async (slug: string | null) => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(slug);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setFeedback({ tone: "erro", text: "O navegador bloqueou a cópia. O identificador é: " + slug });
    }
  };

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo escritório…
      </div>
    );
  }

  const workspace = workspaceQuery.data;
  const adminOffices = (workspace?.offices ?? []).filter(
    (office) => office.role === "socio" || office.role === "gestor",
  );
  const migrationsPending = workspace && !workspace.available;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
          Multi-family office
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">Escritório</h1>
        <p className="max-w-3xl text-[11px] text-muted-foreground">
          Consolide várias famílias sem misturar patrimônios: cada família consente o acesso pelo
          identificador do escritório e aparece aqui apenas como <strong>agregado</strong> — ativo,
          dívida, patrimônio líquido, riscos e alertas. Nenhuma linha crua de cliente é exposta.
        </p>
      </header>

      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-2xl border px-4 py-3 text-[11px]",
            feedback.tone === "ok"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-orange-500/20 bg-orange-500/10 text-orange-400",
          )}
        >
          {feedback.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {migrationsPending && (
        <div className="glass-card rounded-[2rem] border border-amber-500/20 p-6">
          <h2 className="font-display text-lg font-black uppercase tracking-tight">
            Falta aplicar a migration do escritório
          </h2>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Rode <code className="rounded bg-white/10 px-1">supabase/APLICAR-TUDO.sql</code> (15 migrations) para
            criar <code className="rounded bg-white/10 px-1">offices</code>,{" "}
            <code className="rounded bg-white/10 px-1">office_members</code> e{" "}
            <code className="rounded bg-white/10 px-1">office_clients</code>. Nada aqui funciona antes disso — e
            nada quebra por causa disso.
          </p>
        </div>
      )}

      {workspace && workspace.claimedInvites > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-[11px] text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          {workspace.claimedInvites} convite(s) reivindicado(s) nesta sessão — você entrou na equipe do
          escritório.
        </div>
      )}

      {/* ------------------------------------------------ escritórios */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-card space-y-3 rounded-[2rem] border border-white/5 p-5">
          <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]">
            <Briefcase className="h-3.5 w-3.5 text-primary" /> Meus escritórios
          </h2>
          {(workspace?.offices ?? []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Você ainda não faz parte de nenhum escritório. Crie um ao lado (você entra como sócio) ou peça o
              convite a quem administra.
            </p>
          ) : (
            <div className="space-y-2">
              {workspace?.offices.map((office) => (
                <div
                  key={office.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <Building2 className="h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black">{office.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {office.members} na equipe · {office.families} família(s) vinculada(s)
                    </p>
                  </div>
                  {office.slug && (
                    <button
                      type="button"
                      onClick={() => copySlug(office.slug)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
                      title="Copiar identificador para enviar à família"
                    >
                      {copied === office.slug ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {office.slug}
                    </button>
                  )}
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-primary">
                    {ROLE_LABEL[office.role ?? ""] ?? office.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card space-y-3 rounded-[2rem] border border-white/5 p-5">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">Criar escritório</h2>
          <input
            value={officeName}
            onChange={(event) => setOfficeName(event.target.value)}
            placeholder="Nome do escritório"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] outline-none focus:border-primary/40"
          />
          <input
            value={officeSlug}
            onChange={(event) => setOfficeSlug(event.target.value)}
            placeholder="Identificador (opcional) — ex.: aurora"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] outline-none focus:border-primary/40"
          />
          <p className="text-[10px] text-muted-foreground">
            O identificador é o que a família digita para consentir o acesso. Sem ele, derivamos do nome.
          </p>
          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || officeName.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
            Criar
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ equipe */}
      {adminOffices.length > 0 && (
        <section className="glass-card space-y-4 rounded-[2rem] border border-white/5 p-5">
          <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]">
            <Users className="h-3.5 w-3.5 text-primary" /> Equipe
          </h2>

          <div className="grid gap-2 md:grid-cols-[1fr_1fr_140px_auto]">
            <select
              value={inviteOffice}
              onChange={(event) => setInviteOffice(event.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px]"
            >
              <option value="">Escritório…</option>
              {adminOffices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="e-mail da pessoa"
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] outline-none focus:border-primary/40"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}
              className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px]"
            >
              <option value="analista">Analista</option>
              <option value="gestor">Gestor</option>
              <option value="leitor">Leitor</option>
              <option value="socio">Sócio</option>
            </select>
            <button
              type="button"
              onClick={() => inviteMutation.mutate()}
              disabled={inviteMutation.isPending || !inviteOffice || !inviteEmail.includes("@")}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
            >
              {inviteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Convidar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                <tr>
                  <th className="py-2">Pessoa</th>
                  <th className="py-2">Papel</th>
                  <th className="py-2">Situação</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {workspace?.members.map((member) => (
                  <tr key={member.id}>
                    <td className="py-2">
                      <span className="font-mono text-[10px]">{member.email ?? "—"}</span>
                      {member.joined && (
                        <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-400">
                          ativo
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <select
                        value={member.role}
                        onChange={(event) =>
                          memberMutation.mutate({
                            memberId: member.id,
                            role: event.target.value as "socio" | "gestor" | "analista" | "leitor",
                          })
                        }
                        className="h-8 rounded-lg border border-white/10 bg-white/5 px-2 text-[11px]"
                      >
                        {Object.entries(ROLE_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {STATUS_LABEL[member.status] ?? member.status}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          memberMutation.mutate({
                            memberId: member.id,
                            status: member.status === "suspenso" ? "ativo" : "suspenso",
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                      >
                        {member.status === "suspenso" ? "Reativar" : "Suspender"}
                      </button>
                    </td>
                  </tr>
                ))}
                {(workspace?.members.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted-foreground">
                      Nenhum membro visível.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ consolidado */}
      {(workspace?.consolidations ?? []).map((office) => (
        <section key={office.officeId} className="glass-card space-y-4 rounded-[2rem] border border-white/5 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]">
                <Briefcase className="h-3.5 w-3.5 text-primary" /> Consolidado · {office.officeName}
              </h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {office.totals.activeFamilies} de {office.totals.families} família(s) ativa(s) · só agregados,
                nenhuma linha de cliente
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                CONCENTRATION_TONE[office.concentration.level],
              )}
            >
              Concentração {office.concentration.level} · HHI {office.concentration.hhi.toFixed(2)}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Patrimônio consolidado" value={brl(office.totals.assets)} />
            <Kpi label="Dívida" value={brl(office.totals.debt)} sub={`alavancagem ${pct(office.totals.leverage)}`} />
            <Kpi label="Patrimônio líquido" value={brl(office.totals.netWorth)} />
            <Kpi
              label="Maior família"
              value={office.concentration.topFamilyLabel ?? "—"}
              sub={`${pct(office.concentration.topFamilyShare)} do consolidado`}
            />
            <Kpi label="Riscos abertos" value={String(office.totals.risksOpen)} sub={`${office.totals.risksCritical} crítico(s)`} />
            <Kpi label="Documentos vencidos" value={String(office.totals.documentsOverdue)} />
            <Kpi label="Contencioso" value={brl(office.totals.legalExposure)} />
            <Kpi
              label="Frescor do dado"
              value={pct(office.quality.freshnessPct, 0)}
              sub={`${office.quality.familiesStale} desatualizada(s)`}
            />
          </div>

          {office.warnings.length > 0 && (
            <div className="space-y-1 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              {office.warnings.map((warning) => (
                <p key={warning} className="flex items-start gap-2 text-[10px] text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
                </p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
                <tr>
                  <th className="py-2">Família</th>
                  <th className="py-2 text-right">Ativo</th>
                  <th className="py-2 text-right">Dívida</th>
                  <th className="py-2 text-right">Patrimônio líquido</th>
                  <th className="py-2 text-right">Peso</th>
                  <th className="py-2 text-right">Riscos</th>
                  <th className="py-2 text-right">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {office.families.map((family) => (
                  <tr key={family.ownerUserId} className={cn(family.missingData && "opacity-60")}>
                    <td className="py-2">
                      <span className="font-bold">{family.label}</span>
                      <span className="ml-2 text-[9px] uppercase tracking-widest text-muted-foreground/60">
                        {STATUS_LABEL[family.status] ?? family.status}
                      </span>
                      {family.alerts.length > 0 && (
                        <span
                          className="ml-2 text-[9px] text-amber-400"
                          title={family.alerts.join(" · ")}
                        >
                          {family.alerts.length} alerta(s)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{brl(family.totalAssets)}</td>
                    <td className="py-2 text-right tabular-nums">{brl(family.debt)}</td>
                    <td className={cn("py-2 text-right tabular-nums", family.negativeNetWorth && "text-red-400")}>
                      {brl(family.netWorth)}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, family.shareOfAum)}%` }} />
                        </div>
                        <span className="tabular-nums text-muted-foreground">{pct(family.shareOfAum)}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {family.risksOpen}
                      {family.risksCritical > 0 && (
                        <span className="ml-1 text-red-400">({family.risksCritical} crít.)</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-[10px] text-muted-foreground">
                      {family.daysSinceUpdate === null ? "—" : `há ${family.daysSinceUpdate} d`}
                    </td>
                  </tr>
                ))}
                {office.families.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-3 text-muted-foreground">
                      Nenhuma família vinculada a este escritório ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {office.alerts.length > 0 && (
            <div className="grid gap-1.5 md:grid-cols-2">
              {office.alerts.slice(0, 8).map((alert, index) => (
                <p
                  key={`${alert.ownerUserId}-${index}`}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-[10px]",
                    alert.severity === "critical"
                      ? "border-red-500/20 bg-red-500/5 text-red-400"
                      : alert.severity === "warning"
                        ? "border-amber-500/20 bg-amber-500/5 text-amber-400"
                        : "border-white/10 bg-white/[0.02] text-muted-foreground",
                  )}
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    <strong>{alert.label}</strong> — {alert.message}
                  </span>
                </p>
              ))}
            </div>
          )}
        </section>
      ))}

      {/* ------------------------------------------------ meu vínculo */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card space-y-3 rounded-[2rem] border border-white/5 p-5">
          <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em]">
            <Link2 className="h-3.5 w-3.5 text-primary" /> Conceder acesso ao meu patrimônio
          </h2>
          <p className="text-[10px] text-muted-foreground">
            Você continua dono dos dados: o escritório vê <strong>agregados</strong> do seu consolidado, não
            seus ativos, documentos ou processos. Pode revogar quando quiser.
          </p>
          <input
            value={grantSlug}
            onChange={(event) => setGrantSlug(event.target.value)}
            placeholder="Identificador do escritório (ex.: aurora)"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] outline-none focus:border-primary/40"
          />
          <input
            value={grantLabel}
            onChange={(event) => setGrantLabel(event.target.value)}
            placeholder="Como você quer aparecer no consolidado"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={() => grantMutation.mutate()}
            disabled={grantMutation.isPending || !grantSlug.trim() || grantLabel.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >
            {grantMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            Conceder acesso
          </button>
        </div>

        <div className="glass-card space-y-3 rounded-[2rem] border border-white/5 p-5">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">Acessos que eu concedi</h2>
          {(workspace?.myGrants.length ?? 0) === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nenhum escritório tem acesso ao seu consolidado. O consentimento é sempre seu — nenhum escritório
              consegue se vincular sozinho.
            </p>
          ) : (
            <div className="space-y-2">
              {workspace?.myGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-black">{grant.officeName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      como “{grant.label}” · {STATUS_LABEL[grant.status] ?? grant.status}
                    </p>
                  </div>
                  {grant.status !== "encerrado" && (
                    <button
                      type="button"
                      onClick={() => revokeMutation.mutate(grant.id)}
                      disabled={revokeMutation.isPending}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-400 disabled:opacity-40"
                    >
                      Revogar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
      <p className="mt-1 truncate text-sm font-black tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
