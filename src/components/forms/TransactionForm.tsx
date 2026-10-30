import { Loader2, DollarSign } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAssets, useEntities } from "@/hooks/usePatrimonio";
import { useCreateTransaction } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { transactionInputSchema } from "@/lib/validation/schemas";

const CATEGORIES = [
  "Dividendos",
  "Arrendamento",
  "Locação",
  "Venda de Grãos",
  "IPTU",
  "ITR",
  "Manutenção",
  "Seguro",
  "Consultoria",
  "Jurídico",
  "Pessoal",
  "Insumos",
  "Taxas",
  "Outros",
];

export function TransactionForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: entities } = useEntities();
  const { data: assets } = useAssets();
  const create = useCreateTransaction();

  const form = useZodForm(transactionInputSchema, {
    title: "",
    entity_id: "",
    asset_id: "",
    amount: "",
    type: "income",
    category: "Dividendos",
    transaction_date: new Date().toISOString().slice(0, 10),
  });

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
      title="Novo lançamento"
      description="Entradas e saídas alimentam o fluxo de caixa e o resultado consolidado do JARVIS."
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
            form="transaction-form"
            disabled={create.isPending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Registrar
          </button>
        </div>
      }
    >
      <form
        id="transaction-form"
        onSubmit={submit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-5"
      >
        <Field label="Descrição" error={form.errors.title} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.title ?? "")}
            onChange={(e) => form.setValue("title", e.target.value)}
            placeholder="Ex.: Arrendamento Fazenda Boa Vista"
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

        <Field label="Ativo (opcional)" error={form.errors.asset_id}>
          <select
            className={inputClass}
            value={String(form.values.asset_id ?? "")}
            onChange={(e) => form.setValue("asset_id", e.target.value)}
          >
            <option value="">Nenhum</option>
            {assets?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor (R$)" error={form.errors.amount}>
          <input
            className={inputClass}
            inputMode="numeric"
            value={String(form.values.amount ?? "")}
            onChange={(e) => form.setValue("amount", e.target.value)}
            placeholder="780000"
          />
        </Field>

        <Field label="Natureza" error={form.errors.type}>
          <select
            className={inputClass}
            value={String(form.values.type ?? "income")}
            onChange={(e) => form.setValue("type", e.target.value)}
          >
            <option value="income">Entrada</option>
            <option value="expense">Saída</option>
          </select>
        </Field>

        <Field label="Categoria" error={form.errors.category}>
          <select
            className={inputClass}
            value={String(form.values.category ?? "Dividendos")}
            onChange={(e) => form.setValue("category", e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Data" error={form.errors.transaction_date}>
          <input
            type="date"
            className={inputClass}
            value={String(form.values.transaction_date ?? "")}
            onChange={(e) => form.setValue("transaction_date", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
