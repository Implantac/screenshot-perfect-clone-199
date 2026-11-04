DO $$ BEGIN
  CREATE TYPE public.mfa_scope AS ENUM ('admin', 'portal', 'todos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.security_policies (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  mfa_required_admin BOOLEAN NOT NULL DEFAULT true,
  mfa_required_portal BOOLEAN NOT NULL DEFAULT true,
  mfa_grace_days INTEGER NOT NULL DEFAULT 7 CHECK (mfa_grace_days >= 0 AND mfa_grace_days <= 90),
  min_password_length INTEGER NOT NULL DEFAULT 12 CHECK (min_password_length >= 6 AND min_password_length <= 72),
  require_mixed_case BOOLEAN NOT NULL DEFAULT true,
  require_number BOOLEAN NOT NULL DEFAULT true,
  require_symbol BOOLEAN NOT NULL DEFAULT true,
  block_common_passwords BOOLEAN NOT NULL DEFAULT true,
  password_history INTEGER NOT NULL DEFAULT 5 CHECK (password_history >= 0 AND password_history <= 24),
  max_failed_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_failed_attempts >= 3 AND max_failed_attempts <= 20),
  session_timeout_minutes INTEGER NOT NULL DEFAULT 480 CHECK (session_timeout_minutes >= 15 AND session_timeout_minutes <= 10080),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT security_policies_singleton CHECK (id)
);

INSERT INTO public.security_policies (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.security_policies TO authenticated;
GRANT INSERT, UPDATE ON public.security_policies TO authenticated;
GRANT ALL ON public.security_policies TO service_role;
REVOKE ALL ON public.security_policies FROM anon;

DROP POLICY IF EXISTS "Authenticated read security policy" ON public.security_policies;
CREATE POLICY "Authenticated read security policy" ON public.security_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins update security policy" ON public.security_policies;
CREATE POLICY "Admins update security policy" ON public.security_policies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.session_is_elevated()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

CREATE OR REPLACE FUNCTION public.mfa_satisfied(_scope public.mfa_scope DEFAULT 'admin')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  policy_record public.security_policies%ROWTYPE;
  required boolean;
BEGIN
  SELECT * INTO policy_record FROM public.security_policies WHERE id = true;
  IF NOT FOUND THEN
    RETURN true; -- sem política gravada, não se bloqueia ninguém
  END IF;

  required := CASE _scope
    WHEN 'admin' THEN policy_record.mfa_required_admin
    WHEN 'portal' THEN policy_record.mfa_required_portal
    ELSE policy_record.mfa_required_admin OR policy_record.mfa_required_portal
  END;

  IF NOT required THEN
    RETURN true;
  END IF;

  RETURN public.session_is_elevated();
END $$;

GRANT EXECUTE ON FUNCTION public.mfa_satisfied(public.mfa_scope) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_mfa_factors()
RETURNS TABLE (id uuid, friendly_name text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT f.id, f.friendly_name, f.status, f.created_at
    FROM auth.mfa_factors f
   WHERE f.user_id = auth.uid()
     AND f.status = 'verified'
$$;

GRANT EXECUTE ON FUNCTION public.my_mfa_factors() TO authenticated;

DROP POLICY IF EXISTS "Owners manage portal grants" ON public.portal_grants;
CREATE POLICY "Owners manage portal grants" ON public.portal_grants
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id) AND public.mfa_satisfied('admin'))
  WITH CHECK (public.owns_entity(entity_id) AND public.mfa_satisfied('admin'));

DROP POLICY IF EXISTS "Grantee reads own portal grant" ON public.portal_grants;
CREATE POLICY "Grantee reads own portal grant" ON public.portal_grants
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'ativo'
    AND public.mfa_satisfied('portal')
  );

COMMENT ON TABLE public.security_policies IS
  'Régua única de senha, MFA e sessão do tenant. Aplicada no app e no RLS.';
COMMENT ON FUNCTION public.mfa_satisfied(public.mfa_scope) IS
  'Trava de sessão: exige aal2 quando a política do escopo pede MFA.';
