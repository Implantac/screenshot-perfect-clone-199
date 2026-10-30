import { Loader2, Handshake } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useEntities } from "@/hooks/usePatrimonio";
import { useCreateSupplier, useUpdateSupplier } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { supplierInputSchema } from "@/lib/validation/schemas";

export type SupplierRecord = {
  id: string;
  name: string;
  entity_id: string | null;
  tax_id: string | null;
  category: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  compliance_score: number | null;
  contract_value: number | string | null;
  contract_expiry: string | null;
  notes: string | null;
};

const STATUS = [
  { value: "homologado", label: "Homologado" },
  { value: "em_analise", label: "Em análise" },
  { value: "risco_critico", label: "Risco crítico" },
  { value: "inativo", label: "Inativo" },
];

const CATEGORIES = [
  "Insumos",
  "Serviços Técnicos",
  "Jurídico",
  "Obras",
  "Seguros",
  "TI",
  "Logística",
  "Consultoria",
  "Outros",
];

export function SupplierForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: SupplierRecord | null;
}) {
  const { data: entities } = useEntities();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const pending = create.isPending || update.isPending;

  const form = useZodForm(supplierInputSchema, {
    name: editing?.name ?? "",
    entity_id: editing?.entity_id ?? "",
    tax_id: editing?.tax_id ?? "",
    category: editing?.category ?? "Serviços Técnicos",
    contact_email: editing?.contact_email ?? "",
    contact_phone: editing?.contact_phone ?? "",
    status: (editing?.status as "em_analise") ?? "em_analise",
    compliance_score: editing?.compliance_score ?? 100,
    contract_value: editing?.contract_value != null ? String(editing.contract_value) : "",
    contract_expiry: editing?.contract_expiry ?? "",
    notes: editing?.notes ?? "",
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
      title={editing ? "Editar fornecedor" : "Novo fornecedor"}
      description="Fornecedor homologado entra na régua de compliance; risco crítico bloqueia contratação."
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
            form="supplier-form"
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
            {editing ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      }
    >
      <form id="supplier-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Razão social" error={form.errors.name} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.name ?? "")}
            onChange={(e) => form.setValue("name", e.target.value)}
            placeholder="Ex.: AgroInsumos Paraná Ltda."
          />
        </Field>

        <Field label="Holding / entidade" error={form.errors.entity_id}>
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

        <Field label="CNPJ" error={form.errors.tax_id}>
          <input
            className={inputClass}
            value={String(form.values.tax_id ?? "")}
            onChange={(e) => form.setValue("tax_id", e.target.value)}
            placeholder="00.000.000/0001-00"
          />
        </Field>

        <Field label="Categoria" error={form.errors.category}>
          <select
            className={inputClass}
            value={String(form.values.category ?? "Serviços Técnicos")}
            onChange={(e) => form.setValue("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Status de homologação" error={form.errors.status}>
          <select
            className={inputClass}
            value={String(form.values.status ?? "em_analise")}
            onChange={(e) => form.setValue("status", e.target.value)}
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="E-mail de contato" error={form.errors.contact_email}>
          <input
            className={inputClass}
            value={String(form.values.contact_email ?? "")}
            onChange={(e) => form.setValue("contact_email", e.target.value)}
            placeholder="contato@fornecedor.com.br"
          />
        </Field>

        <Field label="Telefone" error={form.errors.contact_phone}>
          <input
            className={inputClass}
            value={String(form.values.contact_phone ?? "")}
            onChange={(e) => form.setValue("contact_phone", e.target.value)}
            placeholder="(43) 99999-0000"
          />
        </Field>

        <Field label="Compliance (%)" error={form.errors.compliance_score}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.compliance_score ?? "")}
            onChange={(e) => form.setValue("compliance_score", e.target.value)}
            placeholder="100"
          />
        </Field>

        <Field label="Valor do contrato (R$)" error={form.errors.contract_value}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.contract_value ?? "")}
            onChange={(e) => form.setValue("contract_value", e.target.value)}
            placeholder="148000"
          />
        </Field>

        <Field label="Vencimento do contrato" error={form.errors.contract_expiry}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.contract_expiry ?? "")}
            onChange={(e) => form.setValue("contract_expiry", e.target.value)}
          />
        </Field>

        <Field label="Observações" error={form.errors.notes} className="sm:col-span-2">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={String(form.values.notes ?? "")}
            onChange={(e) => form.setValue("notes", e.target.value)}
            placeholder="Escopo, pendências documentais, histórico…"
          />
        </Field>
      </form>
    </Modal>
  );
}
