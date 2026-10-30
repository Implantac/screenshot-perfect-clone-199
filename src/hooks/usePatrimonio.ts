import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Erro de tabela ausente (migration não aplicada). Diferente de "tenant vazio":
 * a tela precisa dizer ao operador que falta rodar SQL, não que não há dados.
 */
export class MissingTableError extends Error {
  readonly table: string;
  constructor(table: string, migration?: string) {
    super(
      `A tabela "${table}" ainda não existe neste projeto Supabase.${
        migration ? ` Aplique a migration ${migration}.` : ""
      }`,
    );
    this.name = "MissingTableError";
    this.table = table;
  }
}

export function isMissingTableError(error: unknown): error is MissingTableError {
  return error instanceof MissingTableError;
}

/** Converte PGRST205/42P01 em MissingTableError; repassa qualquer outro erro. */
function ensureTable(error: unknown, table: string, migration?: string): void {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  if (code === "PGRST205" || code === "42P01" || /could not find the table|does not exist/i.test(message)) {
    throw new MissingTableError(table, migration);
  }
  throw error;
}

export function useEntities() {
  return useQuery({
    queryKey: ["entities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entities")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*, entities(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRisks() {
  return useQuery({
    queryKey: ["risks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risks")
        .select("*, entities(name), assets(name)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*, entities(name), assets(name)")
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useShares() {
  return useQuery({
    queryKey: ["entity_shares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_shares")
        .select("*, entities(name), members(full_name, role)")
        .order("share_percentage", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    // Não insistir quando a tabela nem existe: o retry só atrasaria o aviso na tela.
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*, entities(name)")
        .order("name");
      if (error) ensureTable(error, "suppliers", "20261030140000_operations_tables.sql");
      return data;
    },
  });
}

export function useLegalCases() {
  return useQuery({
    queryKey: ["legal_cases"],
    // Não insistir quando a tabela nem existe: o retry só atrasaria o aviso na tela.
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_cases")
        .select("*, entities(name), assets(name), members(full_name)")
        .order("next_hearing", { ascending: true, nullsFirst: false });
      if (error) ensureTable(error, "legal_cases", "20261030140000_operations_tables.sql");
      return data;
    },
  });
}

/** Trilha de auditoria do tenant (RLS: dono do dado ou admin). */
export function useAuditLogs(limit = 60) {
  return useQuery({
    queryKey: ["audit_logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, table_name, record_id, old_data, new_data, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

/** Documentos com vencimento, para o fluxo de regularização. */
export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, assets(name), entities(name)")
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });
}

// ------------------------------------------------------------ custódia (wave 4)

/** Contas de custódia com o nome da instituição resolvido. */
export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*, custodians(name, code), entities(name)")
        .order("name");
      if (error) ensureTable(error, "accounts", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}

/** Posições financeiras — a base de alocação e performance. */
export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("*, accounts(name, custodians(name)), entities(name)")
        .order("as_of", { ascending: false });
      if (error) ensureTable(error, "positions", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}

export function useCashFlows() {
  return useQuery({
    queryKey: ["cash_flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_flows")
        .select("*")
        .order("flow_date", { ascending: true });
      if (error) ensureTable(error, "cash_flows", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}

export function usePortfolioSnapshots() {
  return useQuery({
    queryKey: ["portfolio_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_snapshots")
        .select("*")
        .order("as_of", { ascending: true });
      if (error) ensureTable(error, "portfolio_snapshots", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}

export function useTaxScenarios() {
  return useQuery({
    queryKey: ["tax_scenarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_scenarios")
        .select("*, entities(name)")
        .order("created_at", { ascending: false });
      if (error) ensureTable(error, "tax_scenarios", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}

export function useCustodians() {
  return useQuery({
    queryKey: ["custodians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("custodians").select("*").order("name");
      if (error) ensureTable(error, "custodians", "20261030150000_wealth_core.sql");
      return data;
    },
    retry: (failureCount, error) => !isMissingTableError(error) && failureCount < 2,
  });
}
