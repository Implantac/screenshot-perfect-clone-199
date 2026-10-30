/**
 * Dataset de demonstração do PATRIUM OS.
 *
 * Módulo puro (sem imports de Vite/Supabase) para poder ser usado tanto pelo app
 * quanto por scripts de verificação. As datas são geradas relativas a `today`
 * para que vencimentos e riscos fiquem sempre coerentes com a data corrente.
 */
import type { Database } from "@/integrations/supabase/types";

type AssetType = Database["public"]["Enums"]["asset_type"];
type ComplianceStatus = Database["public"]["Enums"]["compliance_status"];
type RiskSeverity = Database["public"]["Enums"]["risk_severity"];

export type DemoEntity = {
  name: string;
  tax_id: string;
  type: string;
  founded_at: string;
  compliance_score: number;
};

export type DemoMember = {
  full_name: string;
  email: string;
  tax_id: string;
  role: string;
  /** Percentual em cada entidade, referenciada pelo nome. */
  shares: { entity: string; percentage: number }[];
};

export type DemoAsset = {
  name: string;
  type: AssetType;
  entity: string;
  value: number;
  location: string;
  area: string;
  registration_number: string;
  status: ComplianceStatus;
  health_score: number;
};

export type DemoDocument = {
  title: string;
  type: string;
  asset: string | null;
  /** Dias a partir de hoje (negativo = vencido). */
  expiresInDays: number;
  status: ComplianceStatus;
  ocr_processed: boolean;
};

export type DemoRisk = {
  title: string;
  description: string;
  severity: RiskSeverity;
  asset: string | null;
  responsible: string;
  /** Dias a partir de hoje. */
  dueInDays: number;
};

export type DemoTransaction = {
  title: string;
  entity: string;
  asset: string | null;
  amount: number;
  type: "income" | "expense";
  category: string;
  /** Quantos meses atrás (0 = mês corrente). */
  monthsAgo: number;
  day: number;
};

export type DemoInsight = {
  type: "documental" | "compliance" | "patrimonial" | "agro" | "risco";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  entity: string;
  asset: string | null;
  metadata: Record<string, string | number>;
};

export type DemoActionPlan = {
  insightTitle: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  status: "pending" | "in_progress" | "completed";
  dueInDays: number;
  suggested_resolution: string;
  impact_analysis: string;
};

export type DemoHealthScore = {
  entity: string | null;
  patrimonial_score: number;
  documental_score: number;
  compliance_score: number;
  risk_score: number;
  global_score: number;
  /** Meses atrás (5 = mais antigo). */
  monthsAgo: number;
};

export type DemoSupplier = {
  name: string;
  entity: string;
  tax_id: string;
  category: string;
  contact_email: string;
  status: "homologado" | "em_analise" | "risco_critico" | "inativo";
  compliance_score: number;
  contract_value: number;
  /** Dias a partir de hoje (negativo = vencido). */
  contractExpiryInDays: number;
  notes: string;
};

export type DemoLegalCase = {
  case_number: string;
  title: string;
  entity: string;
  asset: string | null;
  type: "civel" | "tributario" | "ambiental" | "trabalhista" | "societario" | "imobiliario";
  status: "em_andamento" | "suspenso" | "acordo" | "encerrado";
  court: string;
  risk_level: "low" | "medium" | "high" | "critical";
  value_at_stake: number;
  /** Dias a partir de hoje para a próxima audiência. */
  hearingInDays: number;
  responsible: string;
  notes: string;
};

/** Conta de custódia da demonstração. */
export type DemoAccount = {
  entity: string;
  custodian: string;
  name: string;
  kind: "corretora" | "banco" | "fundo" | "previdencia" | "cripto" | "outro";
  currency: string;
  accountNumber: string;
};

/** Posição financeira; `account` referencia DemoAccount.name. */
export type DemoPosition = {
  entity: string;
  account: string;
  asset_class: "caixa" | "renda_fixa" | "renda_variavel" | "fundos" | "imoveis" | "internacional" | "alternativos" | "cripto";
  liquidity: "d0" | "d1" | "d30" | "longo_prazo" | "iliquido";
  symbol: string;
  name: string;
  quantity: number;
  unit_price: number;
  cost_basis: number;
  currency: string;
  is_offshore?: boolean;
};

export type DemoCashFlow = {
  entity: string;
  account: string;
  kind: "aporte" | "resgate" | "provento" | "taxa" | "imposto";
  amount: number;
  /** Dias atrás (negativo = passado). */
  daysAgo: number;
  description: string;
};

export type DemoDataset = {
  entities: DemoEntity[];
  members: DemoMember[];
  assets: DemoAsset[];
  documents: DemoDocument[];
  risks: DemoRisk[];
  transactions: DemoTransaction[];
  insights: DemoInsight[];
  actionPlans: DemoActionPlan[];
  healthScores: DemoHealthScore[];
  suppliers: DemoSupplier[];
  legalCases: DemoLegalCase[];
  accounts: DemoAccount[];
  positions: DemoPosition[];
  cashFlows: DemoCashFlow[];
  /** Série mensal de fechamento; `monthOffset` 5 = cinco meses atrás. */
  snapshots: { entity: string; monthOffset: number; marketValue: number; costBasis: number; netFlow: number }[];
};

const HOLDING = "Alencar Participações S.A.";
const AGRO = "Agro Santa Fé Ltda.";
const RE = "Alencar Real Estate Ltda.";

/** Nome do ativo -> usado como referência nos demais registros. */
const FAZENDA = "Fazenda Santa Fé";
const BOA_VISTA = "Fazenda Boa Vista";
const SERRA_VERDE = "Fazenda Serra Verde";
const RIO_VERDE = "Fazenda Rio Verde (GO)";
const CORPORATE = "Edifício Corporate Prime";
const GALPAO = "Galpão Logístico Anhanguera";
const JARDINS = "Apartamento Jardins";
const BATEL = "Cobertura Batel";
const SALA = "Sala Comercial Centro";
const HELI = "Helicóptero H130";
const TRATORES = "Frota de Tratores";
const TERRENO = "Terreno Industrial Arapongas";

export const DEMO_ENTITY_NAMES = [HOLDING, AGRO, RE] as const;

export function buildDemoDataset(): DemoDataset {
  const entities: DemoEntity[] = [
    {
      name: HOLDING,
      tax_id: "12.345.678/0001-90",
      type: "Holding Familiar",
      founded_at: "2009-04-15",
      compliance_score: 96.5,
    },
    {
      name: AGRO,
      tax_id: "23.456.789/0001-01",
      type: "Operacional",
      founded_at: "2014-08-01",
      compliance_score: 91.2,
    },
    {
      name: RE,
      tax_id: "34.567.890/0001-12",
      type: "Investimento",
      founded_at: "2018-02-20",
      compliance_score: 88.7,
    },
  ];

  const members: DemoMember[] = [
    {
      full_name: "Roberto Alencar",
      email: "roberto@alencar.com.br",
      tax_id: "123.456.789-00",
      role: "Patriarca",
      shares: [
        { entity: HOLDING, percentage: 40 },
        { entity: AGRO, percentage: 60 },
      ],
    },
    {
      full_name: "Helena Alencar",
      email: "helena@alencar.com.br",
      tax_id: "234.567.890-11",
      role: "Matriarca",
      shares: [
        { entity: HOLDING, percentage: 25 },
        { entity: RE, percentage: 50 },
      ],
    },
    {
      full_name: "Marina Alencar",
      email: "marina@alencar.com.br",
      tax_id: "345.678.901-22",
      role: "Sucessora",
      shares: [
        { entity: HOLDING, percentage: 20 },
        { entity: AGRO, percentage: 40 },
      ],
    },
    {
      full_name: "Rafael Alencar",
      email: "rafael@alencar.com.br",
      tax_id: "456.789.012-33",
      role: "Sucessor",
      shares: [
        { entity: HOLDING, percentage: 15 },
        { entity: RE, percentage: 50 },
      ],
    },
    {
      full_name: "Carlos Menezes",
      email: "carlos@alencar.com.br",
      tax_id: "567.890.123-44",
      role: "Gestor",
      shares: [],
    },
    {
      full_name: "Lucia Prado",
      email: "lucia@alencar.com.br",
      tax_id: "678.901.234-55",
      role: "Conselheira",
      shares: [],
    },
  ];

  const assets: DemoAsset[] = [
    {
      name: FAZENDA,
      type: "rural",
      entity: AGRO,
      value: 48_500_000,
      location: "Apucarana/PR",
      area: "1.240 ha",
      registration_number: "12.884",
      status: "alerta",
      health_score: 87,
    },
    {
      name: BOA_VISTA,
      type: "rural",
      entity: AGRO,
      value: 32_000_000,
      location: "Maringá/PR",
      area: "860 ha",
      registration_number: "9.402",
      status: "regular",
      health_score: 96,
    },
    {
      name: SERRA_VERDE,
      type: "rural",
      entity: AGRO,
      value: 18_700_000,
      location: "Ponta Grossa/PR",
      area: "520 ha",
      registration_number: "4.771",
      status: "pendente",
      health_score: 78,
    },
    {
      name: RIO_VERDE,
      type: "rural",
      entity: AGRO,
      value: 22_000_000,
      location: "Rio Verde/GO",
      area: "2.800 ha",
      registration_number: "31.205",
      status: "critico",
      health_score: 61,
    },
    {
      name: CORPORATE,
      type: "urbano",
      entity: RE,
      value: 24_500_000,
      location: "São Paulo/SP",
      area: "4.200 m²",
      registration_number: "88.114",
      status: "regular",
      health_score: 98,
    },
    {
      name: GALPAO,
      type: "urbano",
      entity: RE,
      value: 12_800_000,
      location: "Osasco/SP",
      area: "6.800 m²",
      registration_number: "102.559",
      status: "regular",
      health_score: 92,
    },
    {
      name: JARDINS,
      type: "urbano",
      entity: RE,
      value: 6_400_000,
      location: "São Paulo/SP",
      area: "320 m²",
      registration_number: "145.882",
      status: "regular",
      health_score: 99,
    },
    {
      name: BATEL,
      type: "urbano",
      entity: HOLDING,
      value: 5_900_000,
      location: "Curitiba/PR",
      area: "410 m²",
      registration_number: "66.320",
      status: "alerta",
      health_score: 84,
    },
    {
      name: SALA,
      type: "urbano",
      entity: HOLDING,
      value: 2_100_000,
      location: "Londrina/PR",
      area: "180 m²",
      registration_number: "51.907",
      status: "regular",
      health_score: 95,
    },
    {
      name: TERRENO,
      type: "urbano",
      entity: RE,
      value: 7_200_000,
      location: "Arapongas/PR",
      area: "32.000 m²",
      registration_number: "77.014",
      status: "pendente",
      health_score: 74,
    },
    {
      name: HELI,
      type: "veiculo",
      entity: HOLDING,
      value: 9_800_000,
      location: "São Paulo/SP",
      area: "—",
      registration_number: "PR-HLA",
      status: "alerta",
      health_score: 80,
    },
    {
      name: TRATORES,
      type: "veiculo",
      entity: AGRO,
      value: 3_400_000,
      location: "Apucarana/PR",
      area: "—",
      registration_number: "FROTA-AGRO",
      status: "regular",
      health_score: 90,
    },
  ];

  const documents: DemoDocument[] = [
    {
      title: "Matrícula 12.884 — Fazenda Santa Fé",
      type: "Matrícula",
      asset: FAZENDA,
      expiresInDays: 2_190,
      status: "alerta",
      ocr_processed: true,
    },
    {
      title: "Georreferenciamento INCRA — Santa Fé",
      type: "Certidão",
      asset: FAZENDA,
      expiresInDays: -34,
      status: "critico",
      ocr_processed: true,
    },
    {
      title: "CAR — Fazenda Rio Verde",
      type: "Cadastro Ambiental Rural",
      asset: RIO_VERDE,
      expiresInDays: 21,
      status: "pendente",
      ocr_processed: true,
    },
    {
      title: "Escritura — Cobertura Batel",
      type: "Escritura",
      asset: BATEL,
      expiresInDays: 3_650,
      status: "alerta",
      ocr_processed: true,
    },
    {
      title: "Averbação de divórcio — Batel",
      type: "Certidão",
      asset: BATEL,
      expiresInDays: -8,
      status: "critico",
      ocr_processed: false,
    },
    {
      title: "CND Federal — Holding Alencar",
      type: "CND",
      asset: null,
      expiresInDays: 12,
      status: "pendente",
      ocr_processed: true,
    },
    {
      title: "Alvará de funcionamento — Galpão Anhanguera",
      type: "Alvará",
      asset: GALPAO,
      expiresInDays: 48,
      status: "regular",
      ocr_processed: true,
    },
    {
      title: "Apólice de seguro — Corporate Prime",
      type: "Contrato",
      asset: CORPORATE,
      expiresInDays: 96,
      status: "regular",
      ocr_processed: true,
    },
    {
      title: "Contrato de arrendamento — Rio Verde",
      type: "Contrato",
      asset: RIO_VERDE,
      expiresInDays: 310,
      status: "alerta",
      ocr_processed: false,
    },
    {
      title: "Laudo ANAC — Helicóptero H130",
      type: "Laudo Técnico",
      asset: HELI,
      expiresInDays: -2,
      status: "critico",
      ocr_processed: true,
    },
    {
      title: "Certidão negativa de ônus — Jardins",
      type: "Certidão",
      asset: JARDINS,
      expiresInDays: 27,
      status: "regular",
      ocr_processed: true,
    },
    {
      title: "ITR 2025 — Serra Verde",
      type: "Comprovante",
      asset: SERRA_VERDE,
      expiresInDays: 5,
      status: "pendente",
      ocr_processed: true,
    },
  ];

  const risks: DemoRisk[] = [
    {
      title: "Georreferenciamento da Fazenda Santa Fé vencido",
      description:
        "Certificação do INCRA expirou há 34 dias. Impede averbação e financiamento rural.",
      severity: "critical",
      asset: FAZENDA,
      responsible: "Carlos Menezes",
      dueInDays: 3,
    },
    {
      title: "CAR da Fazenda Rio Verde com sobreposição de reserva legal",
      description:
        "Sobreposição de 118 ha com área de reserva legal de terceiro. Risco de embargo ambiental.",
      severity: "critical",
      asset: RIO_VERDE,
      responsible: "Carlos Menezes",
      dueInDays: 9,
    },
    {
      title: "Averbação de divórcio pendente na Cobertura Batel",
      description: "Escritura registrada sem averbação da partilha. Bloqueia venda e inventário.",
      severity: "high",
      asset: BATEL,
      responsible: "Lucia Prado",
      dueInDays: 14,
    },
    {
      title: "Laudo ANAC do Helicóptero H130 vencido",
      description: "Aeronave não pode operar até a renovação do laudo de aeronavegabilidade.",
      severity: "high",
      asset: HELI,
      responsible: "Carlos Menezes",
      dueInDays: 1,
    },
    {
      title: "CND Federal da Holding a renovar",
      description: "Certidão vence em 12 dias; necessária para participar de licitações.",
      severity: "high",
      asset: null,
      responsible: "Lucia Prado",
      dueInDays: 12,
    },
    {
      title: "ITR 2025 da Serra Verde não recolhido",
      description: "Guia pendente de pagamento. Sujeito a multa e atualização pela SELIC.",
      severity: "medium",
      asset: SERRA_VERDE,
      responsible: "Roberto Alencar",
      dueInDays: 5,
    },
    {
      title: "Contrato de arrendamento sem registro em cartório",
      description: "Arrendamento de 2.800 ha em Rio Verde sem registro — inoponível a terceiros.",
      severity: "medium",
      asset: RIO_VERDE,
      responsible: "Lucia Prado",
      dueInDays: 38,
    },
    {
      title: "Alvará do Galpão Anhanguera próximo do vencimento",
      description: "Renovação antecipada recomendada para evitar interrupção operacional.",
      severity: "low",
      asset: GALPAO,
      responsible: "Carlos Menezes",
      dueInDays: 48,
    },
  ];

  const transactions: DemoTransaction[] = [
    {
      title: "Arrendamento Fazenda Boa Vista",
      entity: AGRO,
      asset: BOA_VISTA,
      amount: 780_000,
      type: "income",
      category: "Arrendamento",
      monthsAgo: 0,
      day: 5,
    },
    {
      title: "Dividendos Alencar Participações",
      entity: HOLDING,
      asset: null,
      amount: 1_250_000,
      type: "income",
      category: "Dividendos",
      monthsAgo: 0,
      day: 12,
    },
    {
      title: "IPTU Corporate Prime (parcela 10/12)",
      entity: RE,
      asset: CORPORATE,
      amount: 48_500,
      type: "expense",
      category: "IPTU",
      monthsAgo: 0,
      day: 10,
    },
    {
      title: "Consultoria agronômica",
      entity: AGRO,
      asset: FAZENDA,
      amount: 92_000,
      type: "expense",
      category: "Consultoria",
      monthsAgo: 0,
      day: 18,
    },
    {
      title: "Venda de soja — safra 25/26",
      entity: AGRO,
      asset: FAZENDA,
      amount: 3_450_000,
      type: "income",
      category: "Venda de Grãos",
      monthsAgo: 1,
      day: 22,
    },
    {
      title: "ITR 2025 — Serra Verde",
      entity: AGRO,
      asset: SERRA_VERDE,
      amount: 186_000,
      type: "expense",
      category: "ITR",
      monthsAgo: 1,
      day: 9,
    },
    {
      title: "Locação Jardins",
      entity: RE,
      asset: JARDINS,
      amount: 34_000,
      type: "income",
      category: "Locação",
      monthsAgo: 1,
      day: 5,
    },
    {
      title: "Seguro patrimonial anual",
      entity: HOLDING,
      asset: CORPORATE,
      amount: 210_000,
      type: "expense",
      category: "Seguro",
      monthsAgo: 2,
      day: 14,
    },
    {
      title: "Locação Galpão Anhanguera",
      entity: RE,
      asset: GALPAO,
      amount: 168_000,
      type: "income",
      category: "Locação",
      monthsAgo: 2,
      day: 6,
    },
    {
      title: "Manutenção de frota",
      entity: AGRO,
      asset: TRATORES,
      amount: 74_000,
      type: "expense",
      category: "Manutenção",
      monthsAgo: 2,
      day: 20,
    },
    {
      title: "Dividendos Alencar Participações",
      entity: HOLDING,
      asset: null,
      amount: 980_000,
      type: "income",
      category: "Dividendos",
      monthsAgo: 3,
      day: 11,
    },
    {
      title: "Honorários advocatícios",
      entity: HOLDING,
      asset: null,
      amount: 65_000,
      type: "expense",
      category: "Jurídico",
      monthsAgo: 3,
      day: 27,
    },
    {
      title: "Arrendamento Fazenda Boa Vista",
      entity: AGRO,
      asset: BOA_VISTA,
      amount: 780_000,
      type: "income",
      category: "Arrendamento",
      monthsAgo: 3,
      day: 5,
    },
    {
      title: "IPTU Galpão Anhanguera (cota única)",
      entity: RE,
      asset: GALPAO,
      amount: 96_000,
      type: "expense",
      category: "IPTU",
      monthsAgo: 4,
      day: 8,
    },
    {
      title: "Venda de milho — safrinha",
      entity: AGRO,
      asset: BOA_VISTA,
      amount: 1_920_000,
      type: "income",
      category: "Venda de Grãos",
      monthsAgo: 4,
      day: 19,
    },
    {
      title: "Manutenção predial Corporate Prime",
      entity: RE,
      asset: CORPORATE,
      amount: 132_000,
      type: "expense",
      category: "Manutenção",
      monthsAgo: 5,
      day: 16,
    },
    {
      title: "Locação Jardins",
      entity: RE,
      asset: JARDINS,
      amount: 34_000,
      type: "income",
      category: "Locação",
      monthsAgo: 5,
      day: 5,
    },
    {
      title: "Taxa de fiscalização ANAC",
      entity: HOLDING,
      asset: HELI,
      amount: 28_000,
      type: "expense",
      category: "Taxas",
      monthsAgo: 6,
      day: 13,
    },
    {
      title: "Dividendos Alencar Participações",
      entity: HOLDING,
      asset: null,
      amount: 1_100_000,
      type: "income",
      category: "Dividendos",
      monthsAgo: 6,
      day: 10,
    },
    {
      title: "Compra de insumos — safra",
      entity: AGRO,
      asset: FAZENDA,
      amount: 1_640_000,
      type: "expense",
      category: "Insumos",
      monthsAgo: 7,
      day: 21,
    },
    {
      title: "Locação Galpão Anhanguera",
      entity: RE,
      asset: GALPAO,
      amount: 168_000,
      type: "income",
      category: "Locação",
      monthsAgo: 7,
      day: 6,
    },
    {
      title: "Folha de pagamento — equipe agro",
      entity: AGRO,
      asset: null,
      amount: 384_000,
      type: "expense",
      category: "Pessoal",
      monthsAgo: 8,
      day: 30,
    },
    {
      title: "Venda de soja — safra 24/25",
      entity: AGRO,
      asset: FAZENDA,
      amount: 2_980_000,
      type: "income",
      category: "Venda de Grãos",
      monthsAgo: 9,
      day: 24,
    },
    {
      title: "Assessoria de family office",
      entity: HOLDING,
      asset: null,
      amount: 48_000,
      type: "expense",
      category: "Consultoria",
      monthsAgo: 10,
      day: 15,
    },
  ];

  const insights: DemoInsight[] = [
    {
      type: "documental",
      severity: "critical",
      title: "Georreferenciamento vencido trava a Fazenda Santa Fé",
      description:
        "A certificação do INCRA da matrícula 12.884 venceu há 34 dias. Sem ela, não há averbação de área nem acesso a crédito rural com garantia real.",
      entity: AGRO,
      asset: FAZENDA,
      metadata: { matricula: "12.884", diasVencido: 34, area_ha: 1240 },
    },
    {
      type: "agro",
      severity: "critical",
      title: "Sobreposição de reserva legal na Rio Verde",
      description:
        "O CAR aponta 118 ha sobrepostos a reserva legal de terceiro. Exposição a embargo ambiental e autuação do órgão estadual.",
      entity: AGRO,
      asset: RIO_VERDE,
      metadata: { area_sobreposta_ha: 118, protocolo_car: "GO-5218805-9F2A" },
    },
    {
      type: "risco",
      severity: "high",
      title: "Aeronave H130 sem laudo de aeronavegabilidade",
      description:
        "Laudo ANAC venceu há 2 dias. Operação irregular expõe a holding a multa e invalida cobertura securitária.",
      entity: HOLDING,
      asset: HELI,
      metadata: { prefixo: "PR-HLA", diasVencido: 2 },
    },
    {
      type: "patrimonial",
      severity: "medium",
      title: "Concentração de 42% do patrimônio em ativos rurais no PR",
      description:
        "R$ 81,2M em quatro propriedades paranaenses. Risco climático e de preço de commodities correlacionados.",
      entity: AGRO,
      asset: null,
      metadata: { percentual: 42, valor_brl: 81_200_000 },
    },
    {
      type: "compliance",
      severity: "medium",
      title: "CND Federal vence em 12 dias",
      description:
        "A certidão da Holding é exigida em três processos de licitação abertos. Renovação leva até 5 dias úteis.",
      entity: HOLDING,
      asset: null,
      metadata: { dias_restantes: 12, processos: 3 },
    },
    {
      type: "patrimonial",
      severity: "low",
      title: "Terreno de Arapongas com potencial de incorporação",
      description:
        "32.000 m² em zona industrial com FCA favorável. Estudo preliminar indica VGV de R$ 41M em galpões logísticos.",
      entity: RE,
      asset: TERRENO,
      metadata: { area_m2: 32000, vgv_estimado_brl: 41_000_000 },
    },
  ];

  const actionPlans: DemoActionPlan[] = [
    {
      insightTitle: "Georreferenciamento vencido trava a Fazenda Santa Fé",
      title: "Contratar recertificação INCRA da matrícula 12.884",
      priority: "P1",
      status: "in_progress",
      dueInDays: 15,
      suggested_resolution:
        "Acionar o topógrafo credenciado, reapresentar o SIGEF e averbar o memorial descritivo no registro de imóveis de Apucarana.",
      impact_analysis:
        "Libera R$ 48,5M em garantia real para crédito rural e destrava a averbação da área.",
    },
    {
      insightTitle: "Sobreposição de reserva legal na Rio Verde",
      title: "Retificar o CAR da Fazenda Rio Verde",
      priority: "P1",
      status: "pending",
      dueInDays: 20,
      suggested_resolution:
        "Solicitar retificação no SICAR com laudo técnico e acordo de recomposição com o proprietário confrontante.",
      impact_analysis:
        "Mitiga risco de embargo sobre 2.800 ha e multa ambiental estimada em R$ 1,4M.",
    },
    {
      insightTitle: "Aeronave H130 sem laudo de aeronavegabilidade",
      title: "Renovar laudo ANAC do H130",
      priority: "P1",
      status: "pending",
      dueInDays: 7,
      suggested_resolution:
        "Agendar inspeção em oficina homologada e emitir novo CA (certificado de aeronavegabilidade).",
      impact_analysis: "Elimina exposição de R$ 9,8M em ativo sem cobertura válida.",
    },
    {
      insightTitle: "CND Federal vence em 12 dias",
      title: "Emitir nova CND Federal da Holding",
      priority: "P2",
      status: "pending",
      dueInDays: 10,
      suggested_resolution:
        "Baixar certidão no e-CAC e arquivar no cofre digital com alerta de 90 dias.",
      impact_analysis: "Mantém elegibilidade em 3 processos licitatórios ativos.",
    },
    {
      insightTitle: "Terreno de Arapongas com potencial de incorporação",
      title: "Encomendar estudo de viabilidade do terreno",
      priority: "P3",
      status: "completed",
      dueInDays: -5,
      suggested_resolution: "Contratar estudo de massa e VGV com arquiteto parceiro.",
      impact_analysis:
        "Potencial de VGV de R$ 41M; decisão de investimento prevista para o próximo trimestre.",
    },
  ];

  const healthScores: DemoHealthScore[] = [
    {
      entity: null,
      patrimonial_score: 81.0,
      documental_score: 72.4,
      compliance_score: 78.2,
      risk_score: 83.5,
      global_score: 78.8,
      monthsAgo: 5,
    },
    {
      entity: null,
      patrimonial_score: 84.6,
      documental_score: 76.8,
      compliance_score: 81.0,
      risk_score: 86.2,
      global_score: 82.2,
      monthsAgo: 4,
    },
    {
      entity: null,
      patrimonial_score: 88.1,
      documental_score: 79.5,
      compliance_score: 84.3,
      risk_score: 89.0,
      global_score: 85.2,
      monthsAgo: 3,
    },
    {
      entity: null,
      patrimonial_score: 91.4,
      documental_score: 82.7,
      compliance_score: 87.6,
      risk_score: 92.4,
      global_score: 88.5,
      monthsAgo: 2,
    },
    {
      entity: null,
      patrimonial_score: 94.0,
      documental_score: 85.1,
      compliance_score: 90.2,
      risk_score: 95.1,
      global_score: 91.1,
      monthsAgo: 1,
    },
    {
      entity: null,
      patrimonial_score: 96.5,
      documental_score: 88.0,
      compliance_score: 92.4,
      risk_score: 98.1,
      global_score: 94.2,
      monthsAgo: 0,
    },
  ];

  const suppliers: DemoSupplier[] = [
    {
      name: "AgroInsumos Paraná Ltda.",
      entity: AGRO,
      tax_id: "45.678.901/0001-23",
      category: "Insumos",
      contact_email: "comercial@agroinsumospr.com.br",
      status: "homologado",
      compliance_score: 98,
      contract_value: 1_850_000,
      contractExpiryInDays: 210,
      notes: "Fornecedor de fertilizantes e defensivos. Contrato com reajuste anual pelo IPCA.",
    },
    {
      name: "Topografia Vale do Ivaí",
      entity: AGRO,
      tax_id: "56.789.012/0001-34",
      category: "Serviços Técnicos",
      contact_email: "contato@topovale.com.br",
      status: "em_analise",
      compliance_score: 82,
      contract_value: 148_000,
      contractExpiryInDays: 45,
      notes: "Responsável pela recertificação INCRA da matrícula 12.884.",
    },
    {
      name: "Alencar & Prado Advogados",
      entity: HOLDING,
      tax_id: "67.890.123/0001-45",
      category: "Jurídico",
      contact_email: "socios@alencarprado.adv.br",
      status: "homologado",
      compliance_score: 96,
      contract_value: 420_000,
      contractExpiryInDays: 320,
      notes: "Assessoria societária e contencioso estratégico.",
    },
    {
      name: "Construtora Horizonte Sul",
      entity: RE,
      tax_id: "78.901.234/0001-56",
      category: "Obras",
      contact_email: "obras@horizontesul.com.br",
      status: "risco_critico",
      compliance_score: 41,
      contract_value: 3_200_000,
      contractExpiryInDays: -12,
      notes: "Certidões trabalhistas vencidas e atraso na entrega da reforma do Corporate Prime.",
    },
    {
      name: "Seguros Atlântico Sul",
      entity: HOLDING,
      tax_id: "89.012.345/0001-67",
      category: "Seguros",
      contact_email: "corporate@atlanticosul.com.br",
      status: "homologado",
      compliance_score: 94,
      contract_value: 640_000,
      contractExpiryInDays: 92,
      notes: "Apólice patrimonial e de frota. Revisão de cobertura em andamento.",
    },
    {
      name: "TechPatrimônio Sistemas",
      entity: HOLDING,
      tax_id: "90.123.456/0001-78",
      category: "TI",
      contact_email: "sucesso@techpatrimonio.com.br",
      status: "em_analise",
      compliance_score: 76,
      contract_value: 96_000,
      contractExpiryInDays: 30,
      notes: "Integração de dados agronômicos. LGPD em revisão pelo jurídico.",
    },
    {
      name: "Transportes Boa Safra",
      entity: AGRO,
      tax_id: "01.234.567/0001-89",
      category: "Logística",
      contact_email: "operacoes@boasafra.com.br",
      status: "inativo",
      compliance_score: 58,
      contract_value: 380_000,
      contractExpiryInDays: -180,
      notes: "Contrato encerrado após incidente de sinistralidade em carga.",
    },
  ];

  const legalCases: DemoLegalCase[] = [
    {
      case_number: "5001234-56.2024.8.16.0001",
      title: "Ação de retificação de área — Fazenda Santa Fé",
      entity: AGRO,
      asset: FAZENDA,
      type: "imobiliario",
      status: "em_andamento",
      court: "2ª Vara Cível de Apucarana/PR",
      risk_level: "high",
      value_at_stake: 4_800_000,
      hearingInDays: 12,
      responsible: "Lucia Prado",
      notes: "Divergência de 42 ha entre matrícula e georreferenciamento do INCRA.",
    },
    {
      case_number: "5009876-12.2025.8.16.0001",
      title: "Auto de infração ambiental — Rio Verde",
      entity: AGRO,
      asset: RIO_VERDE,
      type: "ambiental",
      status: "em_andamento",
      court: "Vara Ambiental de Goiânia/GO",
      risk_level: "critical",
      value_at_stake: 1_420_000,
      hearingInDays: 5,
      responsible: "Lucia Prado",
      notes: "Embargo parcial de 118 ha por sobreposição de reserva legal.",
    },
    {
      case_number: "1002345-67.2023.8.26.0100",
      title: "Execução fiscal de IPTU — Galpão Anhanguera",
      entity: RE,
      asset: GALPAO,
      type: "tributario",
      status: "acordo",
      court: "Vara da Fazenda Pública de Osasco/SP",
      risk_level: "medium",
      value_at_stake: 320_000,
      hearingInDays: 40,
      responsible: "Roberto Alencar",
      notes: "Parcelamento em 24x homologado; acompanhar pagamento das parcelas.",
    },
    {
      case_number: "1008765-43.2025.8.26.0100",
      title: "Reclamação trabalhista — obra Corporate Prime",
      entity: RE,
      asset: CORPORATE,
      type: "trabalhista",
      status: "em_andamento",
      court: "17ª Vara do Trabalho de São Paulo/SP",
      risk_level: "high",
      value_at_stake: 780_000,
      hearingInDays: 21,
      responsible: "Lucia Prado",
      notes: "Responsabilidade subsidiária da tomadora; envolve a Construtora Horizonte Sul.",
    },
    {
      case_number: "5003456-78.2022.8.16.0001",
      title: "Inventário e partilha — sucessão do patriarca",
      entity: HOLDING,
      asset: null,
      type: "societario",
      status: "em_andamento",
      court: "1ª Vara de Família e Sucessões de Apucarana/PR",
      risk_level: "critical",
      value_at_stake: 68_500_000,
      hearingInDays: 30,
      responsible: "Roberto Alencar",
      notes: "Definir doação com usufruto antes da sentença para reduzir custo de ITCMD.",
    },
    {
      case_number: "5007654-32.2021.8.16.0001",
      title: "Ação de despejo — Sala Comercial Centro",
      entity: HOLDING,
      asset: SALA,
      type: "civel",
      status: "encerrado",
      court: "1ª Vara Cível de Londrina/PR",
      risk_level: "low",
      value_at_stake: 96_000,
      hearingInDays: -120,
      responsible: "Roberto Alencar",
      notes: "Acordo cumprido; imóvel reocupado por novo locatário.",
    },
  ];

  // ------------------------------------------------------------ custódia
  const accounts: DemoAccount[] = [
    {
      entity: HOLDING,
      custodian: "XP Investimentos",
      name: "XP Private — Holding",
      kind: "corretora",
      currency: "BRL",
      accountNumber: "XP-4410293",
    },
    {
      entity: HOLDING,
      custodian: "BTG Pactual",
      name: "BTG Core — Holding",
      kind: "corretora",
      currency: "BRL",
      accountNumber: "BTG-88120-4",
    },
    {
      entity: AGRO,
      custodian: "Itaú Private Bank",
      name: "Itaú Private — Agro",
      kind: "banco",
      currency: "BRL",
      accountNumber: "ITA-0091-338",
    },
    {
      entity: RE,
      custodian: "Interactive Brokers",
      name: "IBKR — Internacional",
      kind: "corretora",
      currency: "USD",
      accountNumber: "U7741029",
    },
  ];

  const positions: DemoPosition[] = [
    // Holding — renda fixa e caixa (liquidez do grupo)
    { entity: HOLDING, account: "XP Private — Holding", asset_class: "caixa", liquidity: "d0", symbol: "CDB-LIQ", name: "CDB Liquidez Diária XP", quantity: 1_200_000, unit_price: 1, cost_basis: 1_200_000, currency: "BRL" },
    { entity: HOLDING, account: "XP Private — Holding", asset_class: "renda_fixa", liquidity: "d1", symbol: "TESOURO-IPCA-2035", name: "Tesouro IPCA+ 2035", quantity: 1_500, unit_price: 3_180, cost_basis: 4_500_000, currency: "BRL" },
    { entity: HOLDING, account: "BTG Core — Holding", asset_class: "renda_fixa", liquidity: "longo_prazo", symbol: "DEB-AGRO", name: "Debênture Agronegócio BTG", quantity: 800, unit_price: 1_050, cost_basis: 800_000, currency: "BRL" },
    { entity: HOLDING, account: "BTG Core — Holding", asset_class: "renda_variavel", liquidity: "d1", symbol: "ITUB4", name: "Itaú Unibanco PN", quantity: 40_000, unit_price: 38.4, cost_basis: 1_180_000, currency: "BRL" },
    { entity: HOLDING, account: "BTG Core — Holding", asset_class: "renda_variavel", liquidity: "d1", symbol: "PETR4", name: "Petrobras PN", quantity: 30_000, unit_price: 41.2, cost_basis: 1_020_000, currency: "BRL" },
    { entity: HOLDING, account: "XP Private — Holding", asset_class: "fundos", liquidity: "d30", symbol: "FIM-MULTI", name: "Fundo Multimercado Alencar", quantity: 4_000, unit_price: 620, cost_basis: 2_100_000, currency: "BRL" },
    // Agro — capital de giro e fundo de investimento em cadeia produtiva
    { entity: AGRO, account: "Itaú Private — Agro", asset_class: "caixa", liquidity: "d0", symbol: "CC-AGRO", name: "Conta corrente Agro", quantity: 680_000, unit_price: 1, cost_basis: 680_000, currency: "BRL" },
    { entity: AGRO, account: "Itaú Private — Agro", asset_class: "alternativos", liquidity: "iliquido", symbol: "FIAGRO", name: "Fundo de investimento agro (FIAGRO)", quantity: 25_000, unit_price: 112, cost_basis: 2_400_000, currency: "BRL" },
    // Real Estate — participação em SPE
    { entity: RE, account: "BTG Core — Holding", asset_class: "alternativos", liquidity: "iliquido", symbol: "SPE-CORP", name: "SPE Edifício Corporate (participação)", quantity: 1, unit_price: 12_400_000, cost_basis: 9_800_000, currency: "BRL" },
    // Internacional — offshore
    { entity: RE, account: "IBKR — Internacional", asset_class: "internacional", liquidity: "d1", symbol: "VT", name: "Vanguard Total World ETF", quantity: 1_800, unit_price: 128.5, cost_basis: 190_000, currency: "USD", is_offshore: true },
    { entity: RE, account: "IBKR — Internacional", asset_class: "internacional", liquidity: "d30", symbol: "BND", name: "Vanguard Total Bond ETF", quantity: 900, unit_price: 72.4, cost_basis: 62_000, currency: "USD", is_offshore: true },
    { entity: HOLDING, account: "XP Private — Holding", asset_class: "cripto", liquidity: "d1", symbol: "BTC", name: "Bitcoin (custódia XP)", quantity: 0.85, unit_price: 512_000, cost_basis: 260_000, currency: "BRL" },
  ];

  const cashFlows: DemoCashFlow[] = [
    { entity: HOLDING, account: "XP Private — Holding", kind: "aporte", amount: 500_000, daysAgo: -420, description: "Aporte mensal programado" },
    { entity: HOLDING, account: "XP Private — Holding", kind: "provento", amount: 48_000, daysAgo: -300, description: "Cupom semestral Tesouro IPCA+" },
    { entity: AGRO, account: "Itaú Private — Agro", kind: "aporte", amount: 350_000, daysAgo: -210, description: "Capital de giro para safra" },
    { entity: HOLDING, account: "BTG Core — Holding", kind: "resgate", amount: 120_000, daysAgo: -150, description: "Resgate para aquisição de imóvel" },
    { entity: RE, account: "IBKR — Internacional", kind: "aporte", amount: 60_000, daysAgo: -90, description: "Aporte em ETF global (USD)" },
    { entity: HOLDING, account: "XP Private — Holding", kind: "provento", amount: 32_500, daysAgo: -30, description: "Dividendos ITUB4/PETR4" },
  ];

  // Série mensal: patrimônio crescendo com um vale em M3 (retrata drawdown real).
  const snapshots = [
    { entity: HOLDING, monthOffset: 5, marketValue: 14_200_000, costBasis: 13_100_000, netFlow: 0 },
    { entity: HOLDING, monthOffset: 4, marketValue: 14_680_000, costBasis: 13_100_000, netFlow: 0 },
    { entity: HOLDING, monthOffset: 3, marketValue: 14_120_000, costBasis: 13_600_000, netFlow: 500_000 },
    { entity: HOLDING, monthOffset: 2, marketValue: 14_950_000, costBasis: 13_600_000, netFlow: 0 },
    { entity: HOLDING, monthOffset: 1, marketValue: 15_340_000, costBasis: 13_600_000, netFlow: 0 },
    { entity: HOLDING, monthOffset: 0, marketValue: 15_820_000, costBasis: 13_600_000, netFlow: 0 },
    { entity: AGRO, monthOffset: 5, marketValue: 3_050_000, costBasis: 3_050_000, netFlow: 0 },
    { entity: AGRO, monthOffset: 4, marketValue: 3_140_000, costBasis: 3_050_000, netFlow: 0 },
    { entity: AGRO, monthOffset: 3, marketValue: 3_210_000, costBasis: 3_400_000, netFlow: 350_000 },
    { entity: AGRO, monthOffset: 2, marketValue: 3_260_000, costBasis: 3_400_000, netFlow: 0 },
    { entity: AGRO, monthOffset: 1, marketValue: 3_305_000, costBasis: 3_400_000, netFlow: 0 },
    { entity: AGRO, monthOffset: 0, marketValue: 3_380_000, costBasis: 3_400_000, netFlow: 0 },
    { entity: RE, monthOffset: 5, marketValue: 11_900_000, costBasis: 9_800_000, netFlow: 0 },
    { entity: RE, monthOffset: 4, marketValue: 12_050_000, costBasis: 9_860_000, netFlow: 60_000 },
    { entity: RE, monthOffset: 3, marketValue: 12_180_000, costBasis: 9_860_000, netFlow: 0 },
    { entity: RE, monthOffset: 2, marketValue: 12_420_000, costBasis: 9_860_000, netFlow: 0 },
    { entity: RE, monthOffset: 1, marketValue: 12_690_000, costBasis: 9_860_000, netFlow: 0 },
    { entity: RE, monthOffset: 0, marketValue: 12_880_000, costBasis: 9_860_000, netFlow: 0 },
  ];

  return {
    entities,
    members,
    assets,
    documents,
    risks,
    transactions,
    insights,
    actionPlans,
    healthScores,
    suppliers,
    legalCases,
    accounts,
    positions,
    cashFlows,
    snapshots,
  };
}
