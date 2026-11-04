DO $$ BEGIN
  CREATE TYPE public.liability_kind AS ENUM (
    'financiamento_imobiliario', 'credito_rural', 'emprestimo', 'consignado',
    'cartao', 'debenture', 'divida_societaria', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.amortization_kind AS ENUM ('price', 'sac', 'bullet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_kind AS ENUM (
    'liquidez', 'sucessao', 'imovel', 'educacao', 'filantropia',
    'reserva_oportunidade', 'meta_patrimonial', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.liability_kind NOT NULL DEFAULT 'emprestimo',
  creditor TEXT,
  principal NUMERIC NOT NULL DEFAULT 0,
  outstanding NUMERIC NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  rate_annual NUMERIC NOT NULL DEFAULT 0,
  amortization public.amortization_kind NOT NULL DEFAULT 'price',
  term_months INTEGER,
  start_date DATE,
  due_date DATE,
  collateral TEXT,
  is_offshore BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_liabilities_entity ON public.liabilities(entity_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_due ON public.liabilities(due_date);

ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO authenticated;
GRANT ALL ON public.liabilities TO service_role;
REVOKE ALL ON public.liabilities FROM anon;

DROP POLICY IF EXISTS "Owners manage liabilities" ON public.liabilities;
CREATE POLICY "Owners manage liabilities" ON public.liabilities
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.goal_kind NOT NULL DEFAULT 'meta_patrimonial',
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  allocated NUMERIC NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  target_date DATE NOT NULL,
  priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  expected_return NUMERIC NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_entity ON public.goals(entity_id);
CREATE INDEX IF NOT EXISTS idx_goals_date ON public.goals(target_date);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
REVOKE ALL ON public.goals FROM anon;

DROP POLICY IF EXISTS "Owners manage goals" ON public.goals;
CREATE POLICY "Owners manage goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

COMMENT ON COLUMN public.liabilities.outstanding IS
  'Saldo devedor atual informado (não recalculado): o contrato/extrato é a verdade.';
COMMENT ON COLUMN public.goals.expected_return IS
  'Retorno anual esperado da carteira que financia a meta. Base do aporte mensal necessário.';