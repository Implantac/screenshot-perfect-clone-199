/**
 * Consolidação do escritório (multi-family office) — motor puro.
 *
 * Entra: as linhas agregadas que a RPC `office_consolidation()` devolve (uma por
 * família, só números). Sai: a visão de conselho — total do escritório, peso de
 * cada família, concentração, qualidade do dado e alertas.
 *
 * Por que o cálculo mora aqui e não no SQL:
 *  - o número precisa bater com o do resto do app (patrimônio líquido = ativo −
 *    dívida), e isso é testável em unidade;
 *  - o SQL devolve agregado por família; decisões de "o que é risco" (HHI,
 *    concentração, dado velho, família sem dado) são regra de negócio e mudam
 *    com o uso — melhor em TS, com teste, do que em `CASE WHEN` espalhado.
 *
 * Nada aqui julga família por nome nem inventa número ausente: campo vazio é
 * declarado como lacuna, não preenchido com zero silencioso.
 */

/** Linha crua da RPC (snake_case, como o Postgres devolve). */
export type OfficeFamilyRow = {
  office_id: string;
  office_name: string;
  owner_user_id: string;
  label: string;
  client_status: string;
  granted_at: string | null;
  entities: number | string | null;
  entities_value: number | string | null;
  assets_value: number | string | null;
  positions_value: number | string | null;
  liabilities_value: number | string | null;
  net_worth: number | string | null;
  risks_open: number | string | null;
  risks_critical: number | string | null;
  documents_expiring: number | string | null;
  documents_overdue: number | string | null;
  legal_exposure: number | string | null;
  agro_area_ha: number | string | null;
  last_update: string | null;
  /** Opcional: a UI pode enriquecer depois. Não vem da RPC. */
  label_override?: string | null;
};

export type OfficeFamily = {
  ownerUserId: string;
  label: string;
  status: string;
  grantedAt: string | null;
  entities: number;
  assets: number;
  positions: number;
  totalAssets: number;
  debt: number;
  netWorth: number;
  risksOpen: number;
  risksCritical: number;
  documentsExpiring: number;
  documentsOverdue: number;
  legalExposure: number;
  agroAreaHa: number;
  lastUpdate: string | null;
  /** Peso no patrimônio do escritório (%) — 0 quando o total é zero. */
  shareOfAum: number;
  /** Patrimônio líquido negativo é insolvência contábil, não "Família X ruim". */
  negativeNetWorth: boolean;
  /** Sem nenhum ativo lançado: não é patrimônio zero, é dado que falta. */
  missingData: boolean;
  /** Última atualização há mais de `staleDays`. */
  stale: boolean;
  daysSinceUpdate: number | null;
  alerts: string[];
};

export type OfficeAlert = {
  severity: "critical" | "warning" | "info";
  ownerUserId: string | null;
  label: string;
  message: string;
};

export type OfficeConsolidation = {
  officeId: string;
  officeName: string;
  generatedAt: string;
  families: OfficeFamily[];
  totals: {
    families: number;
    activeFamilies: number;
    assets: number;
    debt: number;
    netWorth: number;
    leverage: number;
    risksOpen: number;
    risksCritical: number;
    documentsOverdue: number;
    legalExposure: number;
    agroAreaHa: number;
  };
  concentration: {
    /** Peso da maior família no patrimônio total (%). */
    topFamilyShare: number;
    topFamilyLabel: string | null;
    /** Soma das cinco maiores (%). */
    top5Share: number;
    /** Herfindahl-Hirschman 0–1 sobre os pesos: 1 = uma família só. */
    hhi: number;
    level: "baixa" | "moderada" | "alta";
    /** Quantas famílias passam de `singleFamilyThreshold`. */
    familiesAboveThreshold: number;
  };
  quality: {
    familiesMissingData: number;
    familiesStale: number;
    familiesNegativeNetWorth: number;
    /** % das famílias com dado recente e ativo lançado. */
    freshnessPct: number;
  };
  alerts: OfficeAlert[];
  warnings: string[];
};

export type ConsolidationOptions = {
  /** Dias sem atualização a partir dos quais a família é considerada "velha". */
  staleDays?: number;
  /** Peso (%) a partir do qual uma família é concentração relevante. */
  singleFamilyThreshold?: number;
  /** Data de referência (testes). */
  today?: string;
};

const num = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function daysBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / 86_400_000);
}

/** Consolida as famílias de UM escritório. */
export function buildOfficeConsolidation(
  rows: OfficeFamilyRow[],
  options: ConsolidationOptions = {},
): OfficeConsolidation {
  const staleDays = options.staleDays ?? 90;
  const threshold = options.singleFamilyThreshold ?? 25;
  const today = options.today ?? new Date().toISOString();

  const officeId = rows[0]?.office_id ?? "";
  const officeName = rows[0]?.office_name ?? "Escritório";
  const warnings: string[] = [];

  const families: OfficeFamily[] = rows.map((row) => {
    const assets = num(row.assets_value);
    const positions = num(row.positions_value);
    const totalAssets = assets + positions;
    const debt = num(row.liabilities_value);
    const news = {
      ownerUserId: row.owner_user_id,
      label: row.label_override?.trim() || row.label,
      status: row.client_status,
      grantedAt: row.granted_at,
      entities: num(row.entities),
      assets,
      positions,
      totalAssets,
      debt,
      netWorth: totalAssets - debt,
      risksOpen: num(row.risks_open),
      risksCritical: num(row.risks_critical),
      documentsExpiring: num(row.documents_expiring),
      documentsOverdue: num(row.documents_overdue),
      legalExposure: num(row.legal_exposure),
      agroAreaHa: num(row.agro_area_ha),
      lastUpdate: row.last_update,
      shareOfAum: 0,
      negativeNetWorth: false,
      missingData: false,
      stale: false,
      daysSinceUpdate: daysBetween(row.last_update, today),
      alerts: [] as string[],
    };

    news.missingData = totalAssets === 0 && news.entities === 0;
    news.negativeNetWorth = news.netWorth < 0;
    news.stale = news.daysSinceUpdate !== null && news.daysSinceUpdate > staleDays;

    if (news.missingData) news.alerts.push("Sem ativo ou entidade lançada — consolidado incompleto.");
    if (news.negativeNetWorth) news.alerts.push("Patrimônio líquido negativo.");
    if (news.stale) news.alerts.push(`Sem atualização há ${news.daysSinceUpdate} dias.`);
    if (news.documentsOverdue > 0) news.alerts.push(`${news.documentsOverdue} documento(s) vencido(s).`);
    if (news.risksCritical > 0) news.alerts.push(`${news.risksCritical} risco(s) crítico(s) aberto(s).`);

    return news;
  });

  const totals = {
    families: families.length,
    activeFamilies: families.filter((family) => family.status === "ativo").length,
    assets: families.reduce((sum, family) => sum + family.totalAssets, 0),
    debt: families.reduce((sum, family) => sum + family.debt, 0),
    netWorth: 0,
    leverage: 0,
    risksOpen: families.reduce((sum, family) => sum + family.risksOpen, 0),
    risksCritical: families.reduce((sum, family) => sum + family.risksCritical, 0),
    documentsOverdue: families.reduce((sum, family) => sum + family.documentsOverdue, 0),
    legalExposure: families.reduce((sum, family) => sum + family.legalExposure, 0),
    agroAreaHa: families.reduce((sum, family) => sum + family.agroAreaHa, 0),
  };
  totals.netWorth = totals.assets - totals.debt;
  totals.leverage = totals.assets > 0 ? round2((totals.debt / totals.assets) * 100) : 0;

  // Peso de cada família no ativo consolidado.
  for (const family of families) {
    family.shareOfAum = totals.assets > 0 ? round2((family.totalAssets / totals.assets) * 100) : 0;
  }

  const sorted = [...families].sort((a, b) => b.totalAssets - a.totalAssets);
  const top = sorted[0] ?? null;
  const top5 = sorted.slice(0, 5).reduce((sum, family) => sum + family.shareOfAum, 0);
  const hhi = round2(families.reduce((sum, family) => sum + (family.shareOfAum / 100) ** 2, 0));

  const level: OfficeConsolidation["concentration"]["level"] =
    hhi >= 0.25 ? "alta" : hhi >= 0.12 ? "moderada" : "baixa";

  const familiesAboveThreshold = families.filter((family) => family.shareOfAum >= threshold).length;

  const freshnessPct =
    families.length > 0
      ? round2(
          (families.filter((family) => !family.stale && !family.missingData).length / families.length) * 100,
        )
      : 0;

  // --------------------------------------------------------------- alertas
  const alerts: OfficeAlert[] = [];

  if (totals.families === 0) {
    warnings.push(
      "Nenhuma família vinculada: o consolidado só existe depois que a família concede acesso ao escritório.",
    );
  }

  for (const family of families) {
    if (family.negativeNetWorth) {
      alerts.push({
        severity: "critical",
        ownerUserId: family.ownerUserId,
        label: family.label,
        message: `Patrimônio líquido negativo (${family.netWorth.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}).`,
      });
    }
    if (family.missingData) {
      alerts.push({
        severity: "warning",
        ownerUserId: family.ownerUserId,
        label: family.label,
        message: "Consolidado incompleto: nenhum ativo ou entidade lançada.",
      });
    }
    if (family.stale) {
      alerts.push({
        severity: "warning",
        ownerUserId: family.ownerUserId,
        label: family.label,
        message: `Dados sem atualização há ${family.daysSinceUpdate} dias (corte de ${staleDays}).`,
      });
    }
    if (family.risksCritical > 0) {
      alerts.push({
        severity: "critical",
        ownerUserId: family.ownerUserId,
        label: family.label,
        message: `${family.risksCritical} risco(s) crítico(s) aberto(s).`,
      });
    }
    if (family.documentsOverdue > 0) {
      alerts.push({
        severity: "warning",
        ownerUserId: family.ownerUserId,
        label: family.label,
        message: `${family.documentsOverdue} documento(s) vencido(s).`,
      });
    }
    if (family.legalExposure > 0 && family.netWorth > 0) {
      const share = (family.legalExposure / family.netWorth) * 100;
      if (share >= 10) {
        alerts.push({
          severity: share >= 25 ? "critical" : "warning",
          ownerUserId: family.ownerUserId,
          label: family.label,
          message: `Contencioso de ${share.toFixed(1).replace(".", ",")}% do patrimônio líquido.`,
        });
      }
    }
  }

  if (familiesAboveThreshold > 0 && families.length > 1) {
    alerts.push({
      severity: "info",
      ownerUserId: null,
      label: officeName,
      message:
        top && top.shareOfAum >= threshold
          ? `Concentração: ${top.label} representa ${top.shareOfAum.toFixed(1).replace(".", ",")}% do patrimônio consolidado.`
          : `${familiesAboveThreshold} família(s) acima de ${threshold}% do consolidado.`,
    });
  }

  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  if (families.some((family) => family.missingData)) {
    warnings.push(
      "Famílias sem dado entram no consolidado com zero — trate como lacuna, não como ausência de patrimônio.",
    );
  }

  return {
    officeId,
    officeName,
    generatedAt: today,
    families: sorted,
    totals,
    concentration: {
      topFamilyShare: top?.shareOfAum ?? 0,
      topFamilyLabel: top?.label ?? null,
      top5Share: round2(top5),
      hhi,
      level,
      familiesAboveThreshold,
    },
    quality: {
      familiesMissingData: families.filter((family) => family.missingData).length,
      familiesStale: families.filter((family) => family.stale).length,
      familiesNegativeNetWorth: families.filter((family) => family.negativeNetWorth).length,
      freshnessPct,
    },
    alerts,
    warnings,
  };
}

/** Agrupa linhas de vários escritórios (admin/analista em mais de um). */
export function groupByOffice(rows: OfficeFamilyRow[]): Map<string, OfficeFamilyRow[]> {
  const grouped = new Map<string, OfficeFamilyRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.office_id) ?? [];
    list.push(row);
    grouped.set(row.office_id, list);
  }
  return grouped;
}

/** Consolidado por escritório quando a pessoa participa de mais de um. */
export function buildAllConsolidations(
  rows: OfficeFamilyRow[],
  options: ConsolidationOptions = {},
): OfficeConsolidation[] {
  return Array.from(groupByOffice(rows).values())
    .map((officeRows) => buildOfficeConsolidation(officeRows, options))
    .sort((a, b) => b.totals.assets - a.totals.assets);
}
