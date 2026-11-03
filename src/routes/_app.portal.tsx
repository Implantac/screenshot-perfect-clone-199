import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  Loader2,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isMissingTableError, useEntities, usePortalGrants } from "@/hooks/usePatrimonio";
import {
  useCreatePortalGrant,
  useDeletePortalGrant,
  useUpdatePortalGrant,
} from "@/hooks/useCrud";
import {
  PORTAL_SECTIONS,
  ROLE_LABELS,
  ROLE_PRESETS,
  redactAmount,
  redactPercent,
  resolvePortalAccess,
  summarizeGrants,
  type PortalGrant,
  type PortalRole,
  type PortalVisibility,
} from "@/lib/portal/access";

export const Route = createFileRoute("/_app/portal")({
  component: Portal,
});

const dateBr = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

const STATUS_STYLE: Record<string, string> = {
  ativo: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  convite_pendente: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  suspenso: "border-white/15 bg-white/5 text-muted-foreground",
  revogado: "border-red-500/30 bg-red-500/10 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  convite_pendente: "Convite pendente",
  suspenso: "Suspenso",
  revogado: "Revogado",
};

/** Valores de exemplo para a prévia — o mesmo recorte do relatório mensal. */
const SAMPLE = {
  netWorth: 63_386_946,
  monthReturnPct: 3.4269,
  ytdReturnPct: 4.3105,
  debt: 6_400_000,
  monthlyService: 110_066,
  contributions: [
    { label: "Renda fixa", value: 3.05 },
    { label: "Renda variável", value: 1.01 },
    { label: "Fundos", value: -0.73 },
  ],
};

function Portal() {
  const { data: grants, error } = usePortalGrants();
  const { data: entities } = useEntities();
  const createGrant = useCreatePortalGrant();
  const updateGrant = useUpdatePortalGrant();
  const deleteGrant = useDeletePortalGrant();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PortalGrant | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const rows = (grants ?? []) as PortalGrant[];
  const summary = useMemo(() => summarizeGrants(rows), [rows]);
  const preview = useMemo(() => {
    const grant = rows.find((row) => row.id === previewId) ?? rows[0];
    if (!grant) return null;
    return { grant, access: resolvePortalAccess(grant) };
  }, [rows, previewId]);

  const loading = !grants && !error;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Governança de acesso
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">Portal do cliente</h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Quem lê o patrimônio da família quase nunca deve ver tudo. Cada pessoa recebe{" "}
            <strong>seções explícitas</strong>, um <strong>grão de valor</strong> e um{" "}
            <strong>prazo</strong> — e você vê exatamente o que ela vê antes de convidar.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90"
        >
          <UserPlus className="h-3.5 w-3.5" /> Conceder acesso
        </button>
      </header>

      {error && !isMissingTableError(error) ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[11px] text-red-400">
          <AlertTriangle className="h-4 w-4" /> {String((error as Error).message)}
        </div>
      ) : null}

      {isMissingTableError(error) ? (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Migration <code>20261030210000_portal_access.sql</code> não aplicada neste projeto — rode{" "}
          <code>supabase/APLICAR-TUDO.sql</code>.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Acessos ativos", value: String(summary.active), hint: `${summary.grants} concedidos`, icon: Users },
          { label: "Convites pendentes", value: String(summary.pending), hint: "aguardando primeiro login", icon: Mail },
          { label: "Vencem em 30 dias", value: String(summary.expiringSoon), hint: "renovar ou revogar", icon: Lock },
          { label: "Sem segundo fator", value: String(summary.withoutMfa), hint: "acesso de terceiro", icon: ShieldCheck },
        ].map((card) => (
          <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              <card.icon className="h-3 w-3" /> {card.label}
            </div>
            <p className="mt-2 text-xl font-black tabular-nums">{card.value}</p>
            <p className="text-[10px] text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </div>

      {summary.warnings.length > 0 ? (
        <div className="space-y-2">
          {summary.warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {warning}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
          <div className="flex items-center justify-between border-b border-white/5 p-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest">Quem tem acesso</h2>
            <span className="text-[10px] text-muted-foreground">negar por padrão · conceder por seção</span>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center">
              <Users className="mx-auto mb-3 h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm font-bold">Nenhum acesso concedido</p>
              <p className="mx-auto mt-1 max-w-md text-[11px] text-muted-foreground">
                O portal está fechado: ninguém além de você lê este patrimônio. Comece pelo titular e
                depois conceda o recorte de cada pessoa.
              </p>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-[oklch(0.13_0.02_250)]">
                  <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    <th className="px-4 py-2">Pessoa</th>
                    <th className="px-4 py-2">Papel</th>
                    <th className="px-4 py-2">Seções</th>
                    <th className="px-4 py-2">Valor</th>
                    <th className="px-4 py-2">Situação</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((grant) => {
                    const access = resolvePortalAccess(grant);
                    return (
                      <tr
                        key={grant.id}
                        className={cn(
                          "hover:bg-white/[0.02]",
                          preview?.grant.id === grant.id && "bg-primary/[0.06]",
                        )}
                      >
                        <td className="px-4 py-2">
                          <p className="text-[11px] font-bold">{grant.full_name}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/60">{grant.email}</p>
                        </td>
                        <td className="px-4 py-2 text-[10px] text-muted-foreground">
                          {ROLE_LABELS[grant.role]}
                        </td>
                        <td className="px-4 py-2 text-[10px] tabular-nums">
                          {access.allowedSections.length}/{PORTAL_SECTIONS.length}
                          <span className="ml-1 text-muted-foreground/60">({access.exposure}%)</span>
                        </td>
                        <td className="px-4 py-2 text-[10px]">
                          {grant.visibility === "completo"
                            ? "exato"
                            : grant.visibility === "resumido"
                              ? "milhão"
                              : "faixa"}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                              STATUS_STYLE[access.expired ? "revogado" : grant.status],
                            )}
                          >
                            {access.expired ? "Vencido" : STATUS_LABEL[grant.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setPreviewId(grant.id)}
                              title="Ver como esta pessoa"
                              className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
                            >
                              <Eye className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                setEditing(grant);
                                setFormOpen(true);
                              }}
                              title="Editar"
                              className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
                            >
                              <ShieldCheck className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                updateGrant.mutate({
                                  id: grant.id,
                                  status: grant.status === "ativo" ? "suspenso" : "ativo",
                                })
                              }
                              title={grant.status === "ativo" ? "Suspender" : "Reativar"}
                              className="rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10"
                            >
                              {grant.status === "ativo" ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Revogar o acesso de ${grant.full_name}?`)) {
                                  deleteGrant.mutate({ id: grant.id });
                                }
                              }}
                              title="Revogar"
                              className="rounded-lg border border-red-500/20 bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card rounded-[2rem] border border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-widest">Ver como</h2>
            {preview ? (
              <span className="text-[10px] text-muted-foreground">
                {preview.grant.full_name} · {ROLE_LABELS[preview.grant.role]}
              </span>
            ) : null}
          </div>

          {!preview ? (
            <p className="py-10 text-center text-[11px] text-muted-foreground">
              Conceda um acesso para simular o que a pessoa vê.
            </p>
          ) : (
            <>
              <div className="mb-3 space-y-1.5">
                {preview.access.sections.map((section) => (
                  <div key={section.id} className="flex items-start gap-2 text-[11px]">
                    {section.allowed ? (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    ) : (
                      <Lock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                    )}
                    <span className={section.allowed ? "" : "text-muted-foreground/60"}>
                      <strong>{section.label}</strong>
                      {!section.allowed ? (
                        <span className="text-muted-foreground/50"> — {section.reason}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Como os números aparecem
                </p>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Patrimônio líquido</span>
                    <span className="font-bold tabular-nums">
                      {preview.access.allowedSections.includes("resumo")
                        ? redactAmount(SAMPLE.netWorth, preview.access.visibility)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retorno no mês</span>
                    <span className="font-bold tabular-nums">
                      {preview.access.allowedSections.includes("resumo")
                        ? redactPercent(SAMPLE.monthReturnPct)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dívida</span>
                    <span className="font-bold tabular-nums">
                      {preview.access.allowedSections.includes("balanco")
                        ? redactAmount(SAMPLE.debt, preview.access.visibility)
                        : "não exibida"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exportar PDF</span>
                    <span className={preview.access.canExport ? "font-bold" : "text-muted-foreground/60"}>
                      {preview.access.canExport ? "permitido" : "bloqueado"}
                    </span>
                  </div>
                </div>
                {preview.access.allowedSections.includes("atribuicao") ? (
                  <div className="mt-2 space-y-1 border-t border-white/5 pt-2 text-[10px]">
                    {SAMPLE.contributions.map((item) => (
                      <div key={item.label} className="flex justify-between">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className={cn("tabular-nums", item.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {redactPercent(item.value)} p.p.
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {preview.access.warnings.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {preview.access.warnings.map((warning) => (
                    <p key={warning} className="flex items-start gap-2 text-[10px] text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {warning}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-500">
                  <ShieldCheck className="h-3 w-3" /> Acesso sem pendências de segurança.
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const text = [
                      `Olá, ${preview.grant.full_name}.`,
                      "",
                      "Seu acesso ao portal patrimonial da família está liberado.",
                      `E-mail: ${preview.grant.email}`,
                      `Seções: ${preview.access.allowedSections
                        .map((id) => PORTAL_SECTIONS.find((section) => section.id === id)?.label ?? id)
                        .join(", ")}`,
                      `Valores: ${preview.access.visibility === "completo" ? "exatos" : preview.access.visibility === "resumido" ? "em milhões" : "em faixas"}`,
                      preview.grant.expires_at ? `Válido até ${dateBr(preview.grant.expires_at)}.` : "",
                      preview.access.requireMfa ? "O primeiro acesso pedirá verificação em dois fatores." : "",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    navigator.clipboard?.writeText(text);
                    toast.success("Convite copiado para a área de transferência");
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest hover:bg-white/10"
                >
                  <Copy className="h-3 w-3" /> Copiar convite
                </button>
                <button
                  onClick={() =>
                    updateGrant.mutate({
                      id: preview.grant.id,
                      status: preview.grant.status === "convite_pendente" ? "ativo" : "convite_pendente",
                    })
                  }
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest hover:bg-white/10"
                >
                  <Download className="h-3 w-3" /> Marcar {preview.grant.status === "convite_pendente" ? "aceito" : "pendente"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <p className="px-2 text-[10px] leading-relaxed text-muted-foreground/60">
        O acesso é aplicado em duas camadas: a política de RLS garante que o convidado só leia o
        próprio grant (<code>grantee reads own portal grant</code>), e o app resolve seção por seção
        antes de renderizar. Nenhuma regra de visibilidade mora em componente — está em{" "}
        <code>src/lib/portal/access.ts</code>, com teste.
      </p>

      {formOpen ? (
        <GrantForm
          entities={(entities ?? []).map((entity) => ({ id: entity.id, name: entity.name }))}
          editing={editing}
          pending={createGrant.isPending || updateGrant.isPending}
          onClose={() => setFormOpen(false)}
          onSubmit={(payload) => {
            if (editing) {
              updateGrant.mutate({ ...payload, id: editing.id } as never, {
                onSuccess: () => setFormOpen(false),
              });
            } else {
              createGrant.mutate(payload as never, { onSuccess: () => setFormOpen(false) });
            }
          }}
        />
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] outline-none focus:border-primary/50";

function GrantForm({
  entities,
  editing,
  pending,
  onClose,
  onSubmit,
}: {
  entities: { id: string; name: string }[];
  editing: PortalGrant | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    entity_id: editing?.entity_id ?? entities[0]?.id ?? "",
    full_name: editing?.full_name ?? "",
    email: editing?.email ?? "",
    role: (editing?.role ?? "herdeiro") as PortalRole,
    sections: editing?.sections ?? ROLE_PRESETS.herdeiro.sections,
    visibility: (editing?.visibility ?? "faixas") as PortalVisibility,
    can_export: Boolean(editing?.can_export),
    can_see_liabilities: Boolean(editing?.can_see_liabilities),
    can_see_documents: Boolean(editing?.can_see_documents),
    require_mfa: editing?.require_mfa ?? true,
    expires_at: editing?.expires_at?.slice(0, 10) ?? "",
    notes: editing?.notes ?? "",
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const applyPreset = (role: PortalRole) => {
    const preset = ROLE_PRESETS[role];
    setForm((current) => ({
      ...current,
      role,
      sections: preset.sections,
      visibility: (preset.extras.visibility as PortalVisibility) ?? current.visibility,
      can_export: Boolean(preset.extras.can_export),
      can_see_liabilities: Boolean(preset.extras.can_see_liabilities),
      can_see_documents: Boolean(preset.extras.can_see_documents),
      require_mfa: preset.extras.require_mfa ?? true,
    }));
  };

  const toggleSection = (id: string) =>
    setForm((current) => ({
      ...current,
      sections: current.sections.includes(id)
        ? current.sections.filter((section) => section !== id)
        : [...current.sections, id],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[1.5rem] border border-white/10 bg-[oklch(0.14_0.02_250)] p-5 shadow-2xl">
        <h2 className="mb-4 text-[11px] font-black uppercase tracking-widest">
          {editing ? `Editar acesso · ${editing.full_name}` : "Conceder acesso ao portal"}
        </h2>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Nome</span>
              <input
                className={inputClass}
                value={form.full_name}
                onChange={(event) => set("full_name", event.target.value)}
                placeholder="Marina Almeida"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">E-mail</span>
              <input
                className={inputClass}
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="marina@almeida.com"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Holding</span>
              <select
                className={inputClass}
                value={form.entity_id}
                onChange={(event) => set("entity_id", event.target.value)}
              >
                {entities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">Papel</span>
              <select
                className={inputClass}
                value={form.role}
                onChange={(event) => applyPreset(event.target.value as PortalRole)}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                Grão do valor
              </span>
              <select
                className={inputClass}
                value={form.visibility}
                onChange={(event) => set("visibility", event.target.value as PortalVisibility)}
              >
                <option value="completo">Exato (R$ 63.386.946)</option>
                <option value="resumido">Milhão (R$ 63,4 mi)</option>
                <option value="faixas">Faixa (R$ 60–70 mi)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                Válido até
              </span>
              <input
                type="date"
                className={inputClass}
                value={form.expires_at}
                onChange={(event) => set("expires_at", event.target.value)}
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              Seções liberadas
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {PORTAL_SECTIONS.map((section) => {
                const active = form.sections.includes(section.id);
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-[10px] transition-all",
                      active
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-white/10 bg-white/5 text-muted-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold">
                      {active ? <Check className="h-3 w-3 text-primary" /> : <Lock className="h-3 w-3" />}
                      {section.label}
                    </span>
                    <span className="mt-0.5 block text-[9px] text-muted-foreground/70">{section.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              { key: "can_see_liabilities" as const, label: "Ver passivo e dívida" },
              { key: "can_see_documents" as const, label: "Ver documentos e processos" },
              { key: "can_export" as const, label: "Exportar PDF" },
              { key: "require_mfa" as const, label: "Exigir segundo fator" },
            ].map((option) => (
              <label key={option.key} className="flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={form[option.key]}
                  onChange={(event) => set(option.key, event.target.checked)}
                  className="h-3.5 w-3.5 accent-[oklch(0.72_0.14_155)]"
                />
                {option.label}
              </label>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              Observação interna
            </span>
            <input
              className={inputClass}
              value={form.notes ?? ""}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Acesso combinado com o advogado na reunião de 03/11"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            disabled={pending || !form.full_name || !form.email || form.sections.length === 0}
            onClick={() =>
              onSubmit({
                entity_id: form.entity_id,
                full_name: form.full_name,
                email: form.email,
                role: form.role,
                sections: form.sections,
                visibility: form.visibility,
                status: editing?.status ?? "convite_pendente",
                can_export: form.can_export,
                can_see_liabilities: form.can_see_liabilities,
                can_see_documents: form.can_see_documents,
                require_mfa: form.require_mfa,
                expires_at: form.expires_at || undefined,
                notes: form.notes || undefined,
              })
            }
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {editing ? "Salvar" : "Conceder acesso"}
          </button>
        </div>
      </div>
    </div>
  );
}
