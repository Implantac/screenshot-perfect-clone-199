import { Loader2, Users2 } from "lucide-react";
import { Modal } from "./Modal";
import { Field, inputClass } from "./Field";
import { useCreateMember, useUpdateMember, useUpsertShare } from "@/hooks/useCrud";
import { useEntities } from "@/hooks/usePatrimonio";
import { useZodForm } from "@/hooks/useZodForm";
import { memberInputSchema, shareInputSchema } from "@/lib/validation/schemas";
import { useState } from "react";

export type MemberRecord = {
  id: string;
  full_name: string;
  email: string | null;
  tax_id: string | null;
  role: string | null;
};

const ROLES = ["Patriarca", "Matriarca", "Sucessor", "Sucessora", "Gestor", "Conselheiro", "Conselheira"];

export function MemberForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: MemberRecord | null;
}) {
  const create = useCreateMember();
  const update = useUpdateMember();
  const upsertShare = useUpsertShare();
  const { data: entities } = useEntities();
  const pending = create.isPending || update.isPending;

  const [shareEntity, setShareEntity] = useState("");
  const [sharePercent, setSharePercent] = useState("");

  const form = useZodForm(memberInputSchema, {
    full_name: editing?.full_name ?? "",
    email: editing?.email ?? "",
    tax_id: editing?.tax_id ?? "",
    role: editing?.role ?? "Sucessor",
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

  const addShare = () => {
    if (!editing) return;
    const parsed = shareInputSchema.safeParse({
      entity_id: shareEntity,
      member_id: editing.id,
      share_percentage: sharePercent,
    });
    if (!parsed.success) return;
    upsertShare.mutate(parsed.data, {
      onSuccess: () => {
        setShareEntity("");
        setSharePercent("");
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Editar sócio" : "Novo sócio"}
      description="Sócios compõem o organograma e as participações societárias da estrutura."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-white/5 transition-colors"
          >
            Fechar
          </button>
          <button
            type="submit"
            form="member-form"
            disabled={pending}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users2 className="h-4 w-4" />}
            {editing ? "Salvar sócio" : "Adicionar sócio"}
          </button>
        </div>
      }
    >
      <form id="member-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Nome completo" error={form.errors.full_name} className="sm:col-span-2">
          <input
            className={inputClass}
            value={String(form.values.full_name ?? "")}
            onChange={(e) => form.setValue("full_name", e.target.value)}
            placeholder="Ex.: Marina Alencar"
          />
        </Field>

        <Field label="E-mail" error={form.errors.email}>
          <input
            className={inputClass}
            value={String(form.values.email ?? "")}
            onChange={(e) => form.setValue("email", e.target.value)}
            placeholder="marina@familia.com.br"
          />
        </Field>

        <Field label="CPF" error={form.errors.tax_id}>
          <input
            className={inputClass}
            value={String(form.values.tax_id ?? "")}
            onChange={(e) => form.setValue("tax_id", e.target.value)}
            placeholder="000.000.000-00"
          />
        </Field>

        <Field label="Papel na estrutura" error={form.errors.role} className="sm:col-span-2">
          <select
            className={inputClass}
            value={String(form.values.role ?? "Sucessor")}
            onChange={(e) => form.setValue("role", e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </form>

      {editing && (
        <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
              Adicionar / atualizar participação
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O percentual é por entidade; reenviar o mesmo par sócio + holding atualiza o valor.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <Field label="Holding">
              <select
                className={inputClass}
                value={shareEntity}
                onChange={(e) => setShareEntity(e.target.value)}
              >
                <option value="">Selecione…</option>
                {entities?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Percentual (%)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={sharePercent}
                onChange={(e) => setSharePercent(e.target.value)}
                placeholder="25"
              />
            </Field>
            <button
              type="button"
              onClick={addShare}
              disabled={!shareEntity || !sharePercent || upsertShare.isPending}
              className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {upsertShare.isPending ? "Salvando…" : "Aplicar"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
