import { Loader2, Save } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useEntities } from "@/hooks/usePatrimonio";
import { useCreateAsset, useUpdateAsset } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { assetInputSchema } from "@/lib/validation/schemas";

export type AssetRecord = {
  id: string;
  name: string;
  type: string | null;
  entity_id: string | null;
  value: number | string | null;
  location: string | null;
  area: string | null;
  registration_number: string | null;
  status: string | null;
  health_score: number | null;
};

const STATUS_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "pendente", label: "Pendente" },
  { value: "alerta", label: "Alerta" },
  { value: "critico", label: "Crítico" },
];

const TYPE_OPTIONS = [
  { value: "urbano", label: "Urbano" },
  { value: "rural", label: "Rural" },
  { value: "veiculo", label: "Veículo / Aeronave" },
  { value: "outro", label: "Outro" },
];

export function AssetForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: AssetRecord | null;
}) {
  const { data: entities } = useEntities();
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(assetInputSchema, {
    name: editing?.name ?? "",
    type: (editing?.type as "urbano") ?? "urbano",
    entity_id: editing?.entity_id ?? "",
    value: editing?.value != null ? String(editing.value) : "",
    location: editing?.location ?? "",
    area: editing?.area ?? "",
    registration_number: editing?.registration_number ?? "",
    status: (editing?.status as "regular") ?? "regular",
    health_score: editing?.health_score ?? 100,
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
    else create.mutate(parsed, { onSuccess });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar ativo" : "Cadastrar ativo"}
      description="Todo ativo entra no Digital Twin com matrícula, área e status de regularidade."
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
            form="asset-form"
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editing ? "Salvar alterações" : "Cadastrar ativo"}
          </button>
        </div>
      }
    >
      <form id="asset-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Nome do ativo" error={form.errors.name} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.name ?? "")}
            onChange={(e) => form.setValue("name", e.target.value)}
            placeholder="Ex.: Fazenda Santa Fé"
          />
        </Field>

        <Field
          label="Holding / entidade"
          error={form.errors.entity_id}
          hint={!entities?.length ? "Cadastre uma holding primeiro." : undefined}
        >
          <select
            className={inputClass}
            value={String(form.values.entity_id ?? "")}
            onChange={(e) => form.setValue("entity_id", e.target.value)}
          >
            <option value="">Selecione…</option>
            {entities?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo" error={form.errors.type}>
          <select
            className={inputClass}
            value={String(form.values.type ?? "urbano")}
            onChange={(e) => form.setValue("type", e.target.value)}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor (R$)" error={form.errors.value}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.value ?? "")}
            onChange={(e) => form.setValue("value", e.target.value)}
            placeholder="48500000"
          />
        </Field>

        <Field label="Status de regularidade" error={form.errors.status}>
          <select
            className={inputClass}
            value={String(form.values.status ?? "regular")}
            onChange={(e) => form.setValue("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Localização" error={form.errors.location}>
          <input
            className={inputClass}
            value={String(form.values.location ?? "")}
            onChange={(e) => form.setValue("location", e.target.value)}
            placeholder="Apucarana/PR"
          />
        </Field>

        <Field label="Área" error={form.errors.area}>
          <input
            className={inputClass}
            value={String(form.values.area ?? "")}
            onChange={(e) => form.setValue("area", e.target.value)}
            placeholder="1.240 ha ou 450 m²"
          />
        </Field>

        <Field label="Matrícula / registro" error={form.errors.registration_number}>
          <input
            className={inputClass}
            value={String(form.values.registration_number ?? "")}
            onChange={(e) => form.setValue("registration_number", e.target.value)}
            placeholder="12.884"
          />
        </Field>

        <Field label="Saúde técnica (0–100)" error={form.errors.health_score}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.health_score ?? "")}
            onChange={(e) => form.setValue("health_score", e.target.value)}
            placeholder="95"
          />
        </Field>
      </form>
    </Modal>
  );
}
