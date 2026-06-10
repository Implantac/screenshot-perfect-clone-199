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

export const useJarvisHealth = () => {
  return useQuery({
    queryKey: ['jarvis-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jarvis_health_scores')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data || {
        global_score: 94.2,
        patrimonial_score: 96.5,
        documental_score: 88.0,
        compliance_score: 92.4,
        risk_score: 98.1
      };
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
