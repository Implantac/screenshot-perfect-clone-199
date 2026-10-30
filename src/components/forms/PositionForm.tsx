import { Loader2, Wallet } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useAccounts, useEntities } from "@/hooks/usePatrimonio";
import { useCreatePosition } from "@/hooks/useCrud";
import { useZodForm } from "@/hooks/useZodForm";
import { positionInputSchema } from "@/lib/validation/schemas";
import { ASSET_CLASS_LABELS, LIQUIDITY_LABELS } from "@/lib/wealth/allocation";

export function PositionForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: entities } = useEntities();
  const { data: accounts } = useAccounts();
  const create = useCreatePosition();

  const form = useZodForm(positionInputSchema, {
    entity_id: "",
    account_id: "",
    asset_class: "renda_fixa",
    liquidity: "d1",
    symbol: "",
    instrument_id: "",
    name: "",
    quantity: 0,
    unit_price: 0,
    cost_basis: 0,
    currency: "BRL",
    as_of: new Date().toISOString().slice(0, 10),
    is_offshore: false,
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
      title="Nova posição"
      description="Uma linha por papel/cota. O valor de mercado é quantidade × preço e alimenta alocação, TWR e qualidade do dado."
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
            form="position-form"
            disabled={create.isPending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Lançar posição
          </button>
        </div>
      }
    >
      <form id="position-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

        <Field label="Conta de custódia" error={form.errors.account_id} hint="Opcional, mas necessário para conciliar extrato.">
          <select
            value={String(form.values.account_id ?? "")}
            onChange={(e) => form.setValue("account_id", e.target.value)}
            className={inputClass}
          >
            <option value="">Sem conta vinculada</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nome da posição" error={form.errors.name} className="sm:col-span-2">
          <input
            value={String(form.values.name ?? "")}
            onChange={(e) => form.setValue("name", e.target.value)}
            placeholder="Tesouro IPCA+ 2035, PETR4, Fundo XP…"
            className={inputClass}
          />
        </Field>

        <Field label="Classe" error={form.errors.asset_class}>
          <select
            value={String(form.values.asset_class ?? "renda_fixa")}
            onChange={(e) => form.setValue("asset_class", e.target.value)}
            className={inputClass}
          >
            {Object.entries(ASSET_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Liquidez" error={form.errors.liquidity} hint="Usada no cálculo do quanto há disponível em D+1.">
          <select
            value={String(form.values.liquidity ?? "d1")}
            onChange={(e) => form.setValue("liquidity", e.target.value)}
            className={inputClass}
          >
            {Object.entries(LIQUIDITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ticker / código" error={form.errors.symbol} hint="Ação, FII ou moeda: PETR4, HGLG11, US:AAPL, USD/BRL.">
          <input
            value={String(form.values.symbol ?? "")}
            onChange={(e) => form.setValue("symbol", e.target.value)}
            placeholder="PETR4"
            className={inputClass}
          />
        </Field>

        <Field
          label="CNPJ do fundo"
          error={form.errors.instrument_id}
          hint="Fundo aberto não tem ticker: com o CNPJ, a cota é atualizada pela CVM."
        >
          <input
            value={String(form.values.instrument_id ?? "")}
            onChange={(e) => form.setValue("instrument_id", e.target.value)}
            placeholder="12.345.678/0001-90"
            className={inputClass}
          />
        </Field>

        <Field label="Moeda" error={form.errors.currency}>
          <select
            value={String(form.values.currency ?? "BRL")}
            onChange={(e) => form.setValue("currency", e.target.value)}
            className={inputClass}
          >
            <option value="BRL">BRL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>

        <Field label="Quantidade" error={form.errors.quantity}>
          <input
            type="number"
            step="any"
            value={String(form.values.quantity ?? "")}
            onChange={(e) => form.setValue("quantity", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Preço unitário (hoje)" error={form.errors.unit_price}>
          <input
            type="number"
            step="any"
            value={String(form.values.unit_price ?? "")}
            onChange={(e) => form.setValue("unit_price", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Custo de aquisição total"
          error={form.errors.cost_basis}
          hint="Base do ganho não realizado. Use o valor pago, não o de mercado."
        >
          <input
            type="number"
            step="any"
            value={String(form.values.cost_basis ?? "")}
            onChange={(e) => form.setValue("cost_basis", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Data do preço" error={form.errors.as_of} hint="Preço com mais de 30 dias é sinalizado na qualidade do dado.">
          <input
            type="date"
            value={String(form.values.as_of ?? "")}
            onChange={(e) => form.setValue("as_of", e.target.value)}
            className={inputClass}
          />
        </Field>

        <label className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.values.is_offshore)}
            onChange={(e) => form.setValue("is_offshore", e.target.checked)}
            className="h-4 w-4 accent-[color:var(--color-primary)]"
          />
          <span className="text-xs font-bold">Posição offshore (fora do Brasil)</span>
        </label>
      </form>
    </Modal>
  );
}
