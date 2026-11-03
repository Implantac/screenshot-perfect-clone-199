/**
 * Cartão de aprovação de proposta do JARVIS.
 *
 * Esse componente é a fronteira entre "a IA sugeriu" e "o sistema gravou".
 * Ele mostra exatamente o que mudaria (payload, campo a campo) e exige dois
 * cliques conscientes: aprovar → aplicar. Nada acontece sozinho.
 */
import { Check, Loader2, ShieldAlert, ShieldCheck, ShieldX, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JarvisProposalView } from "@/lib/jarvis/types";

const KIND_LABEL: Record<string, string> = {
  criar_risco: "Novo risco",
  criar_plano_acao: "Plano de ação",
  lancar_provisao: "Lançamento de provisão",
};

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof Check }> = {
  pending: {
    label: "Aguardando aprovação",
    className: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    icon: ShieldAlert,
  },
  approved: { label: "Aprovada · pronta para aplicar", className: "bg-primary/10 border-primary/30 text-primary", icon: ShieldCheck },
  applied: { label: "Aplicada", className: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", icon: Check },
  rejected: { label: "Rejeitada", className: "bg-white/5 border-white/10 text-muted-foreground", icon: ShieldX },
  failed: { label: "Falhou ao aplicar", className: "bg-orange-500/10 border-orange-500/30 text-orange-400", icon: Undo2 },
};

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  severity: "Severidade",
  status: "Situação",
  due_date: "Prazo",
  suggested_resolution: "Resolução sugerida",
  impact_analysis: "Impacto",
  priority: "Prioridade",
  case_id: "Processo",
  kind: "Tipo de lançamento",
  amount: "Valor",
  occurred_on: "Data do lançamento",
  note: "Observação",
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "amount" && typeof value === "number") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  return String(value);
}

export type ProposalCardProps = {
  proposal: JarvisProposalView;
  busy?: boolean;
  onDecide?: (id: string, decision: "approved" | "rejected") => void;
  onApply?: (id: string) => void;
};

export function ProposalCard({ proposal, busy, onDecide, onApply }: ProposalCardProps) {
  const status = STATUS_STYLE[proposal.status] ?? STATUS_STYLE.pending;
  const Icon = status.icon;
  const fields = Object.entries(proposal.payload ?? {});

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 lg:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
              {KIND_LABEL[proposal.kind] ?? proposal.kind}
            </span>
            <span
              className={cn(
                "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border",
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>
          <p className="text-sm font-black tracking-tight leading-snug">{proposal.title}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{proposal.rationale}</p>
        </div>
      </div>

      <div className="rounded-xl bg-black/20 border border-white/5 divide-y divide-white/5">
        {fields.map(([key, value]) => (
          <div key={key} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-32 shrink-0">
              {FIELD_LABEL[key] ?? key}
            </span>
            <span className="text-[11px] text-foreground/80 font-medium break-words min-w-0">
              {formatValue(key, value)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3 w-3 text-primary mt-0.5 shrink-0" />
        <span>
          Nada é gravado sem a sua aprovação. A decisão e a aplicação ficam registradas na trilha de auditoria com
          autor, data e payload.
        </span>
      </p>

      {proposal.status === "pending" && onDecide && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(proposal.id, "approved")}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Aprovar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(proposal.id, "rejected")}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5 disabled:opacity-50"
          >
            <X className="h-3 w-3" /> Rejeitar
          </button>
        </div>
      )}

      {proposal.status === "approved" && onApply && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(proposal.id)}
          className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Aplicar agora
        </button>
      )}

      {proposal.status === "applied" && (
        <p className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
          <Check className="h-3 w-3" /> Gravado no módulo e registrado na trilha.
        </p>
      )}
    </div>
  );
}
