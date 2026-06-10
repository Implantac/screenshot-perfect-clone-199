
-- 1. Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 2. Ownership columns
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.members  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_entities_owner ON public.entities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_members_owner  ON public.members(owner_user_id);

-- 3. Helper: is the caller the owner of an entity (or an admin)?
CREATE OR REPLACE FUNCTION public.owns_entity(_entity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _entity_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.entities e
    WHERE e.id = _entity_id
      AND (e.owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
$$;

-- 4. Drop old permissive policies
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entities;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entity_shares;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.members;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.audit_logs;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.risks;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.assets;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.documents;

-- 5. Entities: owner or admin
CREATE POLICY "Owners manage entities" ON public.entities
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6. Members: owner or admin
CREATE POLICY "Owners manage members" ON public.members
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. Entity-scoped tables
CREATE POLICY "Owners manage assets" ON public.assets
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners manage risks" ON public.risks
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners manage transactions" ON public.transactions
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE POLICY "Owners manage entity_shares" ON public.entity_shares
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

-- 8. Audit logs: read-only for admins; writes only via service_role/triggers
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
