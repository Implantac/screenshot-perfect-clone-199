-- =============================================================================
-- Importação de extrato (OFX / CSV) com deduplicação e trilha
--
-- Por que existe: sem importação, todo dado financeiro é digitado à mão — e
-- cliente de family office não digita. Este é o item P0 do roadmap.
--
-- Modelo:
--   import_batches ......... um registro por arquivo importado (auditoria + rollback)
--   transactions.external_id  FITID do OFX ou hash determinístico da linha
--   transactions.import_batch_id  permite desfazer uma importação inteira
--
-- Deduplicação: índice único parcial (entity_id, external_id). Reimportar o
-- mesmo extrato não duplica lançamento — o banco recusa, não a aplicação.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('ofx', 'csv')),
  -- Hash do conteúdo: detecta reenvio do mesmo arquivo.
  file_hash TEXT,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_duplicated INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido', 'parcial', 'falhou')),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_entity ON public.import_batches(entity_id);
CREATE INDEX IF NOT EXISTS idx_import_batches_hash ON public.import_batches(file_hash);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
REVOKE ALL ON public.import_batches FROM anon;

DROP POLICY IF EXISTS "Owners manage import batches" ON public.import_batches;
CREATE POLICY "Owners manage import batches" ON public.import_batches
  FOR ALL TO authenticated
  USING (entity_id IS NOT NULL AND public.owns_entity(entity_id))
  WITH CHECK (entity_id IS NOT NULL AND public.owns_entity(entity_id));

-- ------------------------------------------------------------- transactions
DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN external_id TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN source TEXT DEFAULT 'manual';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.transactions ADD COLUMN import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Unicidade por tenant: o mesmo FITID pode existir em tenants diferentes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_entity_external
  ON public.transactions (entity_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_batch ON public.transactions(import_batch_id);
