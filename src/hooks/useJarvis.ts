import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JarvisInsight = {
  id: string;
  type: 'documental' | 'compliance' | 'patrimonial' | 'agro' | 'risco';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  is_resolved: boolean;
  created_at: string;
  metadata: any;
};

export type ActionPlan = {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'P1' | 'P2' | 'P3';
  due_date: string;
  suggested_resolution: string;
};

export const useJarvisInsights = () => {
  return useQuery({
    queryKey: ['jarvis-insights'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_insights')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as JarvisInsight[];
    },
  });
};

/**
 * Histórico de health scores (mais antigo → mais recente) para o gráfico do
 * dashboard. Antes retornava 1 linha fixa com números inventados (94.2% etc.);
 * agora devolve a série real do tenant e uma lista vazia quando não há histórico.
 */
export const useJarvisHealth = () => {
  return useQuery({
    queryKey: ['jarvis-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_health_scores')
        .select('*')
        .order('recorded_at', { ascending: true })
        .limit(24);

      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useJarvisActionPlans = () => {
  return useQuery({
    queryKey: ['jarvis-action-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_action_plans')
        .select('*')
        .order('priority', { ascending: true });
      
      if (error) throw error;
      return data as ActionPlan[];
    },
  });
};
