-- Dropar política permissiva anterior
DROP POLICY IF EXISTS "Users can manage their action plans" ON public.jarvis_action_plans;

-- Criar política mais restritiva (Nota: Como ainda não temos uma tabela de perfis vinculada diretamente por user_id nessas novas tabelas, 
-- usaremos uma abordagem simplificada de permitir acesso a usuários autenticados, mas no futuro isso deve ser vinculado ao owner_user_id das entidades)
CREATE POLICY "Authenticated users can manage action plans" ON public.jarvis_action_plans 
FOR ALL USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');
