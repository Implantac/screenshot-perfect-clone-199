-- =============================================================================
-- Cotação automática: série de preços de mercado por símbolo (wave 6)
-- =============================================================================
-- Por que existe
-- --------------
-- O achado nº 1 do score de qualidade do dado é "posição com preço de mais de
-- 30 dias". Até aqui, `positions.unit_price` só mudava por digitação manual — o
-- que torna a performance e a alocação ficção depois de duas semanas.
--
-- Modelo:
--   quotes      → série histórica por (símbolo, fonte, data). Global, não é dado
--                 de cliente: preço de PETR4 é o mesmo para todos.
--   quote_runs  → log de cada sincronização (quantas posições foram atualizadas,
--                 quais símbolos falharam). É a trilha de auditoria do preço.
--
-- `quotes` é compartilhada entre tenants por desenho (market data). Por isso a
-- policy de leitura é `true` para `authenticated`; a escrita acontece apenas na
-- server function, que roda com o JWT do usuário — daí o INSERT liberado.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Símbolo canônico do sistema (PETR4, HGLG11, USD/BRL, US:AAPL).
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  -- Data de referência do preço (não a data da coleta).
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

-- ------------------------------------------------------------------ runs
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

-- --------------------------------------------------------------- posições
-- Procedência do preço: 'manual' (digitado), 'yahoo' / 'brapi' (automático).
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.positions.price_source IS
  'Origem do unit_price: manual, yahoo, brapi. Gravado pela sincronização de cotações.';
