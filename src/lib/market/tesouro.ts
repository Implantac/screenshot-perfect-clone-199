/**
 * Renda fixa marcada a mercado — Tesouro Direto (wave 27).
 *
 * POR QUE ESTE MÓDULO EXISTE
 * O score de qualidade do dado penaliza "posição sem preço" e "preço velho", e até
 * aqui o título público era o único ativo relevante que só sabia ser digitado à
 * mão. Ação tem Yahoo/brapi, fundo tem a CVM, **título público tem o Tesouro
 * Transparente** — e é justamente a fatia que o cliente de family office carrega
 * para reserva de liquidez e para o passivo de sucessão.
 *
 * A FONTE
 * CSV público "Taxas dos Títulos Ofertados pelo Tesouro Direto"
 * (`precotaxatesourodireto.csv`, CKAN do Tesouro Transparente): ~178 mil linhas,
 * 14,6 MB, `;` como separador, decimal com vírgula, datas dd/mm/aaaa. Traz o PU
 * (preço unitário) **já calculado** de compra, venda e base — não recalculamos
 * VNA nem cupom: usar o número oficial evita divergir do extrato do cliente.
 *
 * DECISÕES QUE MOLDAM O CÓDIGO
 *  1. **O parser é uma função pura sobre texto.** Nada de rede aqui: o parse é
 *     testável com uma amostra real do arquivo, e a borda (fetch) fica na server
 *     function.
 *  2. **Vendemos honestidade, não sofisticação.** O PU de venda é o que o cliente
 *     receberia ao resgatar hoje; é esse que marca a posição. O de compra aparece
 *     como spread, não como valor.
 *  3. **Reconhecer o título é o problema difícil.** "Tesouro IPCA+ 2035" digitado
 *     pelo operador precisa virar (NTN-B Principal, 15/05/2035) sem adivinhar:
 *     quando dois vencimentos cabem no rótulo, a resposta é "ambíguo" com a lista,
 *     nunca o primeiro da fila.
 *  4. **O que não está coberto, está dito.** Debênture, CRI, CRA, CDB e LCA não
 *     têm PU público aqui — continuam manuais, e a tela diz isso na cara.
 */

// ---------------------------------------------------------------------------
// Tipos de título
// ---------------------------------------------------------------------------

export type BondCode =
  | "LFT"
  | "LTN"
  | "NTN-F"
  | "NTN-B"
  | "NTN-B-PRINCIPAL"
  | "NTN-C"
  | "EDUCA+"
  | "RENDA+";

export type BondFamily = "selic" | "prefixado" | "ipca" | "igpm";

export type BondSpec = {
  code: BondCode;
  family: BondFamily;
  /** Nome oficial no CSV, como publicado. */
  officialName: string;
  /** Nome curto para a tela. */
  shortName: string;
  /** Paga cupom semestral (muda a leitura do PU: há cupom no meio do caminho). */
  semiannualCoupon: boolean;
  /** Indexado a índice de preços: o PU carrega o VNA, então comparar PU é enganoso. */
  inflationLinked: boolean;
};

/**
 * Nome publicado pelo Tesouro → especificação canônica.
 *
 * A ordem importa: "Tesouro IPCA+ com Juros Semestrais" precisa ser reconhecido
 * antes de "Tesouro IPCA+", e o mesmo vale para prefixado. Por isso a busca é do
 * nome mais longo para o mais curto, e não por `includes` em ordem de array.
 */
export const BOND_SPECS: BondSpec[] = [
  {
    code: "NTN-B",
    family: "ipca",
    officialName: "Tesouro IPCA+ com Juros Semestrais",
    shortName: "IPCA+ com juros",
    semiannualCoupon: true,
    inflationLinked: true,
  },
  {
    code: "NTN-B-PRINCIPAL",
    family: "ipca",
    officialName: "Tesouro IPCA+",
    shortName: "IPCA+",
    semiannualCoupon: false,
    inflationLinked: true,
  },
  {
    code: "NTN-F",
    family: "prefixado",
    officialName: "Tesouro Prefixado com Juros Semestrais",
    shortName: "Prefixado com juros",
    semiannualCoupon: true,
    inflationLinked: false,
  },
  {
    code: "LTN",
    family: "prefixado",
    officialName: "Tesouro Prefixado",
    shortName: "Prefixado",
    semiannualCoupon: false,
    inflationLinked: false,
  },
  {
    code: "NTN-C",
    family: "igpm",
    officialName: "Tesouro IGPM+ com Juros Semestrais",
    shortName: "IGP-M+ com juros",
    semiannualCoupon: true,
    inflationLinked: true,
  },
  {
    code: "LFT",
    family: "selic",
    officialName: "Tesouro Selic",
    shortName: "Selic",
    semiannualCoupon: false,
    inflationLinked: false,
  },
  {
    code: "EDUCA+",
    family: "ipca",
    officialName: "Tesouro Educa+",
    shortName: "Educa+",
    semiannualCoupon: false,
    inflationLinked: true,
  },
  {
    code: "RENDA+",
    family: "ipca",
    officialName: "Tesouro Renda+ Aposentadoria Extra",
    shortName: "Renda+",
    semiannualCoupon: false,
    inflationLinked: true,
  },
];

const BY_OFFICIAL_NAME = new Map(BOND_SPECS.map((spec) => [spec.officialName.toLowerCase(), spec]));
const BY_CODE = new Map(BOND_SPECS.map((spec) => [spec.code, spec]));

/** Especificação a partir do nome publicado no CSV (ou `null` se desconhecido). */
export function specForOfficialName(name: string): BondSpec | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = BY_OFFICIAL_NAME.get(key);
  if (exact) return exact;
  // Tolerância a variação de caixa/acento e a "Tesouro IPCA + ..." com espaço.
  const collapsed = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\+\s*/g, "+");
  for (const spec of BOND_SPECS) {
    const candidate = spec.officialName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s*\+\s*/g, "+");
    if (candidate === collapsed) return spec;
  }
  return null;
}

export function specForCode(code: string): BondSpec | null {
  return BY_CODE.get(code as BondCode) ?? null;
}

// ---------------------------------------------------------------------------
// Números e datas no dialeto brasileiro
// ---------------------------------------------------------------------------

/**
 * `"2.509,91"` → `2509.91` · `"7,88"` → `7.88` · `""` → `null`.
 *
 * O CSV do Tesouro usa ponto de milhar e vírgula decimal. Um parser que só troca
 * vírgula por ponto transforma "1.234,56" em `NaN` — o erro clássico que faz o
 * preço sumir sem aviso. Aqui o ponto só é milhar quando há vírgula decimal ou
 * quando o padrão é de milhar (3 dígitos após o ponto).
 */
export function parseBrNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (value === "" || value === "-" || value === "--") return null;

  const negative = /^-/.test(value);
  const digits = value.replace(/[^\d.,]/g, "").replace(/^-/, "");
  if (digits === "") return null;

  let normalized: string;
  if (digits.includes(",")) {
    // ponto é milhar, vírgula é decimal
    normalized = digits.replace(/\./g, "").replace(",", ".");
  } else {
    // sem vírgula: "2509.91" é decimal; "2.509" e "1.234.567" são milhar
    const parts = digits.split(".");
    const isThousands =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3);
    normalized = isThousands ? parts.join("") : digits;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

/** `"15/05/2035"` → `"2035-05-15"`. Devolve `null` para data inexistente (31/02). */
export function parseBrDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Data real: 31/02 não pode virar 02/03 em silêncio (o Date faria isso).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** `"2035-05-15"` → `"15/05/2035"` (para a tela). */
export function isoToBrDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso;
}

// ---------------------------------------------------------------------------
// Linha e curva
// ---------------------------------------------------------------------------

export type TesouroRow = {
  code: BondCode;
  /** Nome oficial como veio (mantém a origem legível). */
  officialName: string;
  /** Vencimento em ISO (yyyy-mm-dd). */
  maturity: string;
  /** Data-base do preço (ISO). */
  asOf: string;
  /** Taxa ao ano, em % (compra e venda). */
  rateBuy: number;
  rateSell: number;
  /** PU (preço unitário) em R$. */
  puBuy: number;
  puSell: number;
  puBase: number;
};

export type ParseResult = {
  rows: TesouroRow[];
  /** Linhas descartadas (cabeçalho, rodapé, campo vazio, nome desconhecido). */
  skipped: number;
  /** Nomes de título que apareceram no arquivo e não temos especificação. */
  unknownBonds: string[];
  /** Colunas encontradas no header — prova de que o layout foi reconhecido. */
  columns: string[] | null;
};

const REQUIRED_COLUMNS = [
  "Tipo Titulo",
  "Data Vencimento",
  "Data Base",
  "Taxa Compra Manha",
  "Taxa Venda Manha",
  "PU Compra Manha",
  "PU Venda Manha",
  "PU Base Manha",
];

/** Índice de cada coluna pelo nome — o Tesouro já mudou rótulo antes; não confie na ordem. */
export function mapTesouroHeader(header: string): Record<string, number> | null {
  const columns = header.split(";").map((column) => column.trim());
  const index: Record<string, number> = {};
  for (const name of REQUIRED_COLUMNS) {
    const position = columns.indexOf(name);
    if (position < 0) return null;
    index[name] = position;
  }
  return index;
}

export type ParseOptions = {
  /** Mantém apenas linhas com data-base ≥ esta (ISO). Reduz 178 mil linhas ao necessário. */
  since?: string;
  /** Teto de linhas devolvidas (proteção de memória). */
  limit?: number;
};

/**
 * Converte o CSV inteiro em linhas tipadas.
 *
 * Leitura linha a linha, sem biblioteca: o arquivo é ASCII, o separador é `;` e
 * nenhum campo tem aspas — verificado na fonte. Se um dia passar a ter, o parser
 * conta a linha como descartada em vez de gravar preço errado.
 */
export function parseTesouroCsv(text: string, options: ParseOptions = {}): ParseResult {
  const lines = text.split(/\r?\n/);
  const rows: TesouroRow[] = [];
  const unknown = new Set<string>();
  let skipped = 0;
  let index: Record<string, number> | null = null;
  let columns: string[] | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (!index) {
      index = mapTesouroHeader(line);
      if (!index) {
        skipped += 1;
        continue;
      }
      columns = line.split(";").map((column) => column.trim());
      continue;
    }

    const cells = line.split(";");
    const nameRaw = cells[index["Tipo Titulo"]]?.trim() ?? "";
    const spec = specForOfficialName(nameRaw);
    if (!spec) {
      if (nameRaw) unknown.add(nameRaw);
      skipped += 1;
      continue;
    }

    const maturity = parseBrDate(cells[index["Data Vencimento"]]);
    const asOf = parseBrDate(cells[index["Data Base"]]);
    const rateBuy = parseBrNumber(cells[index["Taxa Compra Manha"]]);
    const rateSell = parseBrNumber(cells[index["Taxa Venda Manha"]]);
    const puBuy = parseBrNumber(cells[index["PU Compra Manha"]]);
    const puSell = parseBrNumber(cells[index["PU Venda Manha"]]);
    const puBase = parseBrNumber(cells[index["PU Base Manha"]]);

    // PU ≤ 0 e data inválida não são "preço zero": são linha quebrada.
    if (!maturity || !asOf || rateBuy === null || rateSell === null || puBuy === null || puSell === null) {
      skipped += 1;
      continue;
    }
    if (puSell <= 0 || puBuy <= 0) {
      skipped += 1;
      continue;
    }
    if (options.since && asOf < options.since) continue;

    rows.push({
      code: spec.code,
      officialName: spec.officialName,
      maturity,
      asOf,
      rateBuy,
      rateSell,
      puBuy,
      puSell,
      puBase: puBase ?? puSell,
    });

    if (options.limit && rows.length >= options.limit) break;
  }

  return { rows, skipped, unknownBonds: [...unknown].sort(), columns };
}

/** Símbolo canônico do título — o mesmo formato de `quotes.symbol`. */
export function bondSymbol(code: BondCode | string, maturity: string): string {
  return `TESOURO:${code}:${maturity}`;
}

/**
 * Reconstrói a linha a partir do símbolo canônico + preço gravado.
 *
 * `quotes` guarda só o PU de venda (preço é preço); taxa e PU de compra não são
 * preço de posição e por isso não vão para lá. Quando o painel só tem o que está
 * gravado, ele mostra o PU e declara que taxa/spread exigem sincronizar.
 */
export function bondFromSymbol(symbol: string, price: number, asOf: string): TesouroRow | null {
  const match = /^TESOURO:([A-Z+-]+):(\d{4}-\d{2}-\d{2})$/.exec(symbol);
  if (!match) return null;
  const spec = specForCode(match[1] as BondCode);
  if (!spec) return null;
  return {
    code: spec.code,
    officialName: spec.officialName,
    maturity: match[2] as string,
    asOf,
    rateBuy: 0,
    rateSell: 0,
    puBuy: price,
    puSell: price,
    puBase: price,
  };
}

/** Curva mais recente: um registro por (título, vencimento), do mais curto ao mais longo. */
export function latestCurve(rows: TesouroRow[]): TesouroRow[] {
  const latest = new Map<string, TesouroRow>();
  for (const row of rows) {
    const key = `${row.code}|${row.maturity}`;
    const current = latest.get(key);
    if (!current || row.asOf > current.asOf) latest.set(key, row);
  }
  return [...latest.values()].sort((a, b) =>
    a.maturity === b.maturity ? a.code.localeCompare(b.code) : a.maturity < b.maturity ? -1 : 1,
  );
}

// ---------------------------------------------------------------------------
// Reconhecer o título a partir do rótulo do operador
// ---------------------------------------------------------------------------

export type ResolveResult =
  | { status: "resolved"; bond: TesouroRow }
  | { status: "ambiguous"; candidates: TesouroRow[]; reason: string }
  | { status: "none"; reason: string };

/** Sem acento, minúsculo, sem pontuação supérflua. */
function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/tesouro nacional/g, "tesouro")
    .replace(/[^a-z0-9+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Tesouro IPCA+ 2035" → bond.
 *
 * Estratégia declarada (e é o que os testes fixam):
 *  - família pelo indexador explícito (selic / prefixado / ipca / igpm / educa / renda);
 *  - recorte por cupom: "com juros" ou "semestral" exige cupom; "principal" ou a
 *    ausência do termo, para IPCA+/Prefixado, prefere o título sem cupom;
 *  - vencimento pelo ano de 4 dígitos (aceita também dd/mm/aaaa);
 *  - sobrando mais de um candidato → `ambiguous` com a lista. Adivinhar aqui
 *    marcaria a carteira do cliente com o preço de outro título.
 */
export function resolveBondLabel(label: string, curve: TesouroRow[]): ResolveResult {
  const text = normalizeLabel(label ?? "");
  if (!text) return { status: "none", reason: "Rótulo vazio." };
  if (curve.length === 0) return { status: "none", reason: "Sem curva do Tesouro sincronizada." };

  let family: BondFamily | "educa" | "renda" | null = null;
  if (/\bselic\b|\blft\b/.test(text)) family = "selic";
  else if (/\beduca\b/.test(text)) family = "educa";
  else if (/\brenda\b/.test(text)) family = "renda";
  else if (/\bigpm\b|\bntn c\b|\bntnc\b/.test(text)) family = "igpm";
  else if (/\bipca\b/.test(text)) family = "ipca";
  else if (/\bprefixad/.test(text) || /\bltn\b/.test(text) || /\bntn f\b/.test(text)) family = "prefixado";

  if (!family) {
    return {
      status: "none",
      reason:
        "Não identifiquei o título. Use o nome do Tesouro (ex.: \"Tesouro IPCA+ 2035\", \"Tesouro Selic 2029\") na descrição da posição.",
    };
  }

  const wantsCoupon = /com juros|semestral|cupom/.test(text);
  const wantsPrincipal = /principal|sem cupom/.test(text);

  const byCode = (code: BondCode) => curve.filter((row) => row.code === code);
  let pool: TesouroRow[];
  if (family === "selic") pool = byCode("LFT");
  else if (family === "educa") pool = byCode("EDUCA+");
  else if (family === "renda") pool = byCode("RENDA+");
  else if (family === "igpm") pool = byCode("NTN-C");
  else if (family === "ipca") pool = wantsCoupon ? byCode("NTN-B") : byCode("NTN-B-PRINCIPAL");
  else pool = wantsCoupon ? byCode("NTN-F") : byCode("LTN");

  if (pool.length === 0) {
    return {
      status: "none",
      reason: `A curva sincronizada não tem ${family === "ipca" ? "NTN-B" : family} em oferta hoje.`,
    };
  }

  // Vencimento: ano de 4 dígitos (2029, 2035…) ou data completa.
  const fullDate = text.match(/\b(\d{1,2})[ /](\d{1,2})[ /](\d{4})\b/);
  const year = fullDate ? fullDate[3] : (text.match(/\b(20\d{2})\b/)?.[1] ?? null);

  // Sem vencimento e com mais de um papel em oferta: devolver "o mais curto" seria
  // escolher o preço pelo cliente. Lista as opções e para.
  if (!year) {
    if (pool.length === 1) return { status: "resolved", bond: pool[0] as TesouroRow };
    return {
      status: "ambiguous",
      candidates: pool,
      reason: `Faltou o vencimento. Há ${pool.length} títulos dessa família em oferta (${pool
        .map((row) => isoToBrDate(row.maturity))
        .join(", ")}).`,
    };
  }

  let candidates = pool;
  if (fullDate) {
    const iso = `${fullDate[3]}-${fullDate[2].padStart(2, "0")}-${fullDate[1].padStart(2, "0")}`;
    candidates = pool.filter((row) => row.maturity === iso);
  } else if (year) {
    candidates = pool.filter((row) => row.maturity.startsWith(`${year}-`));
  }

  if (candidates.length === 0) {
    const options = pool.map((row) => `${isoToBrDate(row.maturity)}`).join(", ");
    return {
      status: "none",
      reason: year
        ? `Não há título dessa família vencendo em ${year}. Vencimentos disponíveis: ${options}.`
        : `Faltou o vencimento. Vencimentos disponíveis: ${options}.`,
    };
  }

  if (candidates.length === 1) {
    const bond = candidates[0] as TesouroRow;
    return { status: "resolved", bond };
  }

  // Prefixado e IPCA+ sem termo explícito: se as duas variantes existirem, o
  // rótulo "sem cupom" é a leitura padrão só quando não há ambiguidade de cupom.
  if (!wantsCoupon && !wantsPrincipal) {
    const principalPool = candidates.filter((row) =>
      ["LTN", "NTN-B-PRINCIPAL", "LFT", "EDUCA+", "RENDA+"].includes(row.code),
    );
    if (principalPool.length === 1) return { status: "resolved", bond: principalPool[0] as TesouroRow };
    if (principalPool.length > 1) candidates = principalPool;
  }

  return {
    status: "ambiguous",
    candidates,
    reason: `O rótulo casa com ${candidates.length} títulos. Escolha o vencimento exato (${candidates
      .map((row) => isoToBrDate(row.maturity))
      .join(", ")}).`,
  };
}

// ---------------------------------------------------------------------------
// Marcação a mercado
// ---------------------------------------------------------------------------

/** Dias corridos entre duas datas ISO (b − a). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export type MarkInput = {
  quantity: number;
  /** Preço unitário que está no banco hoje (o que o cliente vê). */
  unitPrice: number;
  /** Custo de aquisição total em R$ (quando existir). */
  costBasis?: number | null;
  bond: TesouroRow;
  /** Data de referência para medir a idade do preço (padrão: hoje). */
  today?: string;
};

export type MarkResult = {
  symbol: string;
  /** PU de venda: é o que o cliente receberia hoje. */
  marketPrice: number;
  marketValue: number;
  bookValue: number;
  /** Variação em R$ e % contra o preço que está no banco. */
  deltaBrl: number;
  deltaPct: number;
  /** Diferença compra−venda em R$, que é o custo de ida e volta. */
  spreadBrl: number;
  spreadBps: number;
  asOf: string;
  /** Idade do preço em dias corridos na data de referência. */
  ageDays: number;
  stale: boolean;
};

/** Acima disso o preço é "velho" — o mesmo limite do score de qualidade (wave 4). */
export const STALE_DAYS = 5;

export function markBondToMarket(input: MarkInput): MarkResult {
  const { quantity, unitPrice, bond } = input;
  const marketPrice = bond.puSell;
  const marketValue = marketPrice * quantity;
  const bookValue = unitPrice * quantity;
  const deltaBrl = marketValue - bookValue;
  const deltaPct = bookValue !== 0 ? (deltaBrl / Math.abs(bookValue)) * 100 : 0;
  const spreadBrl = (bond.puBuy - bond.puSell) * quantity;
  const spreadBps = bond.puSell > 0 ? ((bond.puBuy - bond.puSell) / bond.puSell) * 10_000 : 0;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const ageDays = Math.max(0, daysBetween(bond.asOf, today));

  return {
    symbol: bondSymbol(bond.code, bond.maturity),
    marketPrice,
    marketValue,
    bookValue,
    deltaBrl,
    deltaPct,
    spreadBrl,
    spreadBps,
    asOf: bond.asOf,
    ageDays,
    stale: ageDays > STALE_DAYS,
  };
}

export type MarkedPosition = {
  positionId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  assetClass: string;
  resolution:
    | { status: "resolved"; mark: MarkResult; bond: TesouroRow }
    | { status: "ambiguous"; candidates: TesouroRow[]; reason: string }
    | { status: "none"; reason: string };
};

export type MarkPlan = {
  updates: {
    positionId: string;
    name: string;
    fromPrice: number;
    toPrice: number;
    deltaBrl: number;
    asOf: string;
    source: string;
  }[];
  unchanged: number;
  ambiguous: number;
  unresolved: number;
  /** Total marcado a mercado (só posições resolvidas e com preço diferente). */
  totalDeltaBrl: number;
  staleCount: number;
};

export type PositionLike = {
  id: string;
  name: string;
  symbol?: string | null;
  quantity: number;
  unit_price: number;
  asset_class: string;
  as_of?: string | null;
};

/**
 * Plano de marcação — função pura, mesmo desenho de `planQuoteUpdates`.
 *
 * Não escreve nada: devolve exatamente o que mudaria, quanto e por quê. É o que
 * permite testar sem banco e mostrar ao operador o impacto **antes** de aplicar.
 */
export function planTesouroMarks(
  positions: PositionLike[],
  curve: TesouroRow[],
  today?: string,
): MarkPlan {
  const plan: MarkPlan = {
    updates: [],
    unchanged: 0,
    ambiguous: 0,
    unresolved: 0,
    totalDeltaBrl: 0,
    staleCount: 0,
  };

  for (const position of positions) {
    // O rótulo do operador pode estar no nome ou no símbolo ("TESOURO-IPCA-2035").
    const label = `${position.name ?? ""} ${position.symbol ?? ""}`.trim();
    const resolution = resolveBondLabel(label, curve);

    if (resolution.status === "none") {
      plan.unresolved += 1;
      continue;
    }
    if (resolution.status === "ambiguous") {
      plan.ambiguous += 1;
      continue;
    }

    const mark = markBondToMarket({
      quantity: Number(position.quantity ?? 0),
      unitPrice: Number(position.unit_price ?? 0),
      bond: resolution.bond,
      today,
    });

    if (mark.stale) plan.staleCount += 1;

    // A tolerância evita gravar diferença de centavo que só suja o histórico.
    if (Math.abs(mark.marketPrice - Number(position.unit_price ?? 0)) < 0.01) {
      plan.unchanged += 1;
      continue;
    }

    plan.updates.push({
      positionId: position.id,
      name: position.name,
      fromPrice: Number(position.unit_price ?? 0),
      toPrice: mark.marketPrice,
      deltaBrl: mark.deltaBrl,
      asOf: resolution.bond.asOf,
      source: "tesouro",
    });
    plan.totalDeltaBrl += mark.deltaBrl;
  }

  return plan;
}

export function markPositions(
  positions: PositionLike[],
  curve: TesouroRow[],
  today?: string,
): MarkedPosition[] {
  return positions.map((position) => {
    const label = `${position.name ?? ""} ${position.symbol ?? ""}`.trim();
    const resolution = resolveBondLabel(label, curve);
    if (resolution.status !== "resolved") {
      return {
        positionId: position.id,
        name: position.name,
        quantity: Number(position.quantity ?? 0),
        unitPrice: Number(position.unit_price ?? 0),
        assetClass: position.asset_class,
        resolution,
      };
    }
    return {
      positionId: position.id,
      name: position.name,
      quantity: Number(position.quantity ?? 0),
      unitPrice: Number(position.unit_price ?? 0),
      assetClass: position.asset_class,
      resolution: {
        status: "resolved",
        bond: resolution.bond,
        mark: markBondToMarket({
          quantity: Number(position.quantity ?? 0),
          unitPrice: Number(position.unit_price ?? 0),
          bond: resolution.bond,
          today,
        }),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Sanidade da curva e resumo
// ---------------------------------------------------------------------------

/** Taxa anual efetiva implícita no PU de um prefixado: (VF / PU)^(252/du) − 1. */
export function impliedRate(input: {
  pu: number;
  faceValue: number;
  asOf: string;
  maturity: string;
}): number | null {
  const { pu, faceValue, asOf, maturity } = input;
  if (!(pu > 0) || !(faceValue > 0)) return null;
  const businessDays = countBusinessDays(asOf, maturity);
  if (businessDays <= 0) return null;
  const rate = Math.pow(faceValue / pu, 252 / businessDays) - 1;
  return Number.isFinite(rate) ? rate * 100 : null;
}

/**
 * Dias úteis entre duas datas, contando só segunda a sexta.
 *
 * Premissa declarada: **feriado não é considerado**. Serve para sanidade da curva
 * (a taxa implícita tem que ficar a poucos pontos-base da publicada), não para
 * liquidar nada — para isso existe o PU oficial.
 */
export function countBusinessDays(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  let days = 0;
  for (let cursor = from + 86_400_000; cursor <= to; cursor += 86_400_000) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

export type CurveFindingKind = "spread" | "rate-order" | "rate-vs-pu" | "direction";

export type CurveFinding = {
  kind: CurveFindingKind;
  code: BondCode;
  maturity: string;
  ok: boolean;
  detail: string;
  /** Números que sustentam o achado (para a tela não precisar recalcular). */
  values: Record<string, number | null>;
};

/**
 * Confere a curva publicada com o que a matemática do papel permite afirmar.
 *
 * Quatro achados, em ordem de força da evidência:
 *
 *  1. **spread** (exato): o PU de compra tem que ser maior que o de venda e a
 *     taxa de compra menor que a de venda. Inversão aqui é arquivo trocado ou
 *     coluna deslocada — o erro que marcaria a carteira inteira errada.
 *  2. **rate-order** (exato): compra < venda em taxa, sempre.
 *  3. **direction** (exato, só LTN): quando a taxa publicada sobe entre duas
 *     datas-base, o PU **tem** que cair — e vice-versa. É a lei do papel
 *     prefixado. Não vale para indexado a índice (o VNA move o PU junto) nem
 *     para papel com cupom.
 *
 *     Atenção: PU caindo entre dois dias **não** é erro. Numa NTN-B, taxa de
 *     7,90% a 8,00% derruba o PU — foi exatamente o que apareceu na amostra real
 *     de 29/10 para 30/10/2026. Um teste de monotonicidade do PU seria um alarme
 *     falso, e alarme falso ensina o operador a ignorar alarme.
 *  4. **rate-vs-pu** (aproximado, só LTN): reconstrói a taxa a partir do PU e
 *     compara com a publicada. **A conta não é exata de propósito**: os dias
 *     úteis aqui ignoram feriado nacional, e cada feriado no caminho empurra a
 *     taxa implícita para cima em ~25–50 bp. Por isso a tolerância é de 200 bp e
 *     o achado se chama "sanidade", não "conferência". Papel com cupom, indexado
 *     a índice de preço (VNA) ou pós-fixado não entra: ali a conta não fecha por
 *     construção, e alarme falso ensina o operador a ignorar alarme.
 */
export function checkCurve(rows: TesouroRow[]): CurveFinding[] {
  const findings: CurveFinding[] = [];
  const latest = latestCurve(rows);

  for (const row of latest) {
    const spec = specForCode(row.code);
    const spreadOk = row.puBuy >= row.puSell;
    findings.push({
      kind: "spread",
      code: row.code,
      maturity: row.maturity,
      ok: spreadOk,
      detail: spreadOk
        ? `Compra ${row.puBuy.toFixed(2)} acima da venda ${row.puSell.toFixed(2)}.`
        : `PU de compra (${row.puBuy.toFixed(2)}) abaixo do de venda (${row.puSell.toFixed(2)}): colunas trocadas?`,
      values: { puBuy: row.puBuy, puSell: row.puSell },
    });

    const rateOk = row.rateBuy <= row.rateSell + 0.001;
    findings.push({
      kind: "rate-order",
      code: row.code,
      maturity: row.maturity,
      ok: rateOk,
      detail: rateOk
        ? `Taxa de compra ${row.rateBuy.toFixed(2)}% ≤ venda ${row.rateSell.toFixed(2)}%.`
        : `Taxa de compra ${row.rateBuy.toFixed(2)}% acima da venda ${row.rateSell.toFixed(2)}%.`,
      values: { rateBuy: row.rateBuy, rateSell: row.rateSell },
    });

    if (row.code === "LTN") {
      const implied = impliedRate({
        pu: row.puSell,
        faceValue: 1000,
        asOf: row.asOf,
        maturity: row.maturity,
      });
      const diffBps = implied === null ? null : (implied - row.rateSell) * 100;
      findings.push({
        kind: "rate-vs-pu",
        code: row.code,
        maturity: row.maturity,
        ok: diffBps === null ? true : Math.abs(diffBps) <= 200,
        detail:
          diffBps === null
            ? "Sem dias úteis até o vencimento."
            : `Taxa implícita no PU ${(implied as number).toFixed(2)}% vs publicada ${row.rateSell.toFixed(2)}% (${Math.round(diffBps)} bp; feriados não contados).`,
        values: { publishedRate: row.rateSell, impliedRate: implied, diffBps },
      });
    } else if (spec?.inflationLinked || spec?.semiannualCoupon || spec?.family === "selic") {
      findings.push({
        kind: "rate-vs-pu",
        code: row.code,
        maturity: row.maturity,
        ok: true,
        detail: "Sem conferência de taxa: papel com cupom, indexado a índice ou pós-fixado.",
        values: { publishedRate: row.rateSell, impliedRate: null, diffBps: null },
      });
    }
  }

  // Direção taxa × PU: só para LTN (ver comentário acima).
  const byKey = new Map<string, TesouroRow[]>();
  for (const row of rows) {
    if (row.code !== "LTN") continue;
    const key = `${row.code}|${row.maturity}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  for (const list of byKey.values()) {
    const ordered = [...list].sort((a, b) => (a.asOf < b.asOf ? -1 : 1));
    if (ordered.length < 2) continue;
    const first = ordered[0] as TesouroRow;
    const last = ordered[ordered.length - 1] as TesouroRow;
    const rateDelta = last.rateSell - first.rateSell;
    const puDelta = last.puSell - first.puSell;
    // Taxa parada: PU pode variar só por arredondamento do publicador.
    const ok = Math.abs(rateDelta) < 0.0001 || Math.sign(rateDelta) !== Math.sign(puDelta) || Math.abs(puDelta) < 0.01;
    findings.push({
      kind: "direction",
      code: first.code,
      maturity: first.maturity,
      ok,
      detail: ok
        ? `Taxa ${rateDelta >= 0 ? "subiu" : "caiu"} ${Math.abs(rateDelta).toFixed(2)} pp e o PU ${puDelta >= 0 ? "subiu" : "caiu"} ${Math.abs(puDelta).toFixed(2)} — coerente.`
        : `Taxa e PU andaram no mesmo sentido (${rateDelta.toFixed(2)} pp / ${puDelta.toFixed(2)}): matematicamente impossível num prefixado.`,
      values: { rateDelta, puDelta },
    });
  }

  return findings;
}

export type CurveHealth = {
  /** `true` quando nenhum achado é uma falha. */
  ok: boolean;
  total: number;
  failed: CurveFinding[];
  /** Só os achados de taxa reconstruída, para a tela detalhar. */
  rateCheck: CurveFinding[];
};

export function curveHealth(findings: CurveFinding[]): CurveHealth {
  const failed = findings.filter((finding) => !finding.ok);
  return {
    ok: failed.length === 0,
    total: findings.length,
    failed,
    rateCheck: findings.filter((finding) => finding.kind === "rate-vs-pu"),
  };
}

export type CurveSummary = {
  bonds: number;
  families: {
    family: BondFamily;
    label: string;
    bonds: number;
    minRate: number;
    maxRate: number;
    avgRate: number;
  }[];
  /** Data-base da curva (a mais recente encontrada). */
  asOf: string | null;
  oldestAsOf: string | null;
  /** Curva invertida: o papel mais curto paga mais que o mais longo (sinal de estresse). */
  inverted: boolean;
  note: string;
};

const FAMILY_LABEL: Record<BondFamily, string> = {
  selic: "Selic (pós-fixado)",
  prefixado: "Prefixado",
  ipca: "IPCA+",
  igpm: "IGP-M+",
};

export function summarizeCurve(curve: TesouroRow[]): CurveSummary {
  if (curve.length === 0) {
    return {
      bonds: 0,
      families: [],
      asOf: null,
      oldestAsOf: null,
      inverted: false,
      note: "Nenhuma curva sincronizada: rode a sincronização do Tesouro.",
    };
  }

  const byFamily = new Map<BondFamily, number[]>();
  for (const row of curve) {
    const list = byFamily.get(specForCode(row.code)?.family ?? "prefixado") ?? [];
    list.push(row.rateSell);
    byFamily.set(specForCode(row.code)?.family ?? "prefixado", list);
  }

  const families = [...byFamily.entries()]
    .map(([family, rates]) => ({
      family,
      label: FAMILY_LABEL[family],
      bonds: rates.length,
      minRate: Math.min(...rates),
      maxRate: Math.max(...rates),
      avgRate: rates.reduce((sum, rate) => sum + rate, 0) / rates.length,
    }))
    .sort((a, b) => a.family.localeCompare(b.family));

  const asOf = curve.reduce((max, row) => (row.asOf > max ? row.asOf : max), curve[0]?.asOf ?? "");
  const oldestAsOf = curve.reduce((min, row) => (row.asOf < min ? row.asOf : min), curve[0]?.asOf ?? "");

  // Inversão só é comparável dentro da mesma família prefixada (mesmo indexador).
  const prefixados = curve
    .filter((row) => row.code === "LTN" || row.code === "NTN-F")
    .sort((a, b) => (a.maturity < b.maturity ? -1 : 1));
  const inverted =
    prefixados.length >= 2 &&
    (prefixados[0] as TesouroRow).rateSell > (prefixados[prefixados.length - 1] as TesouroRow).rateSell + 0.25;

  return {
    bonds: new Set(curve.map((row) => bondSymbol(row.code, row.maturity))).size,
    families,
    asOf: asOf || null,
    oldestAsOf: oldestAsOf || null,
    inverted,
    note: inverted
      ? "Curva prefixada invertida: o vencimento curto paga mais que o longo — mercado precificando aperto."
      : "Curva prefixada no formato normal.",
  };
}
