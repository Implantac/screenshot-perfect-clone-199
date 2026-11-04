CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  as_of DATE NOT NULL,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_symbol_source_date
  ON public.quotes (symbol, source, as_of);
CREATE INDEX IF NOT EXISTS idx_quotes_symbol_date ON public.quotes (symbol, as_of DESC);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
REVOKE ALL ON public.quotes FROM anon;

DROP POLICY IF EXISTS "Market data é leitura pública autenticada" ON public.quotes;
CREATE POLICY "Market data é leitura pública autenticada" ON public.quotes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Server function grava cotações" ON public.quotes;
CREATE POLICY "Server function grava cotações" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Server function corrige cotações" ON public.quotes;
CREATE POLICY "Server function corrige cotações" ON public.quotes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.quote_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  symbols_requested INTEGER NOT NULL DEFAULT 0,
  symbols_found INTEGER NOT NULL DEFAULT 0,
  positions_updated INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_runs_entity ON public.quote_runs (entity_id, created_at DESC);

ALTER TABLE public.quote_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.quote_runs TO authenticated;
GRANT ALL ON public.quote_runs TO service_role;
REVOKE ALL ON public.quote_runs FROM anon;

DROP POLICY IF EXISTS "Owners read their quote runs" ON public.quote_runs;
CREATE POLICY "Owners read their quote runs" ON public.quote_runs
  FOR SELECT TO authenticated
  USING (
    (entity_id IS NOT NULL AND public.owns_entity(entity_id))
    OR (entity_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners insert their quote runs" ON public.quote_runs;
CREATE POLICY "Owners insert their quote runs" ON public.quote_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    (entity_id IS NOT NULL AND public.owns_entity(entity_id))
    OR (entity_id IS NULL AND user_id = auth.uid())
  );

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.positions.price_source IS
  'Origem do unit_price: manual, yahoo, brapi. Gravado pela sincronização de cotações.';