/**
 * Camada de escrita do PATRIUM OS.
 *
 * Antes deste módulo o app era 100% leitura: nenhuma tela gravava nada no banco.
 * Toda mutação passa por uma server function autenticada (requireSupabaseAuth),
 * que cria um client Supabase com o JWT do usuário — portanto as políticas de RLS
 * continuam sendo a última linha de defesa, mesmo que o cliente seja adulterado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assetInputSchema,
  assetUpdateSchema,
  entityInputSchema,
  riskInputSchema,
  riskUpdateSchema,
  documentInputSchema,
  transactionInputSchema,
  actionPlanUpdateSchema,
} from "@/lib/validation/schemas";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

const idSchema = z.object({ id: z.string().uuid("Registro inválido.") });
const entityUpdateSchema = entityInputSchema.partial().extend({ id: z.string().uuid() });

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

/** Normaliza strings vazias de formulário para NULL (evita gravar "" no banco). */
function nullify(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === "" ? null : v;
  return out;
}

// ============================================================== entities (holdings)
export const createEntity = authed
  .validator(entityInputSchema)
  .handler(async ({ data, context }) => {
    const payload = nullify(data) as Tables["entities"]["Insert"];
    const { data: row, error } = await context.supabase
      .from("entities")
      .insert({ ...payload, owner_user_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateEntity = authed
  .validator(entityUpdateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("entities")
      .update(nullify(rest) as Tables["entities"]["Update"])
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEntity = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("entities").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ======================================================================== assets
export const createAsset = authed.validator(assetInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("assets")
    .insert(nullify(data) as Tables["assets"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateAsset = authed
  .validator(assetUpdateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("assets")
      .update(nullify(rest) as Tables["assets"]["Update"])
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAsset = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("assets").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ========================================================================= risks
export const createRisk = authed.validator(riskInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("risks")
    .insert({ ...(nullify(data) as Tables["risks"]["Insert"]), status: "pending" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateRisk = authed.validator(riskUpdateSchema).handler(async ({ data, context }) => {
  const { id, ...rest } = data;
  const { data: row, error } = await context.supabase
    .from("risks")
    .update(nullify(rest) as Tables["risks"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

/** Marca o risco como resolvido — preserva o histórico em vez de apagar. */
export const resolveRisk = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("risks")
    .update({ status: "resolved" })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteRisk = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("risks").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ===================================================================== documents
export const createDocument = authed
  .validator(documentInputSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        ...(nullify(data) as Tables["documents"]["Insert"]),
        status: "pendente",
        ocr_processed: false,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDocument = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ================================================================== transactions
export const createTransaction = authed
  .validator(transactionInputSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("transactions")
      .insert(nullify(data) as Tables["transactions"]["Insert"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ================================================================ action plans
export const updateActionPlan = authed
  .validator(actionPlanUpdateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("jarvis_action_plans")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============================================================ insights (resolver)
export const resolveInsight = authed.validator(idSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("jarvis_insights")
    .update({ is_resolved: true, updated_at: new Date().toISOString() })
    .eq("id", data.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});
