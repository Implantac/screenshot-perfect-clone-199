/**
 * Observabilidade — Server Functions (wave 26).
 *
 * Duas portas, de propósito:
 *   - `reportClientEvent`: qualquer sessão autenticada grava o próprio erro de
 *     tela. Só `kind: 'client'`; ninguém carimba `security` para inflar painel.
 *   - `getHealthPanel`: leitura do painel. Só admin, checado com `has_role` no
 *     servidor **e** com a policy de RLS do banco — a segunda camada existe
 *     porque mensagem de erro, mesmo depurada, pode revelar rotina interna.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportFromClient } from "@/lib/observability/report.server";
import {
  summarizeEvents,
  type EventSummary,
  type IntegrationStatus,
  type SystemEvent,
} from "@/lib/observability/telemetry";
import { integrationStatuses } from "@/lib/observability/telemetry";

const MIGRATION = "20261030310000_system_events.sql";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

const clientEventInput = z.object({
  source: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(600),
  route: z.string().trim().max(120).optional(),
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export type ClientEventPayload = { accepted: boolean; note?: string };

export const reportClientEvent = authed
  .inputValidator(clientEventInput)
  .handler(async ({ data }): Promise<ClientEventPayload> => {
    const result = await reportFromClient({
      kind: "client",
      source: data.source,
      message: data.message,
      severity: "info",
      context: { ...(data.context ?? {}), route: data.route ?? null },
    });

    return { accepted: result.stored || result.forwarded, note: result.note };
  });

export type HealthPanelRow = {
  fingerprint: string;
  kind: string;
  severity: string;
  source: string;
  message: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
};

export type HealthPanelPayload = {
  isAdmin: boolean;
  /** `true` quando a migration 310000 ainda não foi aplicada. */
  migrationPending: string | null;
  summary: EventSummary;
  top: HealthPanelRow[];
  recent: {
    id: string;
    kind: string;
    severity: string;
    source: string;
    message: string;
    context: Record<string, string | number | boolean | null>;
    occurredAt: string;
  }[];
  integrations: IntegrationStatus[];
  generatedAt: string;
};

async function isAdmin(context: { supabase: { rpc: (name: never, args?: never) => Promise<{ data: unknown }> }; claims?: unknown }): Promise<boolean> {
  const userId = (context.claims as { sub?: string } | undefined)?.sub;
  if (!userId) return false;
  try {
    const { data } = await context.supabase.rpc("has_role" as never, {
      _user_id: userId,
      _role: "admin",
    } as never);
    return Boolean(data);
  } catch {
    return false;
  }
}

export const getHealthPanel = authed
  .inputValidator(
    z.object({
      hours: z.coerce.number().int().min(1).max(720).default(24),
      limit: z.coerce.number().int().min(1).max(200).default(40),
    }),
  )
  .handler(async ({ data, context }): Promise<HealthPanelPayload> => {
    const admin = await isAdmin(context as never);

    const base: HealthPanelPayload = {
      isAdmin: admin,
      migrationPending: null,
      summary: summarizeEvents([]),
      top: [],
      recent: [],
      // Status de integração é do processo, não do banco: só admin precisa ver.
      integrations: admin ? integrationStatuses(process.env) : [],
      generatedAt: new Date().toISOString(),
    };

    if (!admin) {
      return { ...base, migrationPending: null };
    }

    const [counts, recent] = await Promise.all([
      context.supabase.rpc("system_event_counts" as never, { _hours: data.hours } as never),
      context.supabase.rpc("system_events_recent" as never, { _limit: data.limit } as never),
    ]);

    const firstError = counts.error ?? recent.error;
    if (firstError) {
      if (/does not exist|schema cache|relation|function/i.test(firstError.message)) {
        return { ...base, migrationPending: MIGRATION };
      }
      throw new Error(firstError.message);
    }

    const top = ((counts.data ?? []) as HealthPanelRow[]).map((row) => ({
      fingerprint: row.fingerprint,
      kind: row.kind,
      severity: row.severity,
      source: row.source,
      message: row.message,
      occurrences: Number(row.occurrences ?? 0),
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen,
    }));

    const events: SystemEvent[] = top.map((row) => ({
      kind: row.kind as SystemEvent["kind"],
      severity: row.severity as SystemEvent["severity"],
      source: row.source,
      message: row.message,
      context: {},
      occurredAt: row.lastSeen,
      fingerprint: row.fingerprint,
    }));

    return {
      ...base,
      summary: summarizeEvents(events),
      top,
      recent: (
        (recent.data ?? []) as {
          id: string;
          kind: string;
          severity: string;
          source: string;
          message: string;
          context: Record<string, string | number | boolean | null>;
          occurred_at: string;
        }[]
      ).map((row) => ({
        id: row.id,
        kind: row.kind,
        severity: row.severity,
        source: row.source,
        message: row.message,
        context: row.context ?? {},
        occurredAt: row.occurred_at,
      })),
    };
  });

/**
 * Limpeza manual de retenção. A RPC já exige admin; aqui só embrulhamos para
 * que o painel possa oferecer o botão sem SQL.
 */
export const purgeOldEvents = authed
  .inputValidator(z.object({ days: z.coerce.number().int().min(1).max(365).default(90) }))
  .handler(async ({ data, context }): Promise<{ removed: number; note?: string }> => {
    const { data: removed, error } = await context.supabase.rpc(
      "purge_system_events" as never,
      { _days: data.days } as never,
    );

    if (error) {
      return { removed: 0, note: error.message };
    }
    return { removed: Number(removed ?? 0) };
  });
