import { Loader2, Boxes } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useCreateEntity, useUpdateEntity } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { entityInputSchema } from "@/lib/validation/schemas";

export type EntityRecord = {
  id: string;
  name: string;
  tax_id: string | null;
  type: string | null;
  founded_at: string | null;
  compliance_score: number | null;
};

export function EntityForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: EntityRecord | null;
}) {
  const create = useCreateEntity();
  const update = useUpdateEntity();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(entityInputSchema, {
    name: editing?.name ?? "",
    tax_id: editing?.tax_id ?? "",
    type: editing?.type ?? "Holding Familiar",
    founded_at: editing?.founded_at ?? "",
    compliance_score: editing?.compliance_score ?? 100,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = form.validate();
    if (!parsed) return;
    const onSuccess = () => {
      form.reset();
      onClose();
    };
    if (editing) update.mutate({ id: editing.id, ...parsed }, { onSuccess });
    else
      create.mutate({ ...parsed, compliance_score: parsed.compliance_score ?? 100 }, { onSuccess });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar holding" : "Nova holding"}
      description="A entidade é a raiz do tenant: ativos, riscos e documentos herdam o acesso a partir dela."
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
            form="entity-form"
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
            {editing ? "Salvar" : "Criar holding"}
          </button>
        </div>
      }
    >
      <form id="entity-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Razão social" error={form.errors.name} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.name ?? "")}
            onChange={(e) => form.setValue("name", e.target.value)}
            placeholder="Ex.: Alencar Participações S.A."
          />
        </Field>

        <Field label="CNPJ" error={form.errors.tax_id}>
          <input
            className={inputClass}
            value={String(form.values.tax_id ?? "")}
            onChange={(e) => form.setValue("tax_id", e.target.value)}
            placeholder="00.000.000/0001-00"
          />
        </Field>

        <Field label="Tipo" error={form.errors.type}>
          <input
            className={inputClass}
            value={String(form.values.type ?? "")}
            onChange={(e) => form.setValue("type", e.target.value)}
            placeholder="Holding Familiar, Operacional, Investimento…"
          />
        </Field>

        <Field label="Fundação" error={form.errors.founded_at}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.founded_at ?? "")}
            onChange={(e) => form.setValue("founded_at", e.target.value)}
          />
        </Field>

        <Field label="Compliance inicial (%)" error={form.errors.compliance_score}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.compliance_score ?? "")}
            onChange={(e) => form.setValue("compliance_score", e.target.value)}
            placeholder="100"
          />
        </Field>
      </form>
    </Modal>
  );
}
