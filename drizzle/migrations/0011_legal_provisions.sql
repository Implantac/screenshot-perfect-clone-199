DO $$ BEGIN
  CREATE TYPE public.legal_polarity AS ENUM (
    'passivo',  -- a família é ré: pode perder
    'ativo',    -- a família é autora: pode ganhar (nunca reconhece)
    'neutro'    -- inventário, regularização, usucapião: não há contingência
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.legal_phase AS ENUM (
    'conhecimento',  -- citação, contestação: quase tudo pode acontecer
    'instrucao',     -- provas em produção: probabilidade estável
    'sentenca',      -- decisão de 1º grau: a incerteza cai
    'recurso',       -- decisão provisória: volta a oscilar
    'execucao',      -- mérito superado: a discussão é sobre quantum
    'encerrado'      -- nada mais a provisoriar
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.provision_entry_kind AS ENUM (
    'constituicao',  -- reconhecimento inicial
    'atualizacao',   -- correção monetária / juros sobre a provisão
    'reversao',      -- processo favorável ou redução de risco
    'baixa'          -- pagamento ou encerramento
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.legal_cases
  ADD COLUMN IF NOT EXISTS polarity public.legal_polarity NOT NULL DEFAULT 'passivo',
  ADD COLUMN IF NOT EXISTS probability NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS phase public.legal_phase,
  ADD COLUMN IF NOT EXISTS expected_settlement DATE,
  ADD COLUMN IF NOT EXISTS lawyer_assessment TEXT;

ALTER TABLE public.legal_cases
  DROP CONSTRAINT IF EXISTS legal_cases_probability_range;
ALTER TABLE public.legal_cases
  ADD CONSTRAINT legal_cases_probability_range
  CHECK (probability IS NULL OR (probability > 0 AND probability <= 1));

ALTER TABLE public.legal_cases
  ADD COLUMN IF NOT EXISTS provision_recognized BOOLEAN
  GENERATED ALWAYS AS (
    polarity = 'passivo'
    AND status <> 'encerrado'
    AND probability IS NOT NULL
    AND probability > 0.5
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_legal_cases_polarity ON public.legal_cases(polarity);

COMMENT ON COLUMN public.legal_cases.probability IS
  'Percentual informado pelo jurídico: chance de perda (passivo) ou de êxito (ativo). Nulo = heurística do app.';
COMMENT ON COLUMN public.legal_cases.provision_recognized IS
  'Régua CPC 25 aplicada no banco: passivo, não encerrado, probabilidade > 50%.';

CREATE TABLE IF NOT EXISTS public.legal_provision_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.legal_cases(id) ON DELETE CASCADE,
  kind public.provision_entry_kind NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provision_entries_case ON public.legal_provision_entries(case_id);
CREATE INDEX IF NOT EXISTS idx_provision_entries_date ON public.legal_provision_entries(occurred_on);

ALTER TABLE public.legal_provision_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_provision_entries TO authenticated;
GRANT ALL ON public.legal_provision_entries TO service_role;
REVOKE ALL ON public.legal_provision_entries FROM anon;

DROP POLICY IF EXISTS "Owners manage provision entries" ON public.legal_provision_entries;
CREATE POLICY "Owners manage provision entries" ON public.legal_provision_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.legal_cases c
      WHERE c.id = case_id AND public.owns_entity(c.entity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.legal_cases c
      WHERE c.id = case_id AND public.owns_entity(c.entity_id)
    )
  );

CREATE OR REPLACE VIEW public.legal_provision_balances
WITH (security_invoker = true) AS
SELECT
  c.id AS case_id,
  c.entity_id,
  c.title,
  c.polarity,
  c.status,
  c.probability,
  c.provision_recognized,
  COALESCE(SUM(
    CASE e.kind
      WHEN 'constituicao' THEN e.amount
      WHEN 'atualizacao' THEN e.amount
      WHEN 'reversao' THEN -e.amount
      WHEN 'baixa' THEN -e.amount
      ELSE 0
    END
  ), 0) AS book_balance
FROM public.legal_cases c
LEFT JOIN public.legal_provision_entries e ON e.case_id = c.id
GROUP BY c.id, c.entity_id, c.title, c.polarity, c.status, c.probability,
         c.provision_recognized;

COMMENT ON VIEW public.legal_provision_balances IS
  'Saldo de provisão por processo (constituição + atualização − reversão − baixa).';

CREATE OR REPLACE FUNCTION public.provisions_pending_closure()
RETURNS TABLE (
  case_id UUID,
  title TEXT,
  entity_id UUID,
  book_balance NUMERIC,
  status public.legal_case_status
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT b.case_id, b.title, b.entity_id, b.book_balance, b.status
  FROM public.legal_provision_balances b
  WHERE b.status = 'encerrado' AND b.book_balance <> 0
  ORDER BY b.book_balance DESC;
$$;

GRANT EXECUTE ON FUNCTION public.provisions_pending_closure() TO authenticated;

COMMENT ON FUNCTION public.provisions_pending_closure() IS
  'Processos encerrados com saldo de provisão em aberto — exigem baixa ou reversão.';
