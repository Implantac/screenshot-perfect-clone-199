CREATE TABLE IF NOT EXISTS public.system_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,
  severity     text NOT NULL,
  source       text NOT NULL,
  message      text NOT NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,

  fingerprint  text NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT system_events_kind_check
    CHECK (kind IN ('error', 'slow', 'integration', 'security', 'client')),
  CONSTRAINT system_events_severity_check
    CHECK (severity IN ('info', 'warning', 'critical'))
);

COMMENT ON TABLE public.system_events IS
  'Eventos operacionais (erro, lentidão, integração). Diagnóstico, não trilha de auditoria (wave 26).';
COMMENT ON COLUMN public.system_events.fingerprint IS
  'Hash estável de kind|source|message: agrupa ocorrências iguais no painel.';
COMMENT ON COLUMN public.system_events.context IS
  'Contexto técnico já depurado de PII pela aplicação (e-mail, documento, UUID, token, valor).';

CREATE INDEX IF NOT EXISTS system_events_occurred_idx
  ON public.system_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS system_events_fingerprint_idx
  ON public.system_events(fingerprint, occurred_at DESC);
CREATE INDEX IF NOT EXISTS system_events_severity_idx
  ON public.system_events(severity, occurred_at DESC)
  WHERE severity IN ('warning', 'critical');

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_events_insert_authenticated" ON public.system_events;
CREATE POLICY "system_events_insert_authenticated" ON public.system_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "system_events_read_admin" ON public.system_events;
CREATE POLICY "system_events_read_admin" ON public.system_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "system_events_no_update" ON public.system_events;
CREATE POLICY "system_events_no_update" ON public.system_events
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "system_events_no_delete" ON public.system_events;
CREATE POLICY "system_events_no_delete" ON public.system_events
  FOR DELETE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.system_event_counts(_hours int DEFAULT 24)
RETURNS TABLE (
  fingerprint text,
  kind text,
  severity text,
  source text,
  message text,
  occurrences bigint,
  first_seen timestamptz,
  last_seen timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.fingerprint,
         min(e.kind),
         max(e.severity),
         e.source,
         e.message,
         count(*)::bigint,
         min(e.occurred_at),
         max(e.occurred_at)
    FROM public.system_events e
   WHERE e.occurred_at >= now() - make_interval(hours => greatest(_hours, 1))
     AND public.has_role(auth.uid(), 'admin')
   GROUP BY e.fingerprint, e.source, e.message
   ORDER BY count(*) DESC, max(e.occurred_at) DESC
   LIMIT 50;
$$;

COMMENT ON FUNCTION public.system_event_counts(int) IS
  'Eventos agrupados por fingerprint na janela de horas. Só admin (wave 26).';

REVOKE ALL ON FUNCTION public.system_event_counts(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.system_event_counts(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.system_events_recent(_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  kind text,
  severity text,
  source text,
  message text,
  context jsonb,
  occurred_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.kind, e.severity, e.source, e.message, e.context, e.occurred_at
    FROM public.system_events e
   WHERE public.has_role(auth.uid(), 'admin')
   ORDER BY e.occurred_at DESC
   LIMIT greatest(_limit, 1);
$$;

COMMENT ON FUNCTION public.system_events_recent(int) IS
  'Últimos eventos, para a lista de detalhe do painel de saúde. Só admin (wave 26).';

REVOKE ALL ON FUNCTION public.system_events_recent(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.system_events_recent(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_system_events(_days int DEFAULT 90)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode limpar eventos de sistema.';
  END IF;

  DELETE FROM public.system_events
   WHERE occurred_at < now() - make_interval(days => greatest(_days, 1));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_system_events(int) IS
  'Remove eventos mais antigos que N dias (padrão 90). Só admin.';

REVOKE ALL ON FUNCTION public.purge_system_events(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purge_system_events(int) TO authenticated;
