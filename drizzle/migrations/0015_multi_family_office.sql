CREATE TABLE IF NOT EXISTS public.offices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text,
  document    text,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offices IS
  'Escritório (multi-family office). Agrupa equipe e famílias clientes.';

CREATE UNIQUE INDEX IF NOT EXISTS offices_slug_key ON public.offices (lower(slug)) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.office_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  role        text NOT NULL DEFAULT 'analista',
  status      text NOT NULL DEFAULT 'ativo',
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_members_role_check
    CHECK (role IN ('socio', 'gestor', 'analista', 'leitor')),
  CONSTRAINT office_members_status_check
    CHECK (status IN ('ativo', 'convidado', 'suspenso')),
  CONSTRAINT office_members_identity_check
    CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS office_members_user_key
  ON public.office_members (office_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS office_members_email_key
  ON public.office_members (office_id, lower(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE public.office_members IS
  'Equipe do escritório. Convite por e-mail (user_id nulo) vira vínculo na primeira sessão da pessoa.';
COMMENT ON COLUMN public.office_members.role IS
  'socio = administra o escritório; gestor = administra famílias e equipe; analista = lê; leitor = só relatórios.';

CREATE INDEX IF NOT EXISTS office_members_user_idx ON public.office_members(user_id, status);

CREATE TABLE IF NOT EXISTS public.office_clients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id      uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,

  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          text NOT NULL,
  status         text NOT NULL DEFAULT 'ativo',
  granted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  CONSTRAINT office_clients_status_check
    CHECK (status IN ('ativo', 'pausado', 'encerrado')),
  CONSTRAINT office_clients_unique UNIQUE (office_id, owner_user_id)
);

COMMENT ON TABLE public.office_clients IS
  'Consentimento da família: liga um tenant (owner_user_id) a um escritório. Criado pela família.';

CREATE INDEX IF NOT EXISTS office_clients_owner_idx
  ON public.office_clients(owner_user_id, status);

CREATE OR REPLACE FUNCTION public.office_role_of(_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
    FROM public.office_members m
   WHERE m.user_id = _user
     AND m.status = 'ativo'
   ORDER BY CASE m.role WHEN 'socio' THEN 1 WHEN 'gestor' THEN 2 WHEN 'analista' THEN 3 ELSE 4 END
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_role_of(uuid) IS
  'Papel mais alto do usuário em um escritório ativo (null se não é de escritório nenhum).';

CREATE OR REPLACE FUNCTION public.office_can_read_tenant(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner IS NOT NULL AND (
    _owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
        FROM public.office_clients c
        JOIN public.office_members m ON m.office_id = c.office_id
       WHERE c.owner_user_id = _owner
         AND c.status = 'ativo'
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
    )
  );
$$;

COMMENT ON FUNCTION public.office_can_read_tenant(uuid) IS
  'True se o chamador é a própria família, admin, ou membro ativo de um escritório com vínculo ativo.';

REVOKE ALL ON FUNCTION public.office_role_of(uuid) FROM public;
REVOKE ALL ON FUNCTION public.office_can_read_tenant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.office_role_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.office_can_read_tenant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_lookup(_slug text)
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
    FROM public.offices o
   WHERE lower(o.slug) = lower(btrim(_slug))
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_lookup(text) IS
  'Resolve um escritório pelo slug para que a família conceda acesso (consentimento).';

REVOKE ALL ON FUNCTION public.office_lookup(text) FROM public;
GRANT EXECUTE ON FUNCTION public.office_lookup(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_office_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count integer;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  WITH claimed AS (
    UPDATE public.office_members m
       SET user_id = auth.uid(),
           status = 'ativo'
     WHERE m.user_id IS NULL
       AND m.status = 'convidado'
       AND lower(m.email) = v_email
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM claimed;

  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.claim_office_invites() IS
  'Liga convites pendentes (por e-mail) ao usuário logado. Retorna quantos foram reivindicados.';

REVOKE ALL ON FUNCTION public.claim_office_invites() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_office_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.office_consolidation()
RETURNS TABLE (
  office_id           uuid,
  office_name         text,
  owner_user_id       uuid,
  label               text,
  client_status       text,
  granted_at          timestamptz,
  entities            integer,
  entities_value      numeric,
  assets_value        numeric,
  positions_value     numeric,
  liabilities_value   numeric,
  net_worth           numeric,
  risks_open          integer,
  risks_critical      integer,
  documents_expiring  integer,
  documents_overdue   integer,
  legal_exposure      numeric,
  agro_area_ha        numeric,
  last_update         timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.office_id,
    o.name,
    c.owner_user_id,
    c.label,
    c.status,
    c.granted_at,
    coalesce(e.entities, 0),
    coalesce(e.entities_value, 0),
    coalesce(a.assets_value, 0),
    coalesce(p.positions_value, 0),
    coalesce(l.liabilities_value, 0),
    coalesce(a.assets_value, 0) + coalesce(p.positions_value, 0) - coalesce(l.liabilities_value, 0),
    coalesce(r.risks_open, 0),
    coalesce(r.risks_critical, 0),
    coalesce(d.documents_expiring, 0),
    coalesce(d.documents_overdue, 0),
    coalesce(j.legal_exposure, 0),
    coalesce(g.agro_area_ha, 0),
    greatest(
      coalesce(a.last_update, 'epoch'::timestamptz),
      coalesce(p.last_update, 'epoch'::timestamptz),
      coalesce(l.last_update, 'epoch'::timestamptz)
    )
  FROM public.office_clients c
  JOIN public.offices o ON o.id = c.office_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS entities,
           coalesce(sum(x.entities_value), 0) AS entities_value
      FROM (
        SELECT e1.id, sum(coalesce(a1."value", 0)) AS entities_value
          FROM public.entities e1
          LEFT JOIN public.assets a1 ON a1.entity_id = e1.id
         WHERE e1.owner_user_id = c.owner_user_id
         GROUP BY e1.id
      ) x
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(a2."value", 0)), 0) AS assets_value,
           max(coalesce(a2.updated_at, a2.created_at)) AS last_update
      FROM public.assets a2
      JOIN public.entities e2 ON e2.id = a2.entity_id
     WHERE e2.owner_user_id = c.owner_user_id
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(p2.quantity, 0) * coalesce(p2.unit_price, 0)), 0) AS positions_value,
           max(coalesce(p2.updated_at, p2.created_at)) AS last_update
      FROM public.positions p2
      JOIN public.entities e3 ON e3.id = p2.entity_id
     WHERE e3.owner_user_id = c.owner_user_id
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(l2.outstanding, 0)), 0) AS liabilities_value,
           max(coalesce(l2.updated_at, l2.created_at)) AS last_update
      FROM public.liabilities l2
      JOIN public.entities e4 ON e4.id = l2.entity_id
     WHERE e4.owner_user_id = c.owner_user_id
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE coalesce(r2.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado'))::int AS risks_open,
           count(*) FILTER (
             WHERE coalesce(r2.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
               AND r2.severity IN ('critical', 'critica', 'alta', 'high')
           )::int AS risks_critical
      FROM public.risks r2
      JOIN public.entities e5 ON e5.id = r2.entity_id
     WHERE e5.owner_user_id = c.owner_user_id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (
             WHERE d2.expiry_date IS NOT NULL
               AND d2.expiry_date >= current_date
               AND d2.expiry_date <= current_date + 60
           )::int AS documents_expiring,
           count(*) FILTER (
             WHERE d2.expiry_date IS NOT NULL AND d2.expiry_date < current_date
           )::int AS documents_overdue
      FROM public.documents d2
      JOIN public.entities e6 ON e6.id = d2.entity_id
     WHERE e6.owner_user_id = c.owner_user_id
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(j2.value_at_stake, 0)), 0) AS legal_exposure
      FROM public.legal_cases j2
      JOIN public.entities e7 ON e7.id = j2.entity_id
     WHERE e7.owner_user_id = c.owner_user_id
       AND coalesce(j2.status::text, '') NOT IN ('encerrado', 'arquivado', 'procedente')
  ) j ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(g2.area_ha, 0)), 0) AS agro_area_ha
      FROM public.agro_fields g2
      JOIN public.entities e8 ON e8.id = g2.entity_id
     WHERE e8.owner_user_id = c.owner_user_id
  ) g ON true
  WHERE public.office_can_read_tenant(c.owner_user_id)
    AND c.status <> 'encerrado'
  ORDER BY o.name, c.label;
$$;

COMMENT ON FUNCTION public.office_consolidation() IS
  'Agregado por família cliente visível ao chamador. Não devolve linhas cruas de cliente.';

REVOKE ALL ON FUNCTION public.office_consolidation() FROM public;
GRANT EXECUTE ON FUNCTION public.office_consolidation() TO authenticated;

ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_members_read_office" ON public.offices;
CREATE POLICY "office_members_read_office" ON public.offices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = offices.id AND m.user_id = auth.uid() AND m.status <> 'suspenso'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "office_create_own" ON public.offices;
CREATE POLICY "office_create_own" ON public.offices
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "office_admin_update" ON public.offices;
CREATE POLICY "office_admin_update" ON public.offices
  FOR UPDATE TO authenticated
  USING (public.office_role_of(auth.uid()) IN ('socio', 'gestor') AND created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "office_members_read_team" ON public.office_members;
CREATE POLICY "office_members_read_team" ON public.office_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "office_members_manage" ON public.office_members;
CREATE POLICY "office_members_manage" ON public.office_members
  FOR INSERT TO authenticated
  WITH CHECK (

    (user_id = auth.uid() AND role = 'socio')
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
         AND me.role IN ('socio', 'gestor')
    )
  );

DROP POLICY IF EXISTS "office_members_update" ON public.office_members;
CREATE POLICY "office_members_update" ON public.office_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
         AND me.role IN ('socio', 'gestor')
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "office_clients_read" ON public.office_clients;
CREATE POLICY "office_clients_read" ON public.office_clients
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_clients.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "office_clients_grant_by_family" ON public.office_clients;
CREATE POLICY "office_clients_grant_by_family" ON public.office_clients
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND granted_by = auth.uid()
    AND status = 'ativo'
  );

DROP POLICY IF EXISTS "office_clients_update_by_family" ON public.office_clients;
CREATE POLICY "office_clients_update_by_family" ON public.office_clients
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "office_clients_no_delete" ON public.office_clients;
CREATE POLICY "office_clients_no_delete" ON public.office_clients
  FOR DELETE TO authenticated
  USING (false);
