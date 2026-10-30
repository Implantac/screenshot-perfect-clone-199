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
  supplierInputSchema,
  supplierUpdateSchema,
  legalCaseInputSchema,
  legalCaseUpdateSchema,
  memberInputSchema,
  memberUpdateSchema,
  shareInputSchema,
  documentUpdateSchema,
  accountInputSchema,
  positionInputSchema,
  positionUpdateSchema,
  cashFlowInputSchema,
  snapshotInputSchema,
  taxScenarioInputSchema,
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

// ===================================================================== suppliers
export const createSupplier = authed.inputValidator(supplierInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("suppliers")
    .insert(nullify(data) as Tables["suppliers"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateSupplier = authed.inputValidator(supplierUpdateSchema).handler(async ({ data, context }) => {
  const { id, ...rest } = data;
  const { data: row, error } = await context.supabase
    .from("suppliers")
    .update(nullify(rest) as Tables["suppliers"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

/** Alterna a homologação do fornecedor em um clique (homologado <-> em_analise). */
export const toggleSupplierStatus = authed
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["homologado", "em_analise", "risco_critico", "inativo"]) }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("suppliers")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSupplier = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("suppliers").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ================================================================== legal cases
export const createLegalCase = authed
  .inputValidator(legalCaseInputSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("legal_cases")
      .insert(nullify(data) as Tables["legal_cases"]["Insert"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateLegalCase = authed
  .inputValidator(legalCaseUpdateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("legal_cases")
      .update(nullify(rest) as Tables["legal_cases"]["Update"])
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteLegalCase = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("legal_cases").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ====================================================================== members
export const createMember = authed.inputValidator(memberInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("members")
    .insert({ ...(nullify(data) as Tables["members"]["Insert"]), owner_user_id: context.userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const updateMember = authed.inputValidator(memberUpdateSchema).handler(async ({ data, context }) => {
  const { id, ...rest } = data;
  const { data: row, error } = await context.supabase
    .from("members")
    .update(nullify(rest) as Tables["members"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteMember = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("members").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

/** Define (upsert) a participação de um sócio em uma entidade. */
export const upsertShare = authed.inputValidator(shareInputSchema).handler(async ({ data, context }) => {
  const { data: existing, error: readError } = await context.supabase
    .from("entity_shares")
    .select("id")
    .eq("entity_id", data.entity_id)
    .eq("member_id", data.member_id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing) {
    const { data: row, error } = await context.supabase
      .from("entity_shares")
      .update({ share_percentage: data.share_percentage })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  }

  const { data: row, error } = await context.supabase
    .from("entity_shares")
    .insert({
      entity_id: data.entity_id,
      member_id: data.member_id,
      share_percentage: data.share_percentage,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteShare = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("entity_shares").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

// ======================================================= document workflow
export const updateDocument = authed
  .inputValidator(documentUpdateSchema)
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase
      .from("documents")
      .update(nullify(rest) as Tables["documents"]["Update"])
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ====================================================== custódia (wave 4)

export const createAccount = authed.inputValidator(accountInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("accounts")
    .insert(nullify(data) as Tables["accounts"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteAccount = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("accounts").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

export const createPosition = authed.inputValidator(positionInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("positions")
    .insert(nullify(data) as Tables["positions"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const updatePosition = authed.inputValidator(positionUpdateSchema).handler(async ({ data, context }) => {
  const { id, ...rest } = data;
  const { data: row, error } = await context.supabase
    .from("positions")
    .update(nullify(rest) as Tables["positions"]["Update"])
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deletePosition = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("positions").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

export const createCashFlow = authed.inputValidator(cashFlowInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("cash_flows")
    .insert(nullify(data) as Tables["cash_flows"]["Insert"])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

export const deleteCashFlow = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("cash_flows").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});

/** Snapshot é idempotente por (entity_id, as_of): reenviar o mesmo mês atualiza. */
export const upsertSnapshot = authed.inputValidator(snapshotInputSchema).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase
    .from("portfolio_snapshots")
    .upsert(data as Tables["portfolio_snapshots"]["Insert"], { onConflict: "entity_id,as_of" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return row;
});

/**
 * Gera a série de snapshots a partir das posições atuais, um ponto por mês.
 * Serve para o TWR ter base histórica sem integração de custódia.
 */
export const rebuildSnapshots = authed
  .inputValidator(z.object({ entity_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: positions, error: positionsError } = await context.supabase
      .from("positions")
      .select("quantity, unit_price, cost_basis")
      .eq("entity_id", data.entity_id);
    if (positionsError) throw new Error(positionsError.message);

    const marketValue = (positions ?? []).reduce(
      (sum, p) => sum + Number(p.quantity ?? 0) * Number(p.unit_price ?? 0),
      0,
    );
    const costBasis = (positions ?? []).reduce((sum, p) => sum + Number(p.cost_basis ?? 0), 0);

    const today = new Date();
    const rows: Tables["portfolio_snapshots"]["Insert"][] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i + 1, 0));
      rows.push({
        entity_id: data.entity_id,
        as_of: date.toISOString().slice(0, 10),
        // Sem histórico de preço, repetimos o valor atual (série plana e honesta).
        market_value: Math.round(marketValue * 100) / 100,
        cost_basis: Math.round(costBasis * 100) / 100,
        net_flow: 0,
        source: "rebuild",
      });
    }

    const { error } = await context.supabase
      .from("portfolio_snapshots")
      .upsert(rows, { onConflict: "entity_id,as_of" });
    if (error) throw new Error(error.message);
    return { ok: true as const, count: rows.length };
  });

export const createTaxScenario = authed
  .inputValidator(taxScenarioInputSchema)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tax_scenarios")
      .insert(nullify(data) as Tables["tax_scenarios"]["Insert"])
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTaxScenario = authed.inputValidator(idSchema).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from("tax_scenarios").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
});
