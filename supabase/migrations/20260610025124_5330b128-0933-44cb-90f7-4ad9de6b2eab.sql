CREATE TABLE public.jarvis_insights (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL, -- 'documental', 'compliance', 'patrimonial', 'agro', 'risco'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    asset_id UUID REFERENCES public.assets(id),
    entity_id UUID REFERENCES public.entities(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.jarvis_action_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    insight_id UUID REFERENCES public.jarvis_insights(id),
    title TEXT NOT NULL,
    responsible_id UUID REFERENCES public.members(id),
    due_date TIMESTAMP WITH TIME ZONE,
    priority TEXT NOT NULL, -- 'P1', 'P2', 'P3'
    status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
    impact_analysis TEXT,
    suggested_resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.jarvis_health_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id UUID REFERENCES public.entities(id),
    patrimonial_score NUMERIC DEFAULT 100,
    documental_score NUMERIC DEFAULT 100,
    compliance_score NUMERIC DEFAULT 100,
    risk_score NUMERIC DEFAULT 100,
    global_score NUMERIC DEFAULT 100,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_insights TO authenticated;
GRANT ALL ON public.jarvis_insights TO service_role;
ALTER TABLE public.jarvis_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view insights related to their entities" ON public.jarvis_insights FOR SELECT USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_action_plans TO authenticated;
GRANT ALL ON public.jarvis_action_plans TO service_role;
ALTER TABLE public.jarvis_action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their action plans" ON public.jarvis_action_plans FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jarvis_health_scores TO authenticated;
GRANT ALL ON public.jarvis_health_scores TO service_role;
ALTER TABLE public.jarvis_health_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view health scores" ON public.jarvis_health_scores FOR SELECT USING (true);
