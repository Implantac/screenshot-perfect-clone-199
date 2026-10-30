import { Loader2, FileUp } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAssets, useEntities } from "@/hooks/usePatrimonio";
import { useCreateDocument } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { documentInputSchema } from "@/lib/validation/schemas";

const DOC_TYPES = [
  "Matrícula",
  "Escritura",
  "Certidão",
  "CND",
  "CAR",
  "Contrato",
  "Alvará",
  "Laudo Técnico",
  "Comprovante",
];

export function DocumentForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: entities } = useEntities();
  const { data: assets } = useAssets();
  const create = useCreateDocument();

  const form = useZodForm(documentInputSchema, {
    title: "",
    type: "Matrícula",
    entity_id: "",
    asset_id: "",
    expiry_date: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
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
      title="Arquivar documento"
      description="O vencimento gera alerta automático e entra na Saúde Documental."
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
            form="document-form"
            disabled={create.isPending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            Arquivar
          </button>
        </div>
      }
    >
      <form id="document-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Título do documento" error={form.errors.title} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.title ?? "")}
            onChange={(e) => form.setValue("title", e.target.value)}
            placeholder="Ex.: Matrícula 12.884 — Fazenda Santa Fé"
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

        <Field label="Tipo" error={form.errors.type}>
          <select
            className={inputClass}
            value={String(form.values.type ?? "Matrícula")}
            onChange={(e) => form.setValue("type", e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Vencimento" error={form.errors.expiry_date}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.expiry_date ?? "")}
            onChange={(e) => form.setValue("expiry_date", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
