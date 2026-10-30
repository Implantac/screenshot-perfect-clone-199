/**
 * Alocação, concentração e aderência à política de investimento.
 *
 * O que este módulo entrega e que um gráfico de pizza não entrega:
 *  - **HHI** (índice Herfindahl-Hirschman) para medir concentração de verdade;
 *  - **drift** contra a política-alvo por classe, com tolerância e semáforo;
 *  - **liquidez em faixas** (D0/D1/D30/longo/ilíquido) — pergunta que todo
 *    family office faz em crise e que consolidadores costumam esconder;
 *  - **exposição cambial** e offshore.
 */

export type PositionLike = {
  asset_class: string;
  liquidity?: string | null;
  name: string;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  currency?: string | null;
  is_offshore?: boolean | null;
};

export type AllocationBucket = {
  key: string;
  label: string;
  value: number;
  percentage: number;
  count: number;
};

export const ASSET_CLASS_LABELS: Record<string, string> = {
  caixa: "Caixa",
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  fundos: "Fundos",
  imoveis: "Imóveis",
  internacional: "Internacional",
  alternativos: "Alternativos",
  cripto: "Cripto",
};

export const LIQUIDITY_LABELS: Record<string, string> = {
  d0: "D+0",
  d1: "D+1",
  d30: "D+30",
  longo_prazo: "Longo prazo",
  iliquido: "Ilíquido",
};

/** Valor de mercado de uma posição; tolera numeric vindo do PostgREST como string. */
export function positionValue(position: PositionLike): number {
  const quantity = Number(position.quantity ?? 0);
  const price = Number(position.unit_price ?? 0);
  const value = quantity * price;
  return Number.isFinite(value) ? value : 0;
}

export function totalValue(positions: PositionLike[]): number {
  return positions.reduce((sum, p) => sum + positionValue(p), 0);
}

function bucketize(
  positions: PositionLike[],
  keyOf: (p: PositionLike) => string,
  labels: Record<string, string>,
  total: number,
): AllocationBucket[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const position of positions) {
    const key = keyOf(position);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += positionValue(position);
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, entry]) => ({
      key,
      label: labels[key] ?? key,
      value: round(entry.value, 2),
      percentage: total > 0 ? round((entry.value / total) * 100, 2) : 0,
      count: entry.count,
    }))
    .sort((a, b) => b.value - a.value);
}

export function allocationByClass(positions: PositionLike[]): AllocationBucket[] {
  return bucketize(positions, (p) => p.asset_class, ASSET_CLASS_LABELS, totalValue(positions));
}

export function allocationByLiquidity(positions: PositionLike[]): AllocationBucket[] {
  return bucketize(
    positions,
    (p) => p.liquidity ?? "longo_prazo",
    LIQUIDITY_LABELS,
    totalValue(positions),
  );
}

export function allocationByCurrency(positions: PositionLike[]): AllocationBucket[] {
  const total = totalValue(positions);
  return bucketize(positions, (p) => p.currency ?? "BRL", {}, total);
}

/**
 * Índice Herfindahl-Hirschman normalizado (0 = pulverizado, 1 = tudo em um item).
 * Serve como termômetro de concentração por posição individual.
 */
export function concentrationIndex(positions: PositionLike[]): number {
  const total = totalValue(positions);
  if (total <= 0 || positions.length === 0) return 0;
  const sumSquares = positions.reduce((sum, p) => {
    const share = positionValue(p) / total;
    return sum + share * share;
  }, 0);
  const n = positions.length;
  if (n === 1) return 1;
  // Normaliza para comparar carteiras de tamanhos diferentes.
  return round((sumSquares - 1 / n) / (1 - 1 / n), 4);
}

export function topPositions(positions: PositionLike[], limit = 5): { name: string; value: number; percentage: number }[] {
  const total = totalValue(positions);
  return [...positions]
    .map((p) => ({ name: p.name, value: round(positionValue(p), 2) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((p) => ({ ...p, percentage: total > 0 ? round((p.value / total) * 100, 2) : 0 }));
}

export type PolicyTarget = { asset_class: string; target: number };

export type DriftRow = {
  key: string;
  label: string;
  actual: number;
  target: number;
  drift: number;
  /** |drift| acima da tolerância. */
  breach: boolean;
  action: "aumentar" | "reduzir" | "manter";
};

/**
 * Drift vs política-alvo (bandas de tolerância).
 * A soma dos alvos pode ser < 100 quando existe caixa tático não alocado — o
 * resíduo é tratado como "Caixa".
 */
export function computeDrift(
  positions: PositionLike[],
  targets: PolicyTarget[],
  tolerance = 5,
): DriftRow[] {
  const actual = new Map(allocationByClass(positions).map((b) => [b.key, b.percentage]));
  const targetMap = new Map(targets.map((t) => [t.asset_class, Number(t.target)]));

  return [...new Set([...actual.keys(), ...targetMap.keys()])]
    .map((key) => {
      const current = actual.get(key) ?? 0;
      const target = targetMap.get(key) ?? 0;
      const drift = round(current - target, 2);
      return {
        key,
        label: ASSET_CLASS_LABELS[key] ?? key,
        actual: current,
        target,
        drift,
        breach: Math.abs(drift) > tolerance,
        action: (drift > tolerance ? "reduzir" : drift < -tolerance ? "aumentar" : "manter") as
          | "aumentar"
          | "reduzir"
          | "manter",
      };
    })
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
}

export type AllocationSummary = {
  total: number;
  byClass: AllocationBucket[];
  byLiquidity: AllocationBucket[];
  byCurrency: AllocationBucket[];
  concentration: number;
  offshorePercentage: number;
  /** % disponível em até D+1 — o "quanto eu tenho se precisar amanhã". */
  liquidPercentage: number;
  top: { name: string; value: number; percentage: number }[];
  positionsCount: number;
};

export function summarizeAllocation(positions: PositionLike[]): AllocationSummary {
  const total = totalValue(positions);
  const offshore = positions
    .filter((p) => p.is_offshore)
    .reduce((sum, p) => sum + positionValue(p), 0);
  const liquid = positions
    .filter((p) => p.liquidity === "d0" || p.liquidity === "d1")
    .reduce((sum, p) => sum + positionValue(p), 0);

  return {
    total: round(total, 2),
    byClass: allocationByClass(positions),
    byLiquidity: allocationByLiquidity(positions),
    byCurrency: allocationByCurrency(positions),
    concentration: concentrationIndex(positions),
    offshorePercentage: total > 0 ? round((offshore / total) * 100, 2) : 0,
    liquidPercentage: total > 0 ? round((liquid / total) * 100, 2) : 0,
    top: topPositions(positions),
    positionsCount: positions.length,
  };
}

function round(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}
