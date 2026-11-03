/**
 * Formatação pt-BR do relatório — uma única fonte para tela e PDF.
 * O PDF usa Helvetica (sem fonte embutida) e por isso não aceita símbolos
 * exóticos; tudo aqui passa por `replace` de espaço não separável.
 */

const clean = (text: string) => text.replace(/\u00a0/g, " ").replace(/\u202f/g, " ");

export function brl(value: number, digits = 0): string {
  return clean(
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
  );
}

/** Milhões abreviados para caber em tabela: R$ 57,5 mi. */
export function brlCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(0).replace(".", ",")} mil`;
  return brl(value);
}

export function pct(value: number, digits = 2): string {
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

export function signedPct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${pct(value, digits)}`;
}

/** Pontos percentuais: "+1,42 p.p." — nunca "+1,42% p.p.". */
export function signedPoints(value: number, digits = 2): string {
  // `toFixed` já carrega o sinal do negativo — prefixar de novo geraria "--1,2".
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits).replace(".", ",")} p.p.`;
}

export function signedBrl(value: number, digits = 0): string {
  return `${value >= 0 ? "+" : "-"}${brl(Math.abs(value), digits)}`;
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-10" → "Outubro de 2026". */
export function competenciaLabel(competencia: string): string {
  const [year, month] = competencia.split("-").map(Number);
  const name = MONTHS[(month || 1) - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
}

export function competenciaBounds(competencia: string): { from: string; to: string } {
  const [year, month] = competencia.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** ISO → dd/mm/aaaa (ou aaaa-mm-dd se for só mês). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length < 3) return String(iso);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function competenciaOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}
