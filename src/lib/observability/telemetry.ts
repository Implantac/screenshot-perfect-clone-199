/**
 * Observabilidade sem fornecedor (wave 26).
 *
 * O problema real: até aqui, quando algo quebrava em produção, o rastro era
 * `console.error` no servidor e a mensagem genérica na tela. Sem saber **o que**
 * falhou, **onde** e **com que frequência**, cada incidente virava arqueologia.
 *
 * A decisão de desenho foi não amarrar o produto a um fornecedor: os eventos são
 * estruturados aqui, gravados em `system_events` (Supabase, com RLS de admin) e
 * opcionalmente encaminhados para um webhook (`OBSERVABILITY_WEBHOOK_URL`), que é
 * o ponto onde Sentry/Datadog entram se o cliente já tiver um.
 *
 * Duas regras que este módulo aplica antes de qualquer coisa sair do servidor:
 *
 *  1. **Nada de dado pessoal no evento.** E-mail, CPF/CNPJ, token, UUID de
 *     cliente, valor monetário e nome de família são substituídos na origem
 *     (`scrub`). Log de erro é o lugar clássico onde PII vaza sem ninguém notar.
 *  2. **Evento é diagnóstico, não trilha.** A trilha de auditoria (waves 20–25)
 *     prova o que aconteceu com os dados; o evento diz se o sistema está de pé.
 *     Misturar os dois encareceria a trilha e enfraqueceria a prova.
 *
 * Tudo aqui é função pura — o servidor só grava o resultado.
 */

export type EventKind = "error" | "slow" | "integration" | "security" | "client";

export type EventSeverity = "info" | "warning" | "critical";

export type SystemEvent = {
  kind: EventKind;
  severity: EventSeverity;
  /** Origem curta e estável: `jarvis.ask`, `office.consolidation`, `route./agro`. */
  source: string;
  /** Mensagem legível, já depurada de PII. */
  message: string;
  /** Contexto técnico (status HTTP, código do banco, duração). */
  context: Record<string, string | number | boolean | null>;
  /** Quando ocorreu (ISO). */
  occurredAt: string;
  /** Impressão digital para agrupar ocorrências iguais. */
  fingerprint: string;
};

// --------------------------------------------------------------------------
// Depuração de PII
// --------------------------------------------------------------------------

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const DOCUMENT = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/**
 * Token com rótulo: aceita `authorization: bearer <token>` (o separador é o
 * "bearer" seguido de espaço, não dois-pontos) e `api_key=<valor>`.
 */
const BEARER = /\b(?:bearer\s+|(?:token|apikey|api_key|secret|password)\s*[:=]\s*)[^\s,;"']+/gi;
/** Valores monetários em reais: o número sozinho já identifica a família. */
const MONEY = /R\$\s?[\d.]+(?:,\d{2})?/g;

/**
 * Remove/anonimiza dado pessoal de um texto.
 *
 * A ordem importa: e-mail antes de documento (e-mail pode conter dígitos),
 * token antes de tudo (o resto do token pode casar com outros padrões).
 */
export function scrub(value: string): string {
  return value
    .replace(BEARER, "[segredo removido]")
    .replace(EMAIL, "[e-mail removido]")
    .replace(DOCUMENT, "[documento removido]")
    .replace(UUID, "[id removido]")
    .replace(MONEY, "[valor removido]");
}

/** Depura também as chaves do contexto e trunca valores longos. */
export function scrubContext(context: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === null || value === undefined) {
      out[key] = null;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else {
      out[key] = scrub(String(value)).slice(0, 400);
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Construção e classificação
// --------------------------------------------------------------------------

/** Hash estável para agrupar ocorrências iguais (não é segurança, é agrupamento). */
export function fingerprintOf(parts: { kind: string; source: string; message: string }): string {
  const text = `${parts.kind}|${parts.source}|${parts.message}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export type CreateEventInput = {
  kind: EventKind;
  source: string;
  message: string;
  severity?: EventSeverity;
  context?: Record<string, unknown>;
  occurredAt?: string;
};

export function createEvent(input: CreateEventInput): SystemEvent {
  const message = scrub(input.message).slice(0, 600);
  const severity = input.severity ?? classifySeverity(input.kind, message);
  return {
    kind: input.kind,
    severity,
    source: input.source.slice(0, 80),
    message,
    context: scrubContext(input.context ?? {}),
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    fingerprint: fingerprintOf({ kind: input.kind, source: input.source, message }),
  };
}

/**
 * Severidade padrão por tipo. `error` só é crítico quando a mensagem indica
 * indisponibilidade — erro de validação de formulário não deve acordar ninguém.
 */
export function classifySeverity(kind: EventKind, message: string): EventSeverity {
  const text = message.toLowerCase();
  if (kind === "security") return "critical";
  if (kind === "error") {
    if (/(unauthorized|forbidden|401|403|inválid|invalid)/.test(text) && !/(database|connect|timeout)/.test(text)) {
      return "warning";
    }
    return "critical";
  }
  if (kind === "slow") return "warning";
  if (kind === "integration") return "warning";
  return "info";
}

/** Erro de aplicação → evento, sem deixar a mensagem crua escapar. */
export function eventFromError(
  error: unknown,
  input: { source: string; kind?: EventKind; context?: Record<string, unknown> },
): SystemEvent {
  const message = error instanceof Error ? error.message : String(error);
  return createEvent({
    kind: input.kind ?? "error",
    source: input.source,
    message,
    context: {
      ...input.context,
      errorName: error instanceof Error ? error.name : typeof error,
    },
  });
}

// --------------------------------------------------------------------------
// Limites: amostragem e orçamento por minuto
// --------------------------------------------------------------------------

/**
 * Amostragem determinística por fingerprint.
 *
 * Em pico de erro (uma migration pendente gera milhares), gravar tudo custa
 * banco e não ajuda: 1 em N já mostra o padrão. Determinística pelo fingerprint
 * para que o mesmo erro seja sempre amostrado igual — senão o gráfico mente.
 */
export function shouldSample(fingerprint: string, rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  const bucket = parseInt(fingerprint.slice(0, 4), 16) / 0xffff;
  return bucket < rate;
}

/** Janela móvel simples de contagem por minuto (usada no servidor). */
export function createRateLimiter(limitPerMinute: number, now: () => number = Date.now) {
  let windowStart = 0;
  let count = 0;
  return function allow(): boolean {
    const current = Math.floor(now() / 60_000);
    if (current !== windowStart) {
      windowStart = current;
      count = 0;
    }
    if (count >= limitPerMinute) return false;
    count += 1;
    return true;
  };
}

// --------------------------------------------------------------------------
// Sumarização (painel de saúde)
// --------------------------------------------------------------------------

export type EventSummary = {
  total: number;
  bySeverity: Record<EventSeverity, number>;
  byKind: { kind: EventKind; count: number }[];
  /** Erros agrupados, do mais frequente para o menos. */
  top: { fingerprint: string; source: string; message: string; count: number; lastSeen: string; severity: EventSeverity }[];
  lastEventAt: string | null;
  status: "ok" | "degradado" | "fora";
  headline: string;
};

export function summarizeEvents(events: SystemEvent[]): EventSummary {
  const bySeverity: Record<EventSeverity, number> = { info: 0, warning: 0, critical: 0 };
  const byKindMap = new Map<EventKind, number>();
  const groups = new Map<string, { source: string; message: string; count: number; lastSeen: string; severity: EventSeverity }>();

  for (const event of events) {
    bySeverity[event.severity] += 1;
    byKindMap.set(event.kind, (byKindMap.get(event.kind) ?? 0) + 1);
    const current = groups.get(event.fingerprint);
    if (current) {
      current.count += 1;
      if (event.occurredAt > current.lastSeen) current.lastSeen = event.occurredAt;
    } else {
      groups.set(event.fingerprint, {
        source: event.source,
        message: event.message,
        count: 1,
        lastSeen: event.occurredAt,
        severity: event.severity,
      });
    }
  }

  const top = Array.from(groups.entries())
    .map(([fingerprint, group]) => ({ fingerprint, ...group }))
    .sort((a, b) => b.count - a.count || (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, 8);

  const lastEventAt = events.reduce<string | null>(
    (latest, event) => (latest === null || event.occurredAt > latest ? event.occurredAt : latest),
    null,
  );

  const status: EventSummary["status"] =
    bySeverity.critical > 0 ? "fora" : bySeverity.warning > 0 ? "degradado" : "ok";

  const headline =
    events.length === 0
      ? "Nenhum evento registrado na janela."
      : bySeverity.critical > 0
        ? `${bySeverity.critical} evento(s) crítico(s) na janela — o sistema está degradado, não "só com erro".`
        : bySeverity.warning > 0
          ? `${bySeverity.warning} aviso(s) na janela; nenhum crítico.`
          : "Somente eventos informativos: operação normal.";

  return {
    total: events.length,
    bySeverity,
    byKind: Array.from(byKindMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count),
    top,
    lastEventAt,
    status,
    headline,
  };
}

/**
 * Saúde das integrações a partir das variáveis de ambiente.
 *
 * Não faz chamada de rede: responde "está configurado?", que é a pergunta que o
 * operador faz primeiro. Testar o provedor de IA a cada visita ao painel custaria
 * dinheiro e latência — quem quiser testar roda `bun run verify:llm`.
 */
export type IntegrationStatus = {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  severity: "ok" | "warning" | "critical";
};

export function integrationStatuses(env: Record<string, string | undefined>): IntegrationStatus[] {
  const has = (name: string) => Boolean(env[name] && String(env[name]).trim().length > 5);

  const llmProvider = env.JARVIS_LLM_PROVIDER ?? (has("OPENAI_API_KEY") ? "openai" : has("ANTHROPIC_API_KEY") ? "anthropic" : has("GEMINI_API_KEY") ? "gemini" : "local");
  const llmConfigured = llmProvider !== "local" && (has("JARVIS_LLM_API_KEY") || has("OPENAI_API_KEY") || has("ANTHROPIC_API_KEY") || has("GEMINI_API_KEY"));

  const asymmetric = has("AUDIT_SIGNING_PRIVATE_KEY") && has("AUDIT_SIGNING_PUBLIC_KEY");
  const hmac = has("AUDIT_SIGNING_SECRET");

  return [
    {
      key: "supabase",
      label: "Supabase (dados)",
      configured: has("SUPABASE_URL") && has("SUPABASE_PUBLISHABLE_KEY"),
      detail: has("SUPABASE_URL")
        ? "URL e chave publicável presentes."
        : "Sem SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY: nada funciona.",
      severity: has("SUPABASE_URL") && has("SUPABASE_PUBLISHABLE_KEY") ? "ok" : "critical",
    },
    {
      key: "llm",
      label: "Provedor de IA (JARVIS)",
      configured: llmConfigured,
      detail: llmConfigured
        ? `Provedor ${llmProvider} configurado.`
        : "Sem chave: o JARVIS responde pelo analista local (as ferramentas continuam funcionando).",
      severity: llmConfigured ? "ok" : "warning",
    },
    {
      key: "signing",
      label: "Assinatura de âncoras",
      configured: asymmetric || hmac,
      detail: asymmetric
        ? "ECDSA P-256: o auditor verifica sozinho."
        : hmac
          ? "HMAC-SHA256 (simétrico): o auditor depende do segredo. Migre para o par de chaves."
          : "Sem chave: âncoras são emitidas sem assinatura e a tela informa isso.",
      severity: asymmetric ? "ok" : hmac ? "warning" : "warning",
    },
    {
      key: "webhook",
      label: "Encaminhamento de eventos",
      configured: has("OBSERVABILITY_WEBHOOK_URL"),
      detail: has("OBSERVABILITY_WEBHOOK_URL")
        ? "Eventos são gravados no banco e encaminhados ao webhook."
        : "Só no banco. Configure OBSERVABILITY_WEBHOOK_URL para enviar ao seu Sentry/Datadog.",
      severity: "ok",
    },
    {
      key: "quotes",
      label: "Cotações (opcional)",
      configured: has("BRAPI_TOKEN"),
      detail: has("BRAPI_TOKEN") ? "Token de cotações presente." : "Opcional: sem token, cotações usam a fonte pública.",
      severity: "ok",
    },
  ];
}
