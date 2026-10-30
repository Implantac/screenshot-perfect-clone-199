import { Loader2, Droplets } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAccounts, useEntities } from "@/hooks/usePatrimonio";
import { useCreateCashFlow } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { cashFlowInputSchema } from "@/lib/validation/schemas";

const KINDS = [
  { value: "aporte", label: "Aporte (dinheiro novo)" },
  { value: "resgate", label: "Resgate" },
  { value: "provento", label: "Provento (dividendo/cupom)" },
  { value: "taxa", label: "Taxa" },
  { value: "imposto", label: "Imposto" },
];

export function CashFlowForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: entities } = useEntities();
  const { data: accounts } = useAccounts();
  const create = useCreateCashFlow();

  const form = useZodForm(cashFlowInputSchema, {
    entity_id: "",
    account_id: "",
    kind: "aporte",
    amount: 0,
    currency: "BRL",
    flow_date: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const filteredAccounts = (accounts ?? []).filter(
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
      title="Registrar fluxo de caixa"
      description="Aporte e resgate são o que separam retorno de dinheiro novo. Sem este registro, o MWR fica errado."
      size="md"
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
            form="cashflow-form"
            disabled={create.isPending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
            Registrar fluxo
          </button>
        </div>
      }
    >
      <form id="cashflow-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Holding" error={form.errors.entity_id}>
          <select
            value={String(form.values.entity_id ?? "")}
            onChange={(e) => {
              form.setValue("entity_id", e.target.value);
              form.setValue("account_id", "");
            }}
            className={inputClass}
          >
            <option value="">Selecione…</option>
            {(entities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Conta" error={form.errors.account_id}>
          <select
            value={String(form.values.account_id ?? "")}
            onChange={(e) => form.setValue("account_id", e.target.value)}
            className={inputClass}
          >
            <option value="">Sem conta específica</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo" error={form.errors.kind}>
          <select
            value={String(form.values.kind ?? "aporte")}
            onChange={(e) => form.setValue("kind", e.target.value)}
            className={inputClass}
          >
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor" error={form.errors.amount}>
          <input
            type="number"
            step="any"
            value={String(form.values.amount ?? "")}
            onChange={(e) => form.setValue("amount", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Data" error={form.errors.flow_date}>
          <input
            type="date"
            value={String(form.values.flow_date ?? "")}
            onChange={(e) => form.setValue("flow_date", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Descrição" error={form.errors.description} className="sm:col-span-2">
          <input
            value={String(form.values.description ?? "")}
            onChange={(e) => form.setValue("description", e.target.value)}
            placeholder="Aporte programado, cupom semestral, resgate para imóvel…"
            className={inputClass}
          />
        </Field>
      </form>
    </Modal>
  );
}
