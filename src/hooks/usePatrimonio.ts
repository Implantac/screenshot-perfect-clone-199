import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*, entities(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useLegalCases() {
  return useQuery({
    queryKey: ["legal_cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_cases")
        .select("*, entities(name), assets(name), members(full_name)")
        .order("next_hearing", { ascending: true, nullsFirst: false });
      if (error) throw error;
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
