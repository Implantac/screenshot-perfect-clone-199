/**
 * Validadores compartilhados entre cliente (forms) e servidor (server functions).
 * Módulo puro — sem imports de Vite/Supabase, seguro para os dois lados.
 */
import { z } from "zod";

export const assetTypeEnum = z.enum(["urbano", "rural", "veiculo", "outro"]);
export const complianceStatusEnum = z.enum(["regular", "pendente", "alerta", "critico"]);
export const riskSeverityEnum = z.enum(["low", "medium", "high", "critical"]);
export const transactionTypeEnum = z.enum(["income", "expense"]);
export const actionPlanPriorityEnum = z.enum(["P1", "P2", "P3"]);
export const actionPlanStatusEnum = z.enum(["pending", "in_progress", "completed"]);
export const supplierStatusEnum = z.enum(["homologado", "em_analise", "risco_critico", "inativo"]);
export const legalCaseStatusEnum = z.enum(["em_andamento", "suspenso", "acordo", "encerrado"]);
export const legalCaseTypeEnum = z.enum([
  "civel",
  "tributario",
  "ambiental",
  "trabalhista",
  "societario",
  "imobiliario",
]);

const uuid = z.string().uuid("Selecione um registro válido.");
const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null ? undefined : v));

const money = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : v))
  .refine((v) => Number.isFinite(v) && v >= 0, "Informe um valor monetário válido.");

const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === "" || v === null ? undefined : v))
  .refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), "Data inválida.");

const text = (max = 160) => z.string().trim().min(2, "Informe ao menos 2 caracteres.").max(max);

// ----------------------------------------------------------------------------- entities
export const entityInputSchema = z.object({
  name: text(120),
  tax_id: z.string().trim().max(24).optional().or(z.literal("")),
  type: z.string().trim().max(60).optional().or(z.literal("")),
  founded_at: optionalDate,
  compliance_score: z.coerce.number().min(0).max(100).optional(),
});
export type EntityInput = z.input<typeof entityInputSchema>;

// ------------------------------------------------------------------------------- assets
export const assetInputSchema = z.object({
  name: text(120),
  type: assetTypeEnum.default("outro"),
  entity_id: uuid,
  value: money,
  location: z.string().trim().max(120).optional().or(z.literal("")),
  area: z.string().trim().max(40).optional().or(z.literal("")),
  registration_number: z.string().trim().max(60).optional().or(z.literal("")),
  status: complianceStatusEnum.default("regular"),
  health_score: z.coerce.number().min(0).max(100).optional(),
});
export type AssetInput = z.input<typeof assetInputSchema>;

export const assetUpdateSchema = assetInputSchema.partial().extend({ id: uuid });
export type AssetUpdateInput = z.input<typeof assetUpdateSchema>;

// -------------------------------------------------------------------------------- risks
export const riskInputSchema = z.object({
  title: text(160),
  description: z.string().trim().max(600).optional().or(z.literal("")),
  severity: riskSeverityEnum.default("medium"),
  entity_id: uuid,
  asset_id: optionalUuid,
  responsible_id: optionalUuid,
  due_date: optionalDate,
});
export type RiskInput = z.input<typeof riskInputSchema>;

export const riskUpdateSchema = riskInputSchema.partial().extend({ id: uuid });
export type RiskUpdateInput = z.input<typeof riskUpdateSchema>;

// ---------------------------------------------------------------------------- documents
export const documentInputSchema = z.object({
  title: text(160),
  type: z.string().trim().max(60).optional().or(z.literal("")),
  entity_id: uuid,
  asset_id: optionalUuid,
  expiry_date: optionalDate,
});
export type DocumentInput = z.input<typeof documentInputSchema>;

// ------------------------------------------------------------------------- transactions
export const transactionInputSchema = z.object({
  title: text(160),
  entity_id: uuid,
  asset_id: optionalUuid,
  amount: money.refine((v) => v > 0, "O valor deve ser maior que zero."),
  type: transactionTypeEnum.default("expense"),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  transaction_date: optionalDate,
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

// ---------------------------------------------------------------------- suppliers
export const supplierInputSchema = z.object({
  name: text(120),
  entity_id: uuid,
  tax_id: z.string().trim().max(24).optional().or(z.literal("")),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  contact_email: z
    .union([z.string().trim().email("E-mail inválido."), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  contact_phone: z.string().trim().max(24).optional().or(z.literal("")),
  status: supplierStatusEnum.default("em_analise"),
  compliance_score: z.coerce.number().min(0).max(100).optional(),
  contract_value: money.optional(),
  contract_expiry: optionalDate,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type SupplierInput = z.input<typeof supplierInputSchema>;
export const supplierUpdateSchema = supplierInputSchema.partial().extend({ id: uuid });

// ------------------------------------------------------------------- legal cases
export const legalCaseInputSchema = z.object({
  case_number: text(60),
  title: text(160),
  entity_id: uuid,
  asset_id: optionalUuid,
  type: legalCaseTypeEnum.default("civel"),
  status: legalCaseStatusEnum.default("em_andamento"),
  court: z.string().trim().max(120).optional().or(z.literal("")),
  risk_level: riskSeverityEnum.default("medium"),
  value_at_stake: money.optional(),
  next_hearing: optionalDate,
  responsible_id: optionalUuid,
  notes: z.string().trim().max(600).optional().or(z.literal("")),
});
export type LegalCaseInput = z.input<typeof legalCaseInputSchema>;
export const legalCaseUpdateSchema = legalCaseInputSchema.partial().extend({ id: uuid });

// ------------------------------------------------------------------------ members
export const memberInputSchema = z.object({
  full_name: text(120),
  email: z
    .union([z.string().trim().email("E-mail inválido."), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  tax_id: z.string().trim().max(20).optional().or(z.literal("")),
  role: z.string().trim().max(40).optional().or(z.literal("")),
});
export type MemberInput = z.input<typeof memberInputSchema>;
export const memberUpdateSchema = memberInputSchema.partial().extend({ id: uuid });

export const shareInputSchema = z.object({
  entity_id: uuid,
  member_id: uuid,
  share_percentage: z.coerce
    .number()
    .min(0, "Percentual mínimo 0%.")
    .max(100, "Percentual máximo 100%."),
});
export type ShareInput = z.input<typeof shareInputSchema>;

// ------------------------------------------------------------ document workflow
export const documentUpdateSchema = z.object({
  id: uuid,
  status: complianceStatusEnum.optional(),
  expiry_date: optionalDate,
});
export type DocumentUpdateInput = z.input<typeof documentUpdateSchema>;

// ---------------------------------------------------------------------- action plans
export const actionPlanUpdateSchema = z.object({
  id: uuid,
  status: actionPlanStatusEnum,
  priority: actionPlanPriorityEnum.optional(),
});
export type ActionPlanUpdateInput = z.input<typeof actionPlanUpdateSchema>;

// --------------------------------------------------------------------------- jarvis
export const jarvisAskSchema = z.object({
  message: z.string().trim().min(2, "Escreva uma pergunta.").max(1200),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(12)
    .optional(),
});
export type JarvisAskInput = z.input<typeof jarvisAskSchema>;

/** Primeiro erro legível de um ZodError (para toast). */
export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Dados inválidos.";
}
