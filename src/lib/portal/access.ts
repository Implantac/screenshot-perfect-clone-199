/**
 * Portal do cliente — resolução de permissão e redação de valores.
 *
 * O motor responde três perguntas, e só essas:
 *   1. **O que esta pessoa pode ver?** (seção por seção, com motivo da negativa)
 *   2. **Com que grão?** (centavo, milhão ou faixa)
 *   3. **O acesso está saudável?** (vencido, sem MFA, sem prazo, exportando demais)
 *
 * Tudo é função pura: a tela administrativa, a prévia "ver como…" e o teste
 * consomem o mesmo objeto. Nenhuma regra de visibilidade mora em componente.
 */

export type PortalRole =
  | "titular"
  | "conjuge"
  | "herdeiro"
  | "socio"
  | "gestor"
  | "contador"
  | "auditor";

export type PortalVisibility = "completo" | "resumido" | "faixas";

export type PortalStatus = "convite_pendente" | "ativo" | "suspenso" | "revogado";

export type PortalGrant = {
  id: string;
  entity_id?: string;
  member_id?: string | null;
  full_name: string;
  email: string;
  role: PortalRole;
  sections: string[];
  visibility: PortalVisibility;
  status: PortalStatus;
  can_export?: boolean | null;
  can_see_liabilities?: boolean | null;
  can_see_documents?: boolean | null;
  require_mfa?: boolean | null;
  expires_at?: string | null;
  invited_at?: string | null;
  last_access_at?: string | null;
  notes?: string | null;
};

export type PortalSection = {
  id: string;
  label: string;
  /** Exige `can_see_liabilities` além da seção. */
  needsLiabilities?: boolean;
  /** Exige `can_see_documents` além da seção. */
  needsDocuments?: boolean;
  /** Aparece na prévia com esta descrição. */
  description: string;
};

export const PORTAL_SECTIONS: PortalSection[] = [
  {
    id: "resumo",
    label: "Resumo do mês",
    description: "Patrimônio líquido, retorno do mês e do ano.",
  },
  {
    id: "alocacao",
    label: "Alocação",
    description: "Distribuição por classe, moeda e liquidez — em % do total.",
  },
  {
    id: "atribuicao",
    label: "Atribuição de retorno",
    description: "Quanto cada classe contribuiu para o resultado do período.",
  },
  {
    id: "balanco",
    label: "Balanço e dívida",
    needsLiabilities: true,
    description: "Ativo, passivo, patrimônio líquido e serviço da dívida.",
  },
  {
    id: "metas",
    label: "Metas",
    description: "Progresso das metas e aporte mensal necessário.",
  },
  {
    id: "documentos",
    label: "Documentos",
    needsDocuments: true,
    description: "Escrituras, contratos e certidões anexadas.",
  },
  {
    id: "juridico",
    label: "Contencioso",
    needsDocuments: true,
    description: "Processos, valores em risco e provisões.",
  },
  {
    id: "sucessao",
    label: "Sucessão e governança",
    description: "Estrutura, doações, holding e pacto de sócios.",
  },
];

export const ROLE_LABELS: Record<PortalRole, string> = {
  titular: "Titular",
  conjuge: "Cônjuge",
  herdeiro: "Herdeiro",
  socio: "Sócio",
  gestor: "Gestor externo",
  contador: "Contador",
  auditor: "Auditor",
};

/** Pacote padrão de cada persona — ponto de partida, não teto. */
export const ROLE_PRESETS: Record<PortalRole, { sections: string[]; extras: Partial<PortalGrant> }> = {
  titular: {
    sections: PORTAL_SECTIONS.map((section) => section.id),
    extras: { visibility: "completo", can_export: true, can_see_liabilities: true, can_see_documents: true, require_mfa: true },
  },
  conjuge: {
    sections: ["resumo", "alocacao", "atribuicao", "balanco", "metas", "sucessao"],
    extras: { visibility: "resumido", can_export: true, can_see_liabilities: true, can_see_documents: false, require_mfa: true },
  },
  herdeiro: {
    sections: ["resumo", "alocacao", "atribuicao", "metas", "sucessao"],
    extras: { visibility: "faixas", can_export: false, can_see_liabilities: false, can_see_documents: false, require_mfa: true },
  },
  socio: {
    sections: ["resumo", "alocacao", "atribuicao", "balanco"],
    extras: { visibility: "resumido", can_export: false, can_see_liabilities: true, can_see_documents: false, require_mfa: true },
  },
  gestor: {
    sections: ["resumo", "alocacao", "atribuicao"],
    extras: { visibility: "resumido", can_export: true, can_see_liabilities: false, can_see_documents: false, require_mfa: true },
  },
  contador: {
    sections: ["resumo", "alocacao", "balanco", "documentos"],
    extras: { visibility: "completo", can_export: true, can_see_liabilities: true, can_see_documents: true, require_mfa: true },
  },
  auditor: {
    // O auditor vê contencioso (é o que ele audita), mas não baixa documento pessoal.
    sections: ["resumo", "alocacao", "atribuicao", "balanco", "metas", "juridico"],
    extras: { visibility: "completo", can_export: true, can_see_liabilities: true, can_see_documents: true, require_mfa: true },
  },
};

export type SectionDecision = {
  id: string;
  label: string;
  allowed: boolean;
  /** Por que está liberada ou negada — a prévia administrativa mostra isso. */
  reason: string;
};

export type PortalAccess = {
  status: PortalStatus;
  /** Vencido pelo prazo, independentemente do status gravado. */
  expired: boolean;
  daysToExpiry: number | null;
  sections: SectionDecision[];
  allowedSections: string[];
  deniedSections: SectionDecision[];
  visibility: PortalVisibility;
  canExport: boolean;
  requireMfa: boolean;
  /** Peso 0–100 de quanto da informação a pessoa vê. */
  exposure: number;
  warnings: string[];
};

const SENSITIVE_SECTIONS = new Set(["balanco", "documentos", "juridico", "sucessao"]);

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

/** Resolve o que um grant enxerga, seção por seção, com o motivo de cada negativa. */
export function resolvePortalAccess(grant: PortalGrant, today = new Date()): PortalAccess {
  const todayIso = today.toISOString().slice(0, 10);
  const granted = new Set((grant.sections ?? []).map((section) => section.trim().toLowerCase()));
  const expired = grant.expires_at ? grant.expires_at.slice(0, 10) < todayIso : false;
  const daysToExpiry = grant.expires_at ? daysBetween(todayIso, grant.expires_at) : null;

  const sections: SectionDecision[] = PORTAL_SECTIONS.map((section) => {
    if (!granted.has(section.id)) {
      return { id: section.id, label: section.label, allowed: false, reason: "Seção não concedida a esta pessoa." };
    }
    if (section.needsLiabilities && !grant.can_see_liabilities) {
      return {
        id: section.id,
        label: section.label,
        allowed: false,
        reason: "Liberada a seção, mas o detalhe de passivo não foi autorizado.",
      };
    }
    if (section.needsDocuments && !grant.can_see_documents) {
      return {
        id: section.id,
        label: section.label,
        allowed: false,
        reason: "Liberada a seção, mas documentos anexos não foram autorizados.",
      };
    }
    if (expired) {
      return { id: section.id, label: section.label, allowed: false, reason: "Acesso vencido pelo prazo." };
    }
    if (grant.status === "suspenso" || grant.status === "revogado") {
      return {
        id: section.id,
        label: section.label,
        allowed: false,
        reason: `Acesso ${grant.status === "suspenso" ? "suspenso" : "revogado"}.`,
      };
    }
    return { id: section.id, label: section.label, allowed: true, reason: "Concedida." };
  });

  const allowedSections = sections.filter((section) => section.allowed).map((section) => section.id);
  const deniedSections = sections.filter((section) => !section.allowed);

  const warnings: string[] = [];
  if (expired) {
    warnings.push(`Acesso venceu em ${formatDate(grant.expires_at)} — revogar ou renovar com prazo novo.`);
  } else if (daysToExpiry !== null && daysToExpiry <= 30) {
    warnings.push(`Acesso vence em ${daysToExpiry} dia(s) — renovar se ainda fizer sentido.`);
  }
  if (!grant.expires_at && grant.role !== "titular") {
    warnings.push("Acesso sem prazo de validade: todo convite a terceiro deveria vencer.");
  }
  if (!grant.require_mfa && grant.role !== "titular") {
    warnings.push("Sem segundo fator: acesso de terceiro a patrimônio deveria exigir MFA.");
  }
  if (grant.can_export && grant.visibility === "completo" && SENSITIVE_SECTIONS.has("balanco") && allowedSections.includes("balanco")) {
    warnings.push("Exporta PDF com valores exatos e vê o balanço: um download vira uma cópia fora de controle.");
  }
  if (grant.role === "herdeiro" && allowedSections.includes("balanco")) {
    warnings.push("Herdeiro com acesso a dívida detalhada — confirme se é intencional.");
  }
  if (grant.role === "gestor" && allowedSections.includes("sucessao")) {
    warnings.push("Gestor externo com acesso a sucessão: dado de família fora do escopo de gestão.");
  }
  if (grant.status === "convite_pendente" && grant.invited_at) {
    const waiting = daysBetween(grant.invited_at.slice(0, 10), todayIso);
    if (waiting > 14) warnings.push(`Convite enviado há ${waiting} dias e nunca aceito.`);
  }

  const exposure = Math.round(
    (allowedSections.reduce((sum, id) => sum + (SENSITIVE_SECTIONS.has(id) ? 1.5 : 1), 0) /
      PORTAL_SECTIONS.reduce((sum, section) => sum + (SENSITIVE_SECTIONS.has(section.id) ? 1.5 : 1), 0)) *
      100,
  );

  return {
    status: expired ? "revogado" : grant.status,
    expired,
    daysToExpiry,
    sections,
    allowedSections,
    deniedSections,
    visibility: grant.visibility,
    canExport: Boolean(grant.can_export),
    requireMfa: Boolean(grant.require_mfa),
    exposure: Math.min(100, exposure),
    warnings,
  };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

const brl = (value: number, digits = 0) =>
  value
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    .replace(/\u00a0|\u202f/g, " ");

/**
 * Redação do valor conforme o grão autorizado.
 * `faixas` usa banda de ordem de grandeza — o suficiente para dar contexto e
 * insuficiente para virar notícia.
 */
export function redactAmount(value: number, visibility: PortalVisibility): string {
  const absolute = Math.abs(value);
  if (visibility === "completo") return brl(value);

  if (visibility === "resumido") {
    if (absolute >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(1).replace(".", ",")} bi`;
    if (absolute >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
    if (absolute >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
    return brl(value);
  }

  // faixas: banda de **uma ordem de grandeza** (63,4 mi → "R$ 60 mi–70 mi").
  // Duas ordens de precisão ainda permitiriam inferir o número com 2% de erro,
  // que é o mesmo que entregar o número.
  if (absolute === 0) return "R$ 0";
  const magnitude = Math.floor(Math.log10(absolute));
  const step = 10 ** Math.max(0, magnitude);
  const lower = Math.floor(absolute / step) * step;
  const upper = lower + step;
  const formatter = (number: number) =>
    number >= 1_000_000
      ? `${Math.round(number / 1_000_000).toLocaleString("pt-BR")} mi`
      : number >= 1_000
        ? `${Math.round(number / 1_000).toLocaleString("pt-BR")} mil`
        : String(number);
  const sign = value < 0 ? "-" : "";
  return `${sign}R$ ${formatter(lower)}–${formatter(upper)}`;
}

/** Percentuais nunca são redigidos: sem eles o relatório não comunica nada. */
export function redactPercent(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits).replace(".", ",")}%`;
}

export type PortalAudience = {
  grants: number;
  active: number;
  pending: number;
  expiringSoon: number;
  withoutMfa: number;
  canExport: number;
  warnings: string[];
};

/** Saúde do conjunto de acessos — o que o administrador precisa ver primeiro. */
export function summarizeGrants(grants: PortalGrant[], today = new Date()): PortalAudience {
  const resolved = grants.map((grant) => ({ grant, access: resolvePortalAccess(grant, today) }));
  const active = resolved.filter((item) => !item.access.expired && item.access.status === "ativo").length;
  const pending = resolved.filter((item) => item.grant.status === "convite_pendente" && !item.access.expired).length;
  const expiringSoon = resolved.filter(
    (item) => item.access.daysToExpiry !== null && item.access.daysToExpiry >= 0 && item.access.daysToExpiry <= 30,
  ).length;
  const withoutMfa = resolved.filter((item) => !item.access.requireMfa && item.grant.role !== "titular").length;
  const canExport = resolved.filter((item) => item.access.canExport && !item.access.expired).length;

  const warnings: string[] = [];
  if (grants.length === 0) {
    warnings.push("Nenhum acesso concedido: o portal está fechado e ninguém além de você lê o patrimônio.");
  }
  if (withoutMfa > 0) warnings.push(`${withoutMfa} acesso(s) de terceiro sem segundo fator.`);
  if (resolved.some((item) => item.grant.role !== "titular" && !item.grant.expires_at)) {
    warnings.push("Há acesso de terceiro sem prazo de validade.");
  }
  if (expiringSoon > 0) warnings.push(`${expiringSoon} acesso(s) vencem em até 30 dias.`);
  const titulars = grants.filter((grant) => grant.role === "titular").length;
  if (titulars === 0 && grants.length > 0) {
    warnings.push("Nenhum titular cadastrado — em uma emergência, ninguém tem visão completa.");
  }

  return {
    grants: grants.length,
    active,
    pending,
    expiringSoon,
    withoutMfa,
    canExport,
    warnings,
  };
}
