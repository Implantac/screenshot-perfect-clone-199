import { Loader2, ShieldAlert } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAssets, useEntities } from "@/hooks/usePatrimonio";
import { useCreateRisk } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { riskInputSchema } from "@/lib/validation/schemas";

const SEVERITY_OPTIONS = [
  { value: "low", label: "Baixo" },
  { value: "medium", label: "Médio" },
  { value: "high", label: "Alto" },
  { value: "critical", label: "Crítico" },
];

export function RiskForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: entities } = useEntities();
  const { data: assets } = useAssets();
  const create = useCreateRisk();

  const form = useZodForm(riskInputSchema, {
    title: "",
    description: "",
    severity: "high",
    entity_id: "",
    asset_id: "",
    responsible_id: "",
    due_date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  });

  const filteredAssets = assets?.filter(
    (a) => !form.values.entity_id || a.entity_id === form.values.entity_id,
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) return;
    create.mutate(parsed, {
      onSuccess: () => {
        form.reset();
        onClose();
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar risco"
      description="Riscos entram na Central de Riscos e no cálculo do score do JARVIS."
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
            form="risk-form"
            disabled={create.isPending}
            className="h-11 px-6 rounded-xl bg-orange-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Registrar risco
          </button>
        </div>
      }
    >
      <form id="risk-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Título do risco" error={form.errors.title} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.title ?? "")}
            onChange={(e) => form.setValue("title", e.target.value)}
            placeholder="Ex.: CAR com sobreposição de reserva legal"
          />
        </Field>

        <Field label="Descrição" error={form.errors.description} className="sm:col-span-2">
          <textarea
            className={`${inputClass} min-h-[90px] resize-y`}
            value={String(form.values.description ?? "")}
            onChange={(e) => form.setValue("description", e.target.value)}
            placeholder="Impacto, consequência jurídica e o que está bloqueado."
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

        <Field label="Severidade" error={form.errors.severity}>
          <select
            className={inputClass}
            value={String(form.values.severity ?? "high")}
            onChange={(e) => form.setValue("severity", e.target.value)}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Prazo de resolução" error={form.errors.due_date}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.due_date ?? "")}
            onChange={(e) => form.setValue("due_date", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
