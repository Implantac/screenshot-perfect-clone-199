/**
 * Normalização e deduplicação dos lançamentos importados.
 *
 * Regra central: **o mesmo dinheiro nunca entra duas vezes**. Duas camadas:
 *  1. `external_id` — FITID do banco quando existe; senão hash determinístico
 *     de (data + valor + descrição normalizada), que é estável entre reenvios.
 *  2. verificação contra o que já está no banco, feita pela server function
 *     (índice único parcial em `(entity_id, external_id)`).
 */
import type { CsvTransaction } from "./csv";
import type { OfxTransaction } from "./ofx";

export type NormalizedRow = {
  /** Chave de deduplicação: FITID ou hash. */
  external_id: string;
  date: string;
  /** Valor assinado (negativo = saída). */
  amount: number;
  description: string;
  /** `income` | `expense` — mesma nomenclatura da tabela `transactions`. */
  type: "income" | "expense";
  /** Categoria inferida a partir da descrição (editável na tela). */
  category: string;
  /** Já existe no banco (preenchido pela server function no preview). */
  duplicate?: boolean;
};

/** Hash determinístico simples (FNV-1a 32 bits em hex) — estável entre execuções. */
export function fingerprint(parts: (string | number)[]): string {
  const input = parts.join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Achata a descrição para comparar (sem acento, sem espaços duplicados). */
export function normalizeDescription(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Categorização por palavra-chave, na ordem de especificidade.
 * Não pretende ser contabilidade — serve para o extrato já entrar organizado.
 */
const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: "Tributos", pattern: /(darf|das |simples nacional|irpf|imposto|tribut|itcmd|iss |icms)/ },
  { category: "Encargos financeiros", pattern: /(tarifa|iof|juros|multa|anuidade|taxa banc)/ },
  { category: "Folha de pagamento", pattern: /(salario|folha|pro labore|prolabore|inss|fgts|13o|ferias)/ },
  { category: "Proventos e rendimentos", pattern: /(rendimento|dividendo|jcp|juros sobre capital|cupom|amortizacao)/ },
  { category: "Investimentos", pattern: /(aplicacao|resgate|cdb|tesouro|fundo|compra de acao|corretora|bolsa)/ },
  { category: "Receita operacional", pattern: /(recebimento|venda|fatura|nf |nota fiscal|arrendamento|aluguel recebido|contrato)/ },
  { category: "Arrendamento e locação", pattern: /(aluguel|locacao|arrendamento)/ },
  { category: "Insumos e fornecedores", pattern: /(fornecedor|insumo|combustivel|diesel|semente|fertilizante|manutencao|pecas)/ },
  { category: "Transferências", pattern: /(pix|ted|doc|transferencia|transf )/ },
];

export function guessCategory(description: string, type: "income" | "expense"): string {
  const text = normalizeDescription(description);
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return type === "income" ? "Outras receitas" : "Outras despesas";
}

export function normalizeOfx(transactions: OfxTransaction[]): NormalizedRow[] {
  return transactions.map((transaction) => {
    const type: "income" | "expense" = transaction.amount >= 0 ? "income" : "expense";
    const externalId =
      transaction.fitid && transaction.fitid.trim().length > 0
        ? `ofx:${transaction.fitid.trim()}`
        : `hash:${fingerprint([transaction.date, transaction.amount.toFixed(2), normalizeDescription(transaction.description)])}`;

    return {
      external_id: externalId,
      date: transaction.date,
      amount: Math.abs(transaction.amount),
      description: transaction.description,
      type,
      category: guessCategory(transaction.description, type),
    };
  });
}

export function normalizeCsv(transactions: CsvTransaction[]): NormalizedRow[] {
  return transactions.map((transaction) => {
    const type: "income" | "expense" = transaction.amount >= 0 ? "income" : "expense";
    return {
      external_id: `hash:${fingerprint([transaction.date, transaction.amount.toFixed(2), normalizeDescription(transaction.description)])}`,
      date: transaction.date,
      amount: Math.abs(transaction.amount),
      description: transaction.description,
      type,
      category: guessCategory(transaction.description, type),
    };
  });
}

/** Remove duplicatas dentro do próprio arquivo (mesmo FITID repetido). */
export function dedupeWithinFile(rows: NormalizedRow[]): { rows: NormalizedRow[]; removed: number } {
  const seen = new Set<string>();
  const out: NormalizedRow[] = [];
  for (const row of rows) {
    if (seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push(row);
  }
  return { rows: out, removed: rows.length - out.length };
}

/** Retorno da server function de importação. */
export type ImportResult = {
  batchId: string;
  imported: number;
  duplicated: number;
  failed: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export type ImportSummary = {
  rowsTotal: number;
  rowsImported: number;
  rowsDuplicated: number;
  rowsFailed: number;
  periodStart: string | null;
  periodEnd: string | null;
};

export function summarizeRows(rows: NormalizedRow[], existing: Set<string>): ImportSummary {
  const imported = rows.filter((row) => !existing.has(row.external_id));
  const dates = imported.map((row) => row.date).sort();
  return {
    rowsTotal: rows.length,
    rowsImported: imported.length,
    rowsDuplicated: rows.length - imported.length,
    rowsFailed: 0,
    periodStart: dates[0] ?? null,
    periodEnd: dates[dates.length - 1] ?? null,
  };
}
