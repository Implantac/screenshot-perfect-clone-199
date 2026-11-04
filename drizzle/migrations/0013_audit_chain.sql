CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS sequence BIGINT,
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS entry_hash TEXT;

COMMENT ON COLUMN public.audit_logs.sequence IS
  'Posição na cadeia do tenant (owner_user_id). Sem buraco quando íntegra.';
COMMENT ON COLUMN public.audit_logs.prev_hash IS
  'entry_hash da entrada anterior do mesmo tenant; 64 zeros na primeira.';
COMMENT ON COLUMN public.audit_logs.entry_hash IS
  'SHA-256(prev_hash || ''|'' || audit_payload_text(entrada)).';

CREATE INDEX IF NOT EXISTS idx_audit_logs_chain
  ON public.audit_logs(owner_user_id, sequence DESC);

CREATE OR REPLACE FUNCTION public.audit_payload_text(
  _owner uuid,
  _sequence bigint,
  _action text,
  _table text,
  _record uuid,
  _created timestamptz,
  _user uuid,
  _old jsonb,
  _new jsonb
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT concat_ws('|',
    coalesce(_owner::text, ''),
    coalesce(_sequence::text, ''),
    coalesce(_action, ''),
    coalesce(_table, ''),
    coalesce(_record::text, ''),
    coalesce(to_char(_created AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
    coalesce(_user::text, ''),
    md5(coalesce(_old, 'null'::jsonb)::text),
    md5(coalesce(_new, 'null'::jsonb)::text)
  );
$$;

COMMENT ON FUNCTION public.audit_payload_text IS
  'Forma canônica de uma entrada de auditoria. Fonte única do hash (trigger e view usam esta função).';

CREATE OR REPLACE FUNCTION public.chain_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text;
  v_seq bigint;
BEGIN
  NEW.created_at := coalesce(NEW.created_at, now());
  -- Entrada sem autor (rotina do sistema) tem cadeia própria, identificada.
  NEW.owner_user_id := coalesce(NEW.owner_user_id, NEW.user_id,
                                '00000000-0000-0000-0000-000000000000'::uuid);

  -- Um lock por tenant: duas escritas simultâneas não podem ler o mesmo "último elo".
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_user_id::text, 0));

  SELECT l.entry_hash, l.sequence
    INTO v_prev, v_seq
    FROM public.audit_logs l
   WHERE l.owner_user_id = NEW.owner_user_id
     AND l.entry_hash IS NOT NULL
   ORDER BY l.sequence DESC NULLS LAST
   LIMIT 1;

  NEW.sequence := coalesce(v_seq, 0) + 1;
  NEW.prev_hash := coalesce(v_prev, repeat('0', 64));
  NEW.entry_hash := encode(
    digest(
      NEW.prev_hash || '|' || public.audit_payload_text(
        NEW.owner_user_id, NEW.sequence, NEW.action, NEW.table_name, NEW.record_id,
        NEW.created_at, NEW.user_id, NEW.old_data, NEW.new_data
      ),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.chain_audit_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS chain_audit_logs ON public.audit_logs;
CREATE TRIGGER chain_audit_logs BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.chain_audit_log();

CREATE OR REPLACE FUNCTION public.backfill_audit_chain()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_row record;
  v_prev text;
  v_hash text;
  v_payload text;
  v_seq bigint;
  v_count integer := 0;
BEGIN
  FOR v_owner IN
    SELECT DISTINCT owner_user_id FROM public.audit_logs WHERE entry_hash IS NULL
  LOOP
    v_prev := repeat('0', 64);
    v_seq := 0;

    FOR v_row IN
      SELECT id, action, table_name, record_id, created_at, user_id, old_data, new_data
        FROM public.audit_logs
       WHERE owner_user_id = v_owner AND entry_hash IS NULL
       ORDER BY created_at ASC, id ASC
    LOOP
      v_seq := v_seq + 1;
      v_payload := public.audit_payload_text(
        v_owner, v_seq, v_row.action, v_row.table_name, v_row.record_id,
        coalesce(v_row.created_at, now()), v_row.user_id, v_row.old_data, v_row.new_data
      );
      v_hash := encode(digest(v_prev || '|' || v_payload, 'sha256'), 'hex');

      UPDATE public.audit_logs
         SET sequence = v_seq, prev_hash = v_prev, entry_hash = v_hash
       WHERE id = v_row.id;

      v_prev := v_hash;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_audit_chain() FROM PUBLIC, anon, authenticated;

SELECT public.backfill_audit_chain();

CREATE OR REPLACE VIEW public.audit_logs_chain
WITH (security_invoker = true) AS
SELECT
  l.id,
  l.owner_user_id,
  l.sequence,
  l.action,
  l.table_name,
  l.record_id,
  l.user_id,
  l.created_at,
  l.prev_hash,
  l.entry_hash,
  l.old_data,
  l.new_data,
  public.audit_payload_text(
    l.owner_user_id, l.sequence, l.action, l.table_name, l.record_id,
    l.created_at, l.user_id, l.old_data, l.new_data
  ) AS payload_text
FROM public.audit_logs l;

COMMENT ON VIEW public.audit_logs_chain IS
  'Trilha com o texto canônico recalculado — é sobre ele que o app verifica o hash.';

CREATE OR REPLACE FUNCTION public.verify_audit_chain(_limit integer DEFAULT 500)
RETURNS TABLE (
  checked integer,
  broken integer,
  first_broken_sequence bigint,
  started_mid_chain boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH janela AS (
    SELECT l.*
      FROM public.audit_logs l
     WHERE l.sequence IS NOT NULL
     ORDER BY l.sequence DESC
     LIMIT greatest(1, least(coalesce(_limit, 500), 5000))
  ),
  com_anterior AS (
    SELECT j.*,
           lag(j.entry_hash) OVER (PARTITION BY j.owner_user_id ORDER BY j.sequence) AS prev_entry_hash,
           lag(j.sequence) OVER (PARTITION BY j.owner_user_id ORDER BY j.sequence) AS prev_sequence
      FROM janela j
  )
  SELECT
    count(*)::integer,
    count(*) FILTER (
      WHERE (prev_sequence IS NOT NULL AND sequence <> prev_sequence + 1)
         OR (prev_entry_hash IS NOT NULL AND prev_hash <> prev_entry_hash)
    )::integer,
    min(sequence) FILTER (
      WHERE (prev_sequence IS NOT NULL AND sequence <> prev_sequence + 1)
         OR (prev_entry_hash IS NOT NULL AND prev_hash <> prev_entry_hash)
    ),
    coalesce(min(sequence) > 1, false)
  FROM com_anterior;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_audit_chain(integer) TO authenticated;

CREATE TABLE IF NOT EXISTS public.audit_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  period_from TIMESTAMPTZ,
  period_to TIMESTAMPTZ,
  entries INTEGER NOT NULL,
  head_sequence BIGINT,
  head_hash TEXT,
  chain_hash TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  signature TEXT,
  signature_algorithm TEXT,
  manifest JSONB NOT NULL,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_anchors_owner ON public.audit_anchors(owner_user_id, created_at DESC);

ALTER TABLE public.audit_anchors ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_anchors TO authenticated;
GRANT ALL ON public.audit_anchors TO service_role;
REVOKE ALL ON public.audit_anchors FROM anon;

REVOKE UPDATE, DELETE ON public.audit_anchors FROM authenticated;

DROP POLICY IF EXISTS "Owners read audit anchors" ON public.audit_anchors;
CREATE POLICY "Owners read audit anchors" ON public.audit_anchors
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners insert audit anchors" ON public.audit_anchors;
CREATE POLICY "Owners insert audit anchors" ON public.audit_anchors
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.audit_anchors IS
  'Manifestos assinados da cadeia de auditoria (wave 20). Imutáveis para authenticated.';
