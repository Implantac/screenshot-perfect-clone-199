/**
 * Gravação de evento de sistema — só no servidor (wave 26).
 *
 * Três destinos, nesta ordem de importância:
 *   1. `system_events` no próprio banco (sempre; é o que o painel /saude lê);
 *   2. webhook opcional (`OBSERVABILITY_WEBHOOK_URL`) para Sentry/Datadog/Slack;
 *   3. nada — se os dois falharem, o erro de observabilidade **nunca** sobe para
 *      quem chamou. Instrumentação que derruba a requisição é pior que ausência
 *      de instrumentação.
 *
 * Premissas declaradas:
 *   - O evento é diagnóstico, não trilha. Não entra em `audit_logs` e não é
 *     encadeado por hash; a prova do que aconteceu com os dados continua sendo
 *     a wave 20–25.
 *   - A PII sai depurada na origem (`scrub`), antes de qualquer gravação. O
 *     banco só reforça com retenção de 90 dias e leitura restrita a admin.
 *   - Amostragem determinística + teto por minuto: pico de erro não enche o
 *     banco, e o mesmo erro sempre amostra igual.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createRateLimiter,
  createEvent,
  eventFromError,
  integrationStatuses,
  shouldSample,
  summarizeEvents,
  type CreateEventInput,
  type EventSummary,
  type IntegrationStatus,
  type SystemEvent,
} from "@/lib/observability/telemetry";

/** 1 a cada 4 eventos por fingerprint — o suficiente para ver o padrão. */
const SAMPLE_RATE = Number(process.env.OBSERVABILITY_SAMPLE_RATE ?? "0.25");
/** Teto global por minuto: protege o banco de um laço de erro. */
const PER_MINUTE_CAP = Number(process.env.OBSERVABILITY_MAX_EVENTS_PER_MINUTE ?? "120");

const allowWrite = createRateLimiter(Number.isFinite(PER_MINUTE_CAP) ? PER_MINUTE_CAP : 120);

export type ReportResult = {
  /** `true` quando o evento foi gravado em `system_events`. */
  stored: boolean;
  /** `true` quando o webhook aceitou o evento. */
  forwarded: boolean;
  /** `true` quando o evento nem foi tentado (amostragem ou teto por minuto). */
  skipped: boolean;
  /** Mensagem curta e sem PII para quem chamou (nunca o erro cru). */
  note?: string;
};

function webhookUrl(): string | null {
  const url = process.env.OBSERVABILITY_WEBHOOK_URL?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url;
}

async function persist(event: SystemEvent): Promise<{ stored: boolean; note?: string }> {
  try {
    const { error } = await supabaseAdmin.from("system_events").insert({
      kind: event.kind,
      severity: event.severity,
      source: event.source,
      message: event.message,
      context: event.context as unknown as never,
      fingerprint: event.fingerprint,
      occurred_at: event.occurredAt,
    });

    if (error) {
      // Tabela ausente = migration 310000 ainda não aplicada. Não é erro fatal:
      // o app continua rodando, só sem painel de saúde.
      if (/does not exist|schema cache|relation/i.test(error.message)) {
        return { stored: false, note: "Migration 20261030310000_system_events.sql pendente." };
      }
      return { stored: false, note: error.message.slice(0, 200) };
    }

    return { stored: true };
  } catch (error) {
    return { stored: false, note: error instanceof Error ? error.message.slice(0, 200) : "falha ao gravar" };
  }
}

async function forward(event: SystemEvent): Promise<boolean> {
  const url = webhookUrl();
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // Formato neutro: `text` é o que Slack/Discord mostram, o resto é
        // estrutura para Datadog/Sentry custom.
        text: `[${event.severity}] ${event.source}: ${event.message}`,
        event,
        service: "patrium-os",
      }),
      // Webhook lento não pode segurar a requisição do usuário.
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Grava um evento já montado. Nunca lança. */
export async function reportEvent(event: SystemEvent): Promise<ReportResult> {
  if (!shouldSample(event.fingerprint, Number.isFinite(SAMPLE_RATE) ? SAMPLE_RATE : 0.25)) {
    return { stored: false, forwarded: false, skipped: true, note: "Amostragem: este erro já está representado." };
  }

  if (!allowWrite()) {
    return {
      stored: false,
      forwarded: false,
      skipped: true,
      note: "Teto de eventos por minuto atingido (proteção contra laço de erro).",
    };
  }

  const [persisted, forwarded] = await Promise.all([persist(event), forward(event)]);

  return {
    stored: persisted.stored,
    forwarded,
    skipped: false,
    note: persisted.note,
  };
}

/** Monta e grava. Caminho principal usado pelas Server Functions. */
export async function report(input: CreateEventInput): Promise<ReportResult> {
  return reportEvent(createEvent(input));
}

/** Converte a exceção em evento, grava e devolve o resultado. Nunca lança. */
export async function reportError(
  error: unknown,
  input: Omit<CreateEventInput, "message" | "kind"> & { kind?: CreateEventInput["kind"] },
): Promise<ReportResult> {
  return reportEvent(eventFromError(error, input));
}

/**
 * Caminho do cliente: qualquer sessão autenticada pode registrar o próprio
 * erro de tela. A depuração de PII acontece aqui também — o navegador não é
 * confiável, então `createEvent` roda de novo no servidor.
 */
export async function reportFromClient(input: CreateEventInput): Promise<ReportResult> {
  return report({ ...input, kind: input.kind === "error" ? "client" : input.kind });
}

/** Status das integrações — o mesmo cálculo do painel, para o health check. */
export function currentIntegrationStatuses(): IntegrationStatus[] {
  return integrationStatuses(process.env);
}

export type HealthSnapshot = {
  summary: EventSummary;
  statuses: IntegrationStatus[];
  /** `ok` só quando não há crítico e todas as integrações essenciais estão ok. */
  overall: "ok" | "degradado" | "fora";
  generatedAt: string;
};

/**
 * Instantâneo de saúde usado pelo endpoint `/api/health` e pelo painel.
 * Combina o que o banco reportou com o que o processo sabe de si mesmo: o
 * webhook pode mandar o app dormir, mas não adianta dizer "ok" se falta a
 * chave do Supabase.
 */
export function healthSnapshot(events: SystemEvent[]): HealthSnapshot {
  const summary = summarizeEvents(events);
  const statuses = currentIntegrationStatuses();
  const criticalIntegration = statuses.some((status) => status.severity === "critical");

  const overall: HealthSnapshot["overall"] =
    summary.status === "fora" || criticalIntegration
      ? "fora"
      : summary.status === "degradado" || statuses.some((status) => status.severity === "warning")
        ? "degradado"
        : "ok";

  return { summary, statuses, overall, generatedAt: new Date().toISOString() };
}
