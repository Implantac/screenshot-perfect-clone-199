/**
 * Server functions do dataset de demonstração.
 *
 * O seed roda com o client do próprio usuário (JWT via requireSupabaseAuth), e não
 * com service_role: é assim que se prova que as políticas de RLS de ownership
 * (`owner_user_id` / `owns_entity`) estão corretas — todo INSERT passa por elas.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { seedDemoData, type SeedResult } from "@/lib/demo/seedDemo";

export const seedDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ force: z.boolean().optional() }).optional())
  .handler(async ({ data, context }): Promise<SeedResult> => {
    return seedDemoData(context.supabase, { force: data?.force ?? false });
  });
