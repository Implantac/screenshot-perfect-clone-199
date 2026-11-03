/**
 * Segurança de acesso — leitura da política e do estado de MFA do usuário.
 *
 * A lista de fatores vem da função `my_mfa_factors()` (SECURITY DEFINER, filtra
 * por `auth.uid()`): o cliente nunca enxerga `auth.mfa_factors` diretamente, e a
 * tela não precisa de service role para saber se a pessoa tem segundo fator.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_SECURITY_POLICY, type SecurityPolicy } from "@/lib/security/policy";
import {
  assessIsolation,
  type IsolationPolicyRow,
  type IsolationReport,
  type OrphanRow,
} from "@/lib/security/isolation";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

export type SecurityState = {
  policy: SecurityPolicy;
  /** Fatores TOTP verificados do usuário. */
  verifiedFactors: number;
  /** `aal` do JWT: aal1 (só senha) ou aal2 (segundo fator usado agora). */
  aal: "aal1" | "aal2";
  isAdmin: boolean;
  /** Preenchido quando a migration ainda não foi aplicada. */
  migrationPending?: string;
};

export const getSecurityState = authed.handler(async ({ context }): Promise<SecurityState> => {
  const aal = (String((context.claims as { aal?: string })?.aal ?? "aal1") === "aal2"
    ? "aal2"
    : "aal1") as "aal1" | "aal2";

  let policy: SecurityPolicy = DEFAULT_SECURITY_POLICY;
  let migrationPending: string | undefined;

  const { data: policyRow, error: policyError } = await context.supabase
    .from("security_policies")
    .select("*")
    .maybeSingle();

  if (policyError) {
    // A tabela é nova: o app continua funcionando com a política padrão.
    if (!/does not exist|schema cache|relation/i.test(policyError.message)) {
      throw new Error(policyError.message);
    }
    migrationPending = "20261030220000_auth_security.sql";
  } else if (policyRow) {
    policy = {
      mfa_required_admin: Boolean(policyRow.mfa_required_admin),
      mfa_required_portal: Boolean(policyRow.mfa_required_portal),
      mfa_grace_days: Number(policyRow.mfa_grace_days ?? 7),
      min_password_length: Number(policyRow.min_password_length ?? 12),
      require_mixed_case: Boolean(policyRow.require_mixed_case),
      require_number: Boolean(policyRow.require_number),
      require_symbol: Boolean(policyRow.require_symbol),
      block_common_passwords: Boolean(policyRow.block_common_passwords),
      password_history: Number(policyRow.password_history ?? 5),
      max_failed_attempts: Number(policyRow.max_failed_attempts ?? 5),
      session_timeout_minutes: Number(policyRow.session_timeout_minutes ?? 480),
    } as SecurityPolicy;
  }

  let verifiedFactors = 0;
  const { data: factors, error: factorError } = await context.supabase.rpc("my_mfa_factors");
  if (!factorError && Array.isArray(factors)) {
    verifiedFactors = factors.length;
  }

  const { data: adminCheck } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  return {
    policy,
    verifiedFactors,
    aal,
    isAdmin: Boolean(adminCheck),
    migrationPending,
  };
});

export const updateSecurityPolicy = authed
  .validator(
    z.object({
      mfa_required_admin: z.boolean(),
      mfa_required_portal: z.boolean(),
      min_password_length: z.number().int().min(6).max(72),
      require_mixed_case: z.boolean(),
      require_number: z.boolean(),
      require_symbol: z.boolean(),
      block_common_passwords: z.boolean(),
      password_history: z.number().int().min(0).max(24),
      session_timeout_minutes: z.number().int().min(15).max(10080),
      max_failed_attempts: z.number().int().min(3).max(20),
      mfa_grace_days: z.number().int().min(0).max(90),
    }),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("security_policies")
      .update({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ------------------------------------------------------------- isolamento (wave 23)

/**
 * Estado do isolamento entre tenants.
 *
 * Lê `patrium_isolation_audit()` (metadados de policy — não dado de cliente) e,
 * se a pessoa for admin, `patrium_orphan_counts()`. A contagem de órfãos é
 * restrita porque revela volume de dados de outros tenants; o veredito de
 * policy não revela dado nenhum e serve para qualquer sessão autenticada.
 */
export const getIsolationReport = authed.handler(async ({ context }): Promise<IsolationReport> => {
  const audit = await context.supabase.rpc("patrium_isolation_audit" as never);
  if (audit.error) {
    // Migration pendente: o relatório sai vazio e avisa qual migration aplicar,
    // em vez de derrubar a tela de segurança inteira.
    return assessIsolation({ policies: [] });
  }

  const policies = (audit.data ?? []) as unknown as IsolationPolicyRow[];

  let orphans: OrphanRow[] = [];
  const orphan = await context.supabase.rpc("patrium_orphan_counts" as never);
  if (!orphan.error) {
    orphans = (orphan.data ?? []) as unknown as OrphanRow[];
  }

  return assessIsolation({ policies, orphans });
});
