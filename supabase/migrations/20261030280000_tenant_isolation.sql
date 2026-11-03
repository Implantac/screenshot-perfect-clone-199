-- =============================================================================
-- Wave 23 — fechar o vazamento entre tenants (policies legadas)
--
-- O DIAGNÓSTICO (registrado na wave 22, §30.1)
-- Conviveram, desde a primeira versão do projeto, duas camadas de RLS:
--
--   · as policies "legadas" criadas antes do modelo por entidade:
--       FOR ALL USING (auth.role() = 'authenticated')
--       FOR SELECT USING (true)
--   · as policies por dono/entidade criadas depois:
--       USING (public.owns_entity(entity_id)) / owner_user_id = auth.uid()
--
-- Políticas PERMISSIVAS se somam com OR. Enquanto a legada existe, ela anula a
-- nova: qualquer usuário autenticado lê e escreve **dados de outro tenant**.
-- Tabelas afetadas: entities, entity_shares, members, assets, documents,
-- transactions, risks, audit_logs, jarvis_insights, jarvis_health_scores e
-- jarvis_action_plans. Em `audit_logs` o efeito era o pior possível: a trilha de
-- auditoria de todos os tenants era legível por qualquer sessão.
--
-- POR QUE ISSO PRECISA DE CUIDADO
-- Ao remover a policy permissiva, linhas SEM vínculo de tenant (entity_id nulo,
-- owner_user_id nulo) deixariam de ser visíveis para todo mundo — inclusive para
-- quem as criou. Isso parece "perda de dados" e gera ticket. A solução não é
-- manter o buraco aberto: é **quarentena**.
--
--   · linha com vínculo  → visível ao dono (como sempre deveria ter sido);
--   · linha sem vínculo  → visível APENAS para admin, que pode adotá-la.
--
-- Nada é apagado. Nada fica público. O admin é avisado por função de contagem.
--
-- Também é recriada a policy de INSERT em `audit_logs` para o autor registrar o
-- próprio evento: o trigger `record_audit_log()` é SECURITY DEFINER e continua
-- funcionando sem policy, mas o JARVIS (wave 21) grava a trilha da proposta pela
-- sessão do usuário e não pode perder esse direito.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auditoria viva do isolamento (o número que a tela mostra)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patrium_tenant_tables()
RETURNS TABLE (table_name text, tenant_column text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('entities',            'owner_user_id'),
    ('members',             'owner_user_id'),
    ('entity_shares',       'entity_id'),
    ('assets',              'entity_id'),
    ('documents',           'entity_id'),
    ('transactions',        'entity_id'),
    ('risks',               'entity_id'),
    ('liabilities',         'entity_id'),
    ('positions',           'entity_id'),
    ('accounts',            'entity_id'),
    ('goals',               'entity_id'),
    ('suppliers',           'entity_id'),
    ('commitments',         'entity_id'),
    ('portal_grants',       'entity_id'),
    ('legal_cases',         'entity_id'),
    ('agro_fields',         'entity_id'),
    ('agro_leases',         'entity_id'),
    ('agro_barters',        'entity_id'),
    ('agro_environmental',  'entity_id'),
    ('audit_logs',          'owner_user_id'),
    ('jarvis_insights',     'entity_id'),
    ('jarvis_health_scores','entity_id')
  ) AS t(table_name, tenant_column);
$$;

COMMENT ON FUNCTION public.patrium_tenant_tables() IS
  'Tabelas que guardam dado de tenant e a coluna que define o dono (wave 23).';

-- Classifica as policies permissivas que ainda estão de pé.
CREATE OR REPLACE FUNCTION public.patrium_isolation_audit()
RETURNS TABLE (
  table_name     text,
  policy_name    text,
  cmd            text,
  qual           text,
  with_check     text,
  verdict        text,
  detail         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant AS (
    SELECT t.table_name, t.tenant_column FROM public.patrium_tenant_tables() t
  ),
  -- Dados de referência: leitura compartilhada é intencional e não é vazamento.
  compartilhado(nome) AS (
    VALUES ('quotes'), ('quote_runs'), ('custodians'), ('security_policies')
  )
  SELECT
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    coalesce(p.qual, ''),
    coalesce(p.with_check, ''),
    CASE
      WHEN c.nome IS NOT NULL THEN 'compartilhado'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('true', '(true)')
        OR lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('auth.role()=''authenticated''', '(auth.role()=''authenticated'')')
        OR lower(replace(coalesce(p.qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
        THEN 'vazamento'
      ELSE 'ok'
    END,
    CASE
      WHEN c.nome IS NOT NULL THEN 'Leitura compartilhada intencional (dado de mercado/referência).'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('true', '(true)')
        THEN 'Policy sem predicado: qualquer sessão autenticada alcança linhas de outro tenant.'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
        THEN 'Policy legada por papel: anula (OR) a policy por entidade/dono.'
      ELSE 'Escopada por dono ou entidade.'
    END
  FROM pg_policies p
  JOIN tenant t ON t.table_name = p.tablename AND p.schemaname = 'public'
  LEFT JOIN compartilhado c ON c.nome = p.tablename::text
  ORDER BY 6, 1, 2;
$$;

COMMENT ON FUNCTION public.patrium_isolation_audit() IS
  'Auditoria viva das policies de isolamento por tenant (wave 23). Não devolve dado de cliente.';

REVOKE ALL ON FUNCTION public.patrium_isolation_audit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patrium_isolation_audit() TO authenticated;
REVOKE ALL ON FUNCTION public.patrium_tenant_tables() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patrium_tenant_tables() TO authenticated;

-- Contagem de linhas órfãs (sem dono) por tabela — só admin.
CREATE OR REPLACE FUNCTION public.patrium_orphan_counts()
RETURNS TABLE (table_name text, tenant_column text, orphan_rows bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode ver a contagem de linhas órfãs.';
  END IF;

  FOR r IN SELECT * FROM public.patrium_tenant_tables() LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL', r.table_name, r.tenant_column)
      INTO v_count;
    table_name := r.table_name;
    tenant_column := r.tenant_column;
    orphan_rows := coalesce(v_count, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.patrium_orphan_counts() IS
  'Linhas sem vínculo de tenant (entity_id/owner_user_id nulo) por tabela. Ficam em quarentena para admin (wave 23).';

REVOKE ALL ON FUNCTION public.patrium_orphan_counts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patrium_orphan_counts() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Derrubar as policies legadas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entities;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entity_shares;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.members;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.assets;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.documents;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.risks;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.audit_logs;

DROP POLICY IF EXISTS "Users can manage their action plans" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Authenticated users can manage action plans" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Users can view insights related to their entities" ON public.jarvis_insights;
DROP POLICY IF EXISTS "Users can view health scores" ON public.jarvis_health_scores;

-- Qualquer outra policy que use o padrão legado por papel.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND lower(replace(coalesce(qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
       AND tablename IN (SELECT table_name FROM public.patrium_tenant_tables())
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Policy legada removida: %.%', r.tablename, r.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Quarentena: linha sem dono fica visível só para admin
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_policy text;
BEGIN
  FOR r IN SELECT * FROM public.patrium_tenant_tables()
            WHERE table_name IN (
              'entities', 'members', 'entity_shares', 'assets', 'documents',
              'transactions', 'risks', 'audit_logs', 'jarvis_insights',
              'jarvis_health_scores'
            )
  LOOP
    v_policy := format('Quarentena admin %s', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%I IS NULL AND public.has_role(auth.uid(), ''admin'')) WITH CHECK (%I IS NULL AND public.has_role(auth.uid(), ''admin''))',
      v_policy, r.table_name, r.tenant_column, r.tenant_column
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trilha: autor registra o próprio evento (JARVIS wave 21 depende disso)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autores registram a própria trilha" ON public.audit_logs;
CREATE POLICY "Autores registram a própria trilha" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND coalesce(user_id, auth.uid()) = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. Aviso — o que fazer com as linhas órfãs
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_total bigint := 0;
  v_detail text := '';
  r record;
BEGIN
  FOR r IN
    SELECT pc.table_name, pc.orphan_rows
      FROM public.patrium_orphan_counts() pc
     WHERE pc.orphan_rows > 0
  LOOP
    v_total := v_total + r.orphan_rows;
    v_detail := v_detail || format('%s: %s linha(s); ', r.table_name, r.orphan_rows);
  END LOOP;

  IF v_total > 0 THEN
    RAISE NOTICE
      'Quarentena ativa: % linha(s) sem vínculo de tenant (%) — visíveis apenas para admin. Adote-as para uma entidade (UPDATE ... SET entity_id = <uuid>) ou remova com decisão registrada.',
      v_total, v_detail;
  ELSE
    RAISE NOTICE 'Isolamento fechado: nenhuma linha órfã encontrada.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT * FROM public.patrium_isolation_audit() WHERE verdict <> 'ok';
--   SELECT * FROM public.patrium_orphan_counts() WHERE orphan_rows > 0;
-- Ambos devem voltar vazios (ou só 'compartilhado').
-- ---------------------------------------------------------------------------
