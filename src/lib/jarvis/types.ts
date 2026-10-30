/** Contrato do "cérebro" do JARVIS — compartilhado entre servidor e UI. */

export type BriefingEntity = {
  name: string;
  type: string | null;
  compliance: number;
  assets: number;
  value: number;
};

export type BriefingAsset = {
  name: string;
  type: string;
  entity: string | null;
  value: number;
  status: string;
  area: string | null;
  location: string | null;
};

export type BriefingRisk = {
  title: string;
  severity: string;
  status: string;
  dueDate: string | null;
  entity: string | null;
  asset: string | null;
};

export type BriefingDocument = {
  title: string;
  type: string | null;
  expiryDate: string | null;
  daysToExpire: number | null;
  status: string;
  asset: string | null;
};

export type BriefingInsight = {
  title: string;
  severity: string;
  type: string;
  resolved: boolean;
};

export type BriefingCategory = {
  category: string;
  total: number;
  type: "income" | "expense";
};

export type PortfolioBriefing = {
  generatedAt: string;
  userEmail: string | null;
  totals: {
    aum: number;
    assets: number;
    entities: number;
    members: number;
    risksOpen: number;
    risksCritical: number;
    documentsExpiring: number;
    documentsOverdue: number;
    insightsOpen: number;
    income6m: number;
    expense6m: number;
  };
  entities: BriefingEntity[];
  topAssets: BriefingAsset[];
  assetsByType: { type: string; count: number; value: number }[];
  risks: BriefingRisk[];
  documentsExpiring: BriefingDocument[];
  insights: BriefingInsight[];
  categories: BriefingCategory[];
  /** Custódia financeira (wave 4) — ausente/zero quando a migration não foi aplicada. */
  custody?: BriefingCustody;
};

/** Resumo de custódia/performance usado pelo analista local. */
export type BriefingCustody = {
  positions: number;
  financialValue: number;
  byClass: { asset_class: string; value: number; percentage: number }[];
  liquidPercentage: number;
  offshorePercentage: number;
  concentration: number;
  twr: number | null;
  mwr: number | null;
  benchmarkExcess: number | null;
  topPosition: { name: string; percentage: number } | null;
};

export type JarvisProvider = "openai" | "anthropic" | "gemini" | "local";

export type JarvisAnswer = {
  answer: string;
  provider: JarvisProvider;
  /** Números do banco que embasaram a resposta (transparência). */
  sources: { label: string; value: string }[];
  /** Ações sugeridas, quando o modelo devolve o bloco estruturado. */
  followUps: string[];
  generatedAt: string;
};

export type JarvisStatus = {
  provider: JarvisProvider;
  model: string | null;
  configured: boolean;
};

export const EMPTY_BRIEFING: PortfolioBriefing = {
  generatedAt: new Date(0).toISOString(),
  userEmail: null,
  totals: {
    aum: 0,
    assets: 0,
    entities: 0,
    members: 0,
    risksOpen: 0,
    risksCritical: 0,
    documentsExpiring: 0,
    documentsOverdue: 0,
    insightsOpen: 0,
    income6m: 0,
    expense6m: 0,
  },
  entities: [],
  topAssets: [],
  assetsByType: [],
  risks: [],
  documentsExpiring: [],
  insights: [],
  categories: [],
  custody: undefined,
};
