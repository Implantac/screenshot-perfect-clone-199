/**
 * Escopos de detalhe e log de acesso do escritório (wave 24).
 *
 * A pergunta que este módulo responde: **o que exatamente o escritório pode ver
 * de cada família, e quem já olhou**. As duas coisas andam juntas — consentimento
 * sem registro é promessa; registro sem consentimento é vigilância.
 *
 * Decisões que estão aqui e não no SQL:
 *  - o `resumo` é obrigatório (é o agregado mínimo do consolidado) e não pode ser
 *    revogado; remover tudo quebraria a consolidação sem avisar;
 *  - sessão não reconhecida (`scope` desconhecido no log) é preservada como
 *    `outro` em vez de descartada — log não se "limpa";
 *  - o resumo de acessos destaca o padrão que importa numa conversa de
 *    governança: quantas vezes, por quem e se houve acesso negado por falta de
 *    escopo (tentativa de abrir além do consentido é sinal, não ruído).
 */

export const OFFICE_SCOPES = ["resumo", "custodia", "contencioso", "agro", "documentos", "riscos"] as const;

export type OfficeScope = (typeof OFFICE_SCOPES)[number];

export type ScopeDefinition = {
  key: OfficeScope;
  label: string;
  description: string;
  /** Escopo que nunca pode ser removido: é a base do consolidado. */
  required: boolean;
};

export const SCOPE_DEFINITIONS: ScopeDefinition[] = [
  {
    key: "resumo",
    label: "Resumo patrimonial",
    description: "Quantidade de entidades, valor dos ativos registrais e data da última atualização.",
    required: true,
  },
  {
    key: "custodia",
    label: "Custódia e dívida",
    description: "Posições financeiras por classe, total da custódia e saldo devedor. Sem nome de instituição.",
    required: false,
  },
  {
    key: "contencioso",
    label: "Contencioso",
    description: "Processos com tipo, situação, probabilidade e valor da causa. Sem nomes de partes.",
    required: false,
  },
  {
    key: "agro",
    label: "Agro",
    description: "Talhões com cultura, área, produtividade e custo por hectare.",
    required: false,
  },
  {
    key: "documentos",
    label: "Documentos",
    description: "Títulos, tipo, validade e situação. Sem arquivo anexado nem URL.",
    required: false,
  },
  {
    key: "riscos",
    label: "Riscos",
    description: "Riscos abertos com severidade e prazo.",
    required: false,
  },
];

export const SCOPE_BY_KEY = new Map(SCOPE_DEFINITIONS.map((definition) => [definition.key, definition]));

export const REQUIRED_SCOPES: OfficeScope[] = SCOPE_DEFINITIONS.filter((d) => d.required).map((d) => d.key);

/** Normaliza o que veio do banco (`text[]` pode chegar como string ou null). */
export function parseScopes(raw: unknown): OfficeScope[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.replace(/^\{|\}$/g, "").split(",")
      : [];

  const known = new Set<string>();
  for (const item of list) {
    const key = String(item).trim().toLowerCase();
    if ((OFFICE_SCOPES as readonly string[]).includes(key)) known.add(key);
  }
  // `resumo` é sempre concedido: é o mínimo do vínculo.
  for (const required of REQUIRED_SCOPES) known.add(required);
  return OFFICE_SCOPES.filter((scope) => known.has(scope));
}

export function hasScope(scopes: unknown, scope: OfficeScope): boolean {
  return parseScopes(scopes).includes(scope);
}

/**
 * Valida uma seleção de escopos vinda da UI.
 * Devolve a lista normalizada (ordem canônica) e os motivos de recusa.
 */
export function validateScopeSelection(selection: string[]): {
  ok: boolean;
  scopes: OfficeScope[];
  problems: string[];
} {
  const problems: string[] = [];
  const unknown = selection.filter((item) => !(OFFICE_SCOPES as readonly string[]).includes(item));
  if (unknown.length > 0) problems.push(`Escopo desconhecido: ${unknown.join(", ")}.`);

  const normalized = parseScopes(selection.filter((item) => (OFFICE_SCOPES as readonly string[]).includes(item)));
  if (normalized.length === REQUIRED_SCOPES.length) {
    // ok: resumo já entra automaticamente
  }
  return { ok: problems.length === 0, scopes: normalized, problems };
}

/** Escopos que faltam em relação ao que existe disponível. */
export function missingScopes(scopes: unknown): OfficeScope[] {
  const granted = parseScopes(scopes);
  return OFFICE_SCOPES.filter((scope) => !granted.includes(scope));
}

// ---------------------------------------------------------------------------
// Log de acesso
// ---------------------------------------------------------------------------

export type AccessLogRow = {
  id: string;
  office_name: string;
  reader_email: string | null;
  scope: string;
  action: string;
  created_at: string;
};

export type AccessLogEntry = {
  id: string;
  officeName: string;
  reader: string;
  scope: OfficeScope | "outro";
  scopeLabel: string;
  action: "abrir_detalhe" | "negado_sem_escopo" | "consolidado" | "outro";
  createdAt: string;
  daysAgo: number | null;
};

export type AccessSummary = {
  entries: AccessLogEntry[];
  totals: {
    entries: number;
    distinctReaders: number;
    denied: number;
    lastAccess: string | null;
    lastAccessDays: number | null;
  };
  byScope: { scope: string; label: string; count: number }[];
  byReader: { reader: string; count: number; lastAccess: string }[];
  flags: string[];
};

const ACTION_LABEL: Record<string, AccessLogEntry["action"]> = {
  abrir_detalhe: "abrir_detalhe",
  negado_sem_escopo: "negado_sem_escopo",
  consolidado: "consolidado",
};

function daysSince(iso: string, now: Date): number | null {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
}

/** Resume o log para a tela da família ("quem olhou meus dados"). */
export function summarizeAccessLog(rows: AccessLogRow[], options: { now?: Date } = {}): AccessSummary {
  const now = options.now ?? new Date();

  const entries: AccessLogEntry[] = rows
    .map((row) => {
      const scope: OfficeScope | "outro" = (OFFICE_SCOPES as readonly string[]).includes(row.scope)
        ? (row.scope as OfficeScope)
        : "outro";
      return {
        id: row.id,
        officeName: row.office_name,
        reader: row.reader_email ?? "membro do escritório",
        scope,
        scopeLabel: scope === "outro" ? row.scope : (SCOPE_BY_KEY.get(scope)?.label ?? row.scope),
        action: ACTION_LABEL[row.action] ?? "outro",
        createdAt: row.created_at,
        daysAgo: daysSince(row.created_at, now),
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const scopeCounts = new Map<string, number>();
  const readerCounts = new Map<string, { count: number; lastAccess: string }>();

  for (const entry of entries) {
    scopeCounts.set(entry.scope, (scopeCounts.get(entry.scope) ?? 0) + 1);
    const current = readerCounts.get(entry.reader);
    if (current) {
      current.count += 1;
      if (entry.createdAt > current.lastAccess) current.lastAccess = entry.createdAt;
    } else {
      readerCounts.set(entry.reader, { count: 1, lastAccess: entry.createdAt });
    }
  }

  const denied = entries.filter((entry) => entry.action === "negado_sem_escopo").length;
  const flags: string[] = [];

  if (denied > 0) {
    flags.push(
      `${denied} tentativa(s) de abrir seção sem escopo consentido. Nada foi exibido — mas vale conversar com o escritório.`,
    );
  }
  if (entries.length === 0) {
    flags.push("Nenhum acesso registrado: ninguém do escritório abriu o seu detalhe.");
  }

  const lastAccess = entries[0]?.createdAt ?? null;
  const lastAccessDays = lastAccess ? daysSince(lastAccess, now) : null;
  if (lastAccessDays !== null && lastAccessDays > 90) {
    flags.push(`Último acesso há ${lastAccessDays} dias: revise se o vínculo ainda faz sentido.`);
  }

  return {
    entries,
    totals: {
      entries: entries.length,
      distinctReaders: readerCounts.size,
      denied,
      lastAccess,
      lastAccessDays,
    },
    byScope: Array.from(scopeCounts.entries())
      .map(([scope, count]) => ({
        scope,
        label: (OFFICE_SCOPES as readonly string[]).includes(scope)
          ? (SCOPE_BY_KEY.get(scope as OfficeScope)?.label ?? scope)
          : scope,
        count,
      }))
      .sort((a, b) => b.count - a.count),
    byReader: Array.from(readerCounts.entries())
      .map(([reader, value]) => ({ reader, count: value.count, lastAccess: value.lastAccess }))
      .sort((a, b) => b.count - a.count),
    flags,
  };
}

// ---------------------------------------------------------------------------
// Detalhe devolvido pela RPC
// ---------------------------------------------------------------------------

export type FamilyDetailPositionClass = { class: string; positions: number; value: number };
export type FamilyDetailCase = { title: string; type: string; status: string; probability: number | null; value: number };
export type FamilyDetailField = {
  name: string;
  crop: string;
  area_ha: number;
  productivity_sc_ha: number | null;
  cost_per_ha: number | null;
};
export type FamilyDetailDocument = { title: string; type: string | null; expiry_date: string | null; status: string | null };
export type FamilyDetailRisk = { title: string; severity: string | null; status: string | null; due_date: string | null };

export type FamilyDetailSections = {
  resumo?: { entities: number; assetsValue: number; lastUpdate: string | null };
  custodia?: { total: number; byClass: FamilyDetailPositionClass[]; debt: number };
  contencioso?: { exposure: number; cases: FamilyDetailCase[] };
  agro?: { areaHa: number; fields: FamilyDetailField[] };
  documentos?: { expiring: number; overdue: number; items: FamilyDetailDocument[] };
  riscos?: { open: number; items: FamilyDetailRisk[] };
};

export type FamilyDetailPayload = {
  ownerUserId: string;
  label: string;
  officeId: string;
  scopes: OfficeScope[];
  sections: FamilyDetailSections;
  generatedAt: string;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Normaliza o payload da RPC.
 *
 * A RPC devolve `jsonb`; números grandes chegam como número, mas `numeric` do
 * Postgres pode chegar como string. Aqui tudo vira número **e** só as seções
 * consentidas sobrevivem — defesa em profundidade: se o SQL devolver algo além
 * do escopo, a UI não mostra.
 */
export function normalizeFamilyDetail(raw: unknown): FamilyDetailPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const ownerUserId = String(payload.ownerUserId ?? "");
  if (!ownerUserId) return null;

  const scopes = parseScopes(payload.scopes);
  const rawSections = (payload.sections ?? {}) as Record<string, Record<string, unknown>>;
  const sections: FamilyDetailSections = {};

  const allowed = (scope: OfficeScope) => scopes.includes(scope);

  if (allowed("resumo") && rawSections.resumo) {
    sections.resumo = {
      entities: num(rawSections.resumo.entities),
      assetsValue: num(rawSections.resumo.assetsValue),
      lastUpdate: (rawSections.resumo.lastUpdate as string | null) ?? null,
    };
  }

  if (allowed("custodia") && rawSections.custodia) {
    sections.custodia = {
      total: num(rawSections.custodia.total),
      debt: num(rawSections.custodia.debt),
      byClass: Array.isArray(rawSections.custodia.byClass)
        ? (rawSections.custodia.byClass as Record<string, unknown>[]).map((row) => ({
            class: String(row.class ?? "outros"),
            positions: num(row.positions),
            value: num(row.value),
          }))
        : [],
    };
  }

  if (allowed("contencioso") && rawSections.contencioso) {
    sections.contencioso = {
      exposure: num(rawSections.contencioso.exposure),
      cases: Array.isArray(rawSections.contencioso.cases)
        ? (rawSections.contencioso.cases as Record<string, unknown>[]).map((row) => ({
            title: String(row.title ?? "—"),
            type: String(row.type ?? "—"),
            status: String(row.status ?? "—"),
            probability: row.probability === null || row.probability === undefined ? null : num(row.probability),
            value: num(row.value),
          }))
        : [],
    };
  }

  if (allowed("agro") && rawSections.agro) {
    sections.agro = {
      areaHa: num(rawSections.agro.areaHa),
      fields: Array.isArray(rawSections.agro.fields)
        ? (rawSections.agro.fields as Record<string, unknown>[]).map((row) => ({
            name: String(row.name ?? "—"),
            crop: String(row.crop ?? "—"),
            area_ha: num(row.area_ha),
            productivity_sc_ha: row.productivity_sc_ha === null || row.productivity_sc_ha === undefined ? null : num(row.productivity_sc_ha),
            cost_per_ha: row.cost_per_ha === null || row.cost_per_ha === undefined ? null : num(row.cost_per_ha),
          }))
        : [],
    };
  }

  if (allowed("documentos") && rawSections.documentos) {
    sections.documentos = {
      expiring: num(rawSections.documentos.expiring),
      overdue: num(rawSections.documentos.overdue),
      items: Array.isArray(rawSections.documentos.items)
        ? (rawSections.documentos.items as Record<string, unknown>[]).map((row) => ({
            title: String(row.title ?? "—"),
            type: (row.type as string | null) ?? null,
            expiry_date: (row.expiry_date as string | null) ?? null,
            status: (row.status as string | null) ?? null,
          }))
        : [],
    };
  }

  if (allowed("riscos") && rawSections.riscos) {
    sections.riscos = {
      open: num(rawSections.riscos.open),
      items: Array.isArray(rawSections.riscos.items)
        ? (rawSections.riscos.items as Record<string, unknown>[]).map((row) => ({
            title: String(row.title ?? "—"),
            severity: (row.severity as string | null) ?? null,
            status: (row.status as string | null) ?? null,
            due_date: (row.due_date as string | null) ?? null,
          }))
        : [],
    };
  }

  return {
    ownerUserId,
    label: String(payload.label ?? "Família"),
    officeId: String(payload.officeId ?? ""),
    scopes,
    sections,
    generatedAt: String(payload.generatedAt ?? new Date().toISOString()),
  };
}
