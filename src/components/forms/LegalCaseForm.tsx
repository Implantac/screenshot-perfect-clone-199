import { Loader2, Scale } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAssets, useEntities, useMembers } from "@/hooks/usePatrimonio";
import { useCreateLegalCase, useUpdateLegalCase } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { legalCaseInputSchema } from "@/lib/validation/schemas";

export type LegalCaseRecord = {
  id: string;
  case_number: string;
  title: string;
  entity_id: string | null;
  asset_id: string | null;
  type: string;
  status: string;
  court: string | null;
  risk_level: string;
  value_at_stake: number | string | null;
  next_hearing: string | null;
  responsible_id: string | null;
  notes: string | null;
};

const TYPES = [
  { value: "civel", label: "Cível" },
  { value: "tributario", label: "Tributário" },
  { value: "ambiental", label: "Ambiental" },
  { value: "trabalhista", label: "Trabalhista" },
  { value: "societario", label: "Societário / Sucessório" },
  { value: "imobiliario", label: "Imobiliário" },
];

const STATUS = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "suspenso", label: "Suspenso" },
  { value: "acordo", label: "Acordo" },
  { value: "encerrado", label: "Encerrado" },
];

const RISK = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
];

export function LegalCaseForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: LegalCaseRecord | null;
}) {
  const { data: entities } = useEntities();
  const { data: assets } = useAssets();
  const { data: members } = useMembers();
  const create = useCreateLegalCase();
  const update = useUpdateLegalCase();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(legalCaseInputSchema, {
    case_number: editing?.case_number ?? "",
    title: editing?.title ?? "",
    entity_id: editing?.entity_id ?? "",
    asset_id: editing?.asset_id ?? "",
    type: (editing?.type as "civel") ?? "civel",
    status: (editing?.status as "em_andamento") ?? "em_andamento",
    court: editing?.court ?? "",
    risk_level: (editing?.risk_level as "medium") ?? "medium",
    value_at_stake: editing?.value_at_stake != null ? String(editing.value_at_stake) : "",
    next_hearing: editing?.next_hearing ? editing.next_hearing.slice(0, 10) : "",
    responsible_id: editing?.responsible_id ?? "",
    notes: editing?.notes ?? "",
  });

  const filteredAssets = assets?.filter(
    (a) => !form.values.entity_id || a.entity_id === form.values.entity_id,
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) return;
    const onSuccess = () => {
      form.reset();
      onClose();
    };
    if (editing) update.mutate({ id: editing.id, ...parsed }, { onSuccess });
    else create.mutate(parsed, { onSuccess });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar processo" : "Novo processo"}
      description="Cada processo entra no contencioso e no cálculo de exposição do JARVIS."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="legal-form"
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            {editing ? "Salvar" : "Registrar"}
          </button>
        </div>
      }
    >
      <form id="legal-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Número do processo" error={form.errors.case_number}>
          <input
            className={inputClass}
            value={String(form.values.case_number ?? "")}
            onChange={(e) => form.setValue("case_number", e.target.value)}
            placeholder="0000000-00.0000.0.00.0000"
          />
        </Field>

        <Field label="Tipo" error={form.errors.type}>
          <select
            className={inputClass}
            value={String(form.values.type ?? "civel")}
            onChange={(e) => form.setValue("type", e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Título / objeto" error={form.errors.title} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.title ?? "")}
            onChange={(e) => form.setValue("title", e.target.value)}
            placeholder="Ex.: Ação de retificação de área — Fazenda Santa Fé"
          />
        </Field>

        <Field label="Holding / entidade" error={form.errors.entity_id}>
          <select
            className={inputClass}
            value={String(form.values.entity_id ?? "")}
            onChange={(e) => {
              form.setValue("entity_id", e.target.value);
              form.setValue("asset_id", "");
            }}
          >
            <option value="">Selecione…</option>
            {entities?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ativo vinculado (opcional)" error={form.errors.asset_id}>
          <select
            className={inputClass}
            value={String(form.values.asset_id ?? "")}
            onChange={(e) => form.setValue("asset_id", e.target.value)}
          >
            <option value="">Nenhum</option>
            {filteredAssets?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Vara / órgão" error={form.errors.court}>
          <input
            className={inputClass}
            value={String(form.values.court ?? "")}
            onChange={(e) => form.setValue("court", e.target.value)}
            placeholder="2ª Vara Cível de Apucarana/PR"
          />
        </Field>

        <Field label="Status" error={form.errors.status}>
          <select
            className={inputClass}
            value={String(form.values.status ?? "em_andamento")}
            onChange={(e) => form.setValue("status", e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nível de risco" error={form.errors.risk_level}>
          <select
            className={inputClass}
            value={String(form.values.risk_level ?? "medium")}
            onChange={(e) => form.setValue("risk_level", e.target.value)}
          >
            {RISK.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor em disputa (R$)" error={form.errors.value_at_stake}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.value_at_stake ?? "")}
            onChange={(e) => form.setValue("value_at_stake", e.target.value)}
            placeholder="4800000"
          />
        </Field>

        <Field label="Próxima audiência" error={form.errors.next_hearing}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.next_hearing ?? "")}
            onChange={(e) => form.setValue("next_hearing", e.target.value)}
          />
        </Field>

        <Field label="Responsável" error={form.errors.responsible_id}>
          <select
            className={inputClass}
            value={String(form.values.responsible_id ?? "")}
            onChange={(e) => form.setValue("responsible_id", e.target.value)}
          >
            <option value="">Não atribuído</option>
            {members?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estratégia / observações" error={form.errors.notes} className="sm:col-span-2">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={String(form.values.notes ?? "")}
            onChange={(e) => form.setValue("notes", e.target.value)}
            placeholder="Tese, próximos atos, provisionamento…"
          />
        </Field>
      </form>
    </Modal>
  );
}
