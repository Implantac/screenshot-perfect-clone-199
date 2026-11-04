ALTER TABLE public.office_clients
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['resumo']::text[];

COMMENT ON COLUMN public.office_clients.scopes IS
  'Seções que o escritório pode abrir em detalhe. Default mínimo: resumo. Escolhido pela família.';

ALTER TABLE public.office_clients
  DROP CONSTRAINT IF EXISTS office_clients_scopes_check;
ALTER TABLE public.office_clients
  ADD CONSTRAINT office_clients_scopes_check
  CHECK (
    scopes <@ ARRAY['resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos']::text[]
    AND 'resumo' = ANY (scopes)
  );

CREATE TABLE IF NOT EXISTS public.office_access_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id         uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,

  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  target_owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope             text NOT NULL,
  action            text NOT NULL DEFAULT 'abrir_detalhe',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_access_log_scope_check
    CHECK (scope IN ('resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos')),
  CONSTRAINT office_access_log_action_check
    CHECK (action IN ('abrir_detalhe', 'negado_sem_escopo', 'consolidado'))
);

COMMENT ON TABLE public.office_access_log IS
  'Quem do escritório abriu qual seção de qual família, quando. A família pode ler os próprios acessos.';

CREATE INDEX IF NOT EXISTS office_access_log_target_idx
  ON public.office_access_log(target_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS office_access_log_reader_idx
  ON public.office_access_log(user_id, created_at DESC);

ALTER TABLE public.office_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_access_log_read" ON public.office_access_log;
CREATE POLICY "office_access_log_read" ON public.office_access_log
  FOR SELECT TO authenticated
  USING (
    target_owner_id = auth.uid()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = office_access_log.office_id
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
         AND m.role IN ('socio', 'gestor')
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "office_access_log_no_update" ON public.office_access_log;
CREATE POLICY "office_access_log_no_update" ON public.office_access_log
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "office_access_log_no_delete" ON public.office_access_log;
CREATE POLICY "office_access_log_no_delete" ON public.office_access_log
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.office_client_scopes(_owner uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(c.scopes, ARRAY['resumo']::text[])
    FROM public.office_clients c
   WHERE c.owner_user_id = _owner
     AND c.status = 'ativo'
   ORDER BY c.granted_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_client_scopes(uuid) IS
  'Escopos consentidos pela família (vínculo ativo mais recente).';

REVOKE ALL ON FUNCTION public.office_client_scopes(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_client_scopes(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_family_detail(_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link     record;
  v_scopes   text[];
  v_sections jsonb := '{}'::jsonb;
  v_result   jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória.';
  END IF;

  SELECT c.id, c.office_id, c.label, c.scopes
    INTO v_link
    FROM public.office_clients c
   WHERE c.owner_user_id = _owner
     AND c.status = 'ativo'
   ORDER BY c.granted_at DESC
   LIMIT 1;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Nenhum vínculo ativo: a família precisa consentir o acesso ao escritório.';
  END IF;

  -- Só membro ativo do escritório do vínculo, a própria família ou admin.
  IF NOT (
    _owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = v_link.office_id
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para abrir este detalhe.';
  END IF;

  v_scopes := coalesce(v_link.scopes, ARRAY['resumo']::text[]);

  -- Registro ANTES de devolver: acesso negado também é registro.
  INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
  VALUES (v_link.office_id, auth.uid(), _owner, 'resumo', 'abrir_detalhe');

  -- ---- resumo: sempre presente (é o mínimo que o vínculo garante)
  v_sections := v_sections || jsonb_build_object(
    'resumo',
    (
      SELECT jsonb_build_object(
        'entities', count(DISTINCT e.id),
        'assetsValue', coalesce(sum(coalesce(a.value, 0)), 0),
        'lastUpdate', max(coalesce(a.updated_at, a.created_at))
      )
      FROM public.entities e
      LEFT JOIN public.assets a ON a.entity_id = e.id
      WHERE e.owner_user_id = _owner
    )
  );

  -- ---- custódia
  IF 'custodia' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'custodia', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'custodia',
      jsonb_build_object(
        'total', (
          SELECT coalesce(sum(coalesce(p.quantity, 0) * coalesce(p.unit_price, 0)), 0)
            FROM public.positions p
            JOIN public.entities e ON e.id = p.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'byClass', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT p.asset_class::text AS class,
                     count(*)::int AS positions,
                     sum(coalesce(p.quantity, 0) * coalesce(p.unit_price, 0)) AS value
                FROM public.positions p
                JOIN public.entities e ON e.id = p.entity_id
               WHERE e.owner_user_id = _owner
               GROUP BY p.asset_class
               ORDER BY 3 DESC
            ) t
        ),
        'debt', (
          SELECT coalesce(sum(coalesce(l.outstanding, 0)), 0)
            FROM public.liabilities l
            JOIN public.entities e ON e.id = l.entity_id
           WHERE e.owner_user_id = _owner
        )
      )
    );
  END IF;

  -- ---- contencioso
  IF 'contencioso' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'contencioso', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'contencioso',
      jsonb_build_object(
        'exposure', (
          SELECT coalesce(sum(coalesce(c.value_at_stake, 0)), 0)
            FROM public.legal_cases c
            JOIN public.entities e ON e.id = c.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'cases', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT c.title, c.type::text AS type, c.status::text AS status,
                     c.probability, coalesce(c.value_at_stake, 0) AS value
                FROM public.legal_cases c
                JOIN public.entities e ON e.id = c.entity_id
               WHERE e.owner_user_id = _owner
               ORDER BY coalesce(c.value_at_stake, 0) DESC
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  -- ---- agro
  IF 'agro' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'agro', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'agro',
      jsonb_build_object(
        'areaHa', (
          SELECT coalesce(sum(coalesce(f.area_ha, 0)), 0)
            FROM public.agro_fields f
            JOIN public.entities e ON e.id = f.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'fields', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT f.name, f.crop::text AS crop, f.area_ha,
                     f.productivity_sc_ha, f.cost_per_ha
                FROM public.agro_fields f
                JOIN public.entities e ON e.id = f.entity_id
               WHERE e.owner_user_id = _owner
               ORDER BY f.area_ha DESC
               LIMIT 15
            ) t
        )
      )
    );
  END IF;

  -- ---- documentos (sem URL de arquivo)
  IF 'documentos' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'documentos', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'documentos',
      jsonb_build_object(
        'expiring', (
          SELECT count(*)::int
            FROM public.documents d
            JOIN public.entities e ON e.id = d.entity_id
           WHERE e.owner_user_id = _owner
             AND d.expiry_date >= current_date
             AND d.expiry_date <= current_date + 60
        ),
        'overdue', (
          SELECT count(*)::int
            FROM public.documents d
            JOIN public.entities e ON e.id = d.entity_id
           WHERE e.owner_user_id = _owner
             AND d.expiry_date < current_date
        ),
        'items', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT d.title, d.type, d.expiry_date, d.status::text AS status
                FROM public.documents d
                JOIN public.entities e ON e.id = d.entity_id
               WHERE e.owner_user_id = _owner
                 AND d.expiry_date IS NOT NULL
               ORDER BY d.expiry_date
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  -- ---- riscos
  IF 'riscos' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'riscos', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'riscos',
      jsonb_build_object(
        'open', (
          SELECT count(*)::int
            FROM public.risks r
            JOIN public.entities e ON e.id = r.entity_id
           WHERE e.owner_user_id = _owner
             AND coalesce(r.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
        ),
        'items', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT r.title, r.severity::text AS severity, r.status, r.due_date
                FROM public.risks r
                JOIN public.entities e ON e.id = r.entity_id
               WHERE e.owner_user_id = _owner
                 AND coalesce(r.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
               ORDER BY CASE r.severity
                          WHEN 'critical' THEN 1 WHEN 'critica' THEN 1
                          WHEN 'high' THEN 2 WHEN 'alta' THEN 2
                          WHEN 'medium' THEN 3 WHEN 'media' THEN 3
                          ELSE 4 END,
                        r.due_date NULLS LAST
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'ownerUserId', _owner,
    'label', v_link.label,
    'officeId', v_link.office_id,
    'scopes', to_jsonb(v_scopes),
    'sections', v_sections,
    'generatedAt', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.office_family_detail(uuid) IS
  'Detalhe por família respeitando os escopos consentidos. Cada seção aberta gera linha em office_access_log (wave 24).';

REVOKE ALL ON FUNCTION public.office_family_detail(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_family_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_my_access_log(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  office_name text,
  reader_email text,
  scope text,
  action text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id,
         o.name,
         coalesce(u.email, 'membro do escritório'),
         l.scope,
         l.action,
         l.created_at
    FROM public.office_access_log l
    JOIN public.offices o ON o.id = l.office_id
    LEFT JOIN auth.users u ON u.id = l.user_id
   WHERE l.target_owner_id = auth.uid()
   ORDER BY l.created_at DESC
   LIMIT greatest(_limit, 1);
$$;

COMMENT ON FUNCTION public.office_my_access_log(int) IS
  'Quem abriu meus dados e quando — visível para a própria família (wave 24).';

REVOKE ALL ON FUNCTION public.office_my_access_log(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_my_access_log(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.office_set_scopes(_grant uuid, _scopes text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT c.owner_user_id INTO v_owner
    FROM public.office_clients c
   WHERE c.id = _grant;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Só a própria família altera os escopos deste vínculo.';
  END IF;

  IF NOT ('resumo' = ANY (_scopes)) THEN
    RAISE EXCEPTION 'O escopo resumo não pode ser removido.';
  END IF;

  IF NOT (_scopes <@ ARRAY['resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos']::text[]) THEN
    RAISE EXCEPTION 'Escopo desconhecido.';
  END IF;

  UPDATE public.office_clients
     SET scopes = _scopes
   WHERE id = _grant;

  RETURN _scopes;
END;
$$;

COMMENT ON FUNCTION public.office_set_scopes(uuid, text[]) IS
  'Atualiza os escopos consentidos. Só a família dona do vínculo.';

REVOKE ALL ON FUNCTION public.office_set_scopes(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_set_scopes(uuid, text[]) TO authenticated;
