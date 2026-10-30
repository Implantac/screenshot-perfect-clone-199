/**
 * Qualidade de dados e prontidão operacional.
 *
 * O que a Landytech vende como "investment data validation" e o que, na prática,
 * é a dor número 1 de quem consolida patrimônio: **o dado está errado ou velho e
 * ninguém sabe**. Este módulo transforma isso em score auditável, com achados
 * acionáveis em vez de um número mágico.
 */

export type PositionForQuality = {
  name: string;
  entity_id?: string | null;
  account_id?: string | null;
  asset_class?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  cost_basis?: number | string | null;
  currency?: string | null;
  as_of?: string | null;
};

export type DocumentForQuality = {
  title: string;
  expiry_date?: string | null;
  status?: string | null;
};

export type AssetForQuality = {
  name: string;
  value?: number | string | null;
  status?: string | null;
  location?: string | null;
  registration_number?: string | null;
};

export type Finding = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "cadastro" | "precificacao" | "documental" | "concentracao" | "concialiacao";
  title: string;
  detail: string;
  /** Quantos registros o achado afeta. */
  count: number;
  /** Peso do achado no score (quanto maior, mais derruba). */
  weight: number;
  href?: string;
};

export type QualityReport = {
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  findings: Finding[];
  /** Contadores brutos usados pelos cards. */
  metrics: {
    positions: number;
    stalePositions: number;
    unpricedPositions: number;
    positionsWithoutAccount: number;
    assetsWithoutRegistry: number;
    documentsExpiring: number;
    documentsExpired: number;
    duplicateNames: number;
  };
};

const STALE_DAYS = 30;

function daysSince(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const date = new Date(dateIso.length <= 10 ? `${dateIso}T00:00:00Z` : dateIso);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function daysUntil(dateIso: string | null | undefined): number | null {
  const since = daysSince(dateIso);
  return since === null ? null : -since;
}

export function buildQualityReport(input: {
  positions?: PositionForQuality[] | null;
  documents?: DocumentForQuality[] | null;
  assets?: AssetForQuality[] | null;
}): QualityReport {
  const positions = input.positions ?? [];
  const documents = input.documents ?? [];
  const assets = input.assets ?? [];

  const stale = positions.filter((p) => {
    const days = daysSince(p.as_of);
    return days !== null && days > STALE_DAYS;
  });
  const unpriced = positions.filter((p) => Number(p.unit_price ?? 0) <= 0 || Number(p.quantity ?? 0) <= 0);
  const withoutAccount = positions.filter((p) => !p.account_id);
  const assetsWithoutRegistry = assets.filter((a) => !a.registration_number || !a.location);
  const expired = documents.filter((d) => {
    const days = daysUntil(d.expiry_date);
    return days !== null && days < 0;
  });
  const expiring = documents.filter((d) => {
    const days = daysUntil(d.expiry_date);
    return days !== null && days >= 0 && days <= 30;
  });

  const nameCount = new Map<string, number>();
  for (const position of positions) {
    const key = position.name.trim().toLowerCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  const duplicates = [...nameCount.values()].filter((count) => count > 1).length;

  const findings: Finding[] = [];

  if (unpriced.length > 0) {
    findings.push({
      id: "unpriced",
      severity: "critical",
      category: "precificacao",
      title: `${unpriced.length} posição(ões) sem preço ou quantidade`,
      detail:
        "Posição sem preço unitário ou quantidade não entra no total consolidado — o patrimônio exibido fica subestimado.",
      count: unpriced.length,
      weight: 25,
      href: "/custodia",
    });
  }

  if (stale.length > 0) {
    findings.push({
      id: "stale",
      severity: "high",
      category: "precificacao",
      title: `${stale.length} posição(ões) com preço de mais de ${STALE_DAYS} dias`,
      detail: "Preço velho distorce alocação, TWR e decisão de rebalanceamento.",
      count: stale.length,
      weight: 20,
      href: "/custodia",
    });
  }

  if (expired.length > 0) {
    findings.push({
      id: "docs-expired",
      severity: "critical",
      category: "documental",
      title: `${expired.length} documento(s) vencido(s)`,
      detail: "Matrícula, licença ou certidão vencida trava operação de crédito e venda.",
      count: expired.length,
      weight: 20,
      href: "/regularizacao",
    });
  }

  if (expiring.length > 0) {
    findings.push({
      id: "docs-expiring",
      severity: "medium",
      category: "documental",
      title: `${expiring.length} documento(s) vencem em até 30 dias`,
      detail: "Renovação preventiva evita parada de operação.",
      count: expiring.length,
      weight: 10,
      href: "/jarvis/alertas",
    });
  }

  if (assetsWithoutRegistry.length > 0) {
    findings.push({
      id: "assets-registry",
      severity: "medium",
      category: "cadastro",
      title: `${assetsWithoutRegistry.length} ativo(s) sem matrícula ou localização`,
      detail: "Ativo sem registro completo não pode ser vendido, dado em garantia nem inventariado sem retrabalho.",
      count: assetsWithoutRegistry.length,
      weight: 12,
      href: "/imoveis",
    });
  }

  if (withoutAccount.length > 0) {
    findings.push({
      id: "no-account",
      severity: "medium",
      category: "cadastro",
      title: `${withoutAccount.length} posição(ões) sem conta de custódia`,
      detail: "Sem conta vinculada não há conciliação com extrato nem responsabilização por custodiante.",
      count: withoutAccount.length,
      weight: 8,
      href: "/custodia",
    });
  }

  if (duplicates > 0) {
    findings.push({
      id: "duplicates",
      severity: "low",
      category: "concialiacao",
      title: `${duplicates} nome(s) de posição repetido(s)`,
      detail: "Possível lançamento duplicado na mesma custódia.",
      count: duplicates,
      weight: 6,
      href: "/custodia",
    });
  }

  const score = Math.max(0, Math.min(100, 100 - findings.reduce((sum, f) => sum + f.weight, 0)));

  return {
    score,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E",
    findings: findings.sort((a, b) => b.weight - a.weight),
    metrics: {
      positions: positions.length,
      stalePositions: stale.length,
      unpricedPositions: unpriced.length,
      positionsWithoutAccount: withoutAccount.length,
      assetsWithoutRegistry: assetsWithoutRegistry.length,
      documentsExpiring: expiring.length,
      documentsExpired: expired.length,
      duplicateNames: duplicates,
    },
  };
}
