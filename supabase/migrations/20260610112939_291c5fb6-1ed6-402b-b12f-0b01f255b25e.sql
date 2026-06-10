
-- Restrict jarvis_insights to entity owners
DROP POLICY IF EXISTS "Insights are viewable by everyone" ON public.jarvis_insights;
DROP POLICY IF EXISTS "Public can view insights" ON public.jarvis_insights;
DROP POLICY IF EXISTS "Anyone can view insights" ON public.jarvis_insights;
DROP POLICY IF EXISTS "Insights public read" ON public.jarvis_insights;

CREATE POLICY "Owners can view their insights"
ON public.jarvis_insights FOR SELECT TO authenticated
USING (public.owns_entity(entity_id));

CREATE POLICY "Owners can insert their insights"
ON public.jarvis_insights FOR INSERT TO authenticated
WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners can update their insights"
ON public.jarvis_insights FOR UPDATE TO authenticated
USING (public.owns_entity(entity_id))
WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners can delete their insights"
ON public.jarvis_insights FOR DELETE TO authenticated
USING (public.owns_entity(entity_id));

REVOKE ALL ON public.jarvis_insights FROM anon;

-- Restrict jarvis_health_scores to entity owners
DROP POLICY IF EXISTS "Health scores are viewable by everyone" ON public.jarvis_health_scores;
DROP POLICY IF EXISTS "Public can view health scores" ON public.jarvis_health_scores;
DROP POLICY IF EXISTS "Anyone can view health scores" ON public.jarvis_health_scores;

CREATE POLICY "Owners can view their health scores"
ON public.jarvis_health_scores FOR SELECT TO authenticated
USING (public.owns_entity(entity_id));

CREATE POLICY "Owners can insert their health scores"
ON public.jarvis_health_scores FOR INSERT TO authenticated
WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners can update their health scores"
ON public.jarvis_health_scores FOR UPDATE TO authenticated
USING (public.owns_entity(entity_id))
WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners can delete their health scores"
ON public.jarvis_health_scores FOR DELETE TO authenticated
USING (public.owns_entity(entity_id));

REVOKE ALL ON public.jarvis_health_scores FROM anon;

-- Restrict jarvis_action_plans via parent insight ownership
DROP POLICY IF EXISTS "Authenticated can manage action plans" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Action plans are viewable by authenticated" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Authenticated users can manage action plans" ON public.jarvis_action_plans;

CREATE POLICY "Owners can view their action plans"
ON public.jarvis_action_plans FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jarvis_insights i
  WHERE i.id = jarvis_action_plans.insight_id
    AND public.owns_entity(i.entity_id)
));

CREATE POLICY "Owners can insert their action plans"
ON public.jarvis_action_plans FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.jarvis_insights i
  WHERE i.id = jarvis_action_plans.insight_id
    AND public.owns_entity(i.entity_id)
));

CREATE POLICY "Owners can update their action plans"
ON public.jarvis_action_plans FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jarvis_insights i
  WHERE i.id = jarvis_action_plans.insight_id
    AND public.owns_entity(i.entity_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.jarvis_insights i
  WHERE i.id = jarvis_action_plans.insight_id
    AND public.owns_entity(i.entity_id)
));

CREATE POLICY "Owners can delete their action plans"
ON public.jarvis_action_plans FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.jarvis_insights i
  WHERE i.id = jarvis_action_plans.insight_id
    AND public.owns_entity(i.entity_id)
));

REVOKE ALL ON public.jarvis_action_plans FROM anon;
