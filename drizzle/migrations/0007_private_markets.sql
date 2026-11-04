DO $$ BEGIN
  CREATE TYPE public.private_strategy AS ENUM (
    'private_equity', 'venture_capital', 'infraestrutura',
    'real_estate', 'agro', 'credito_privado', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capital_event_kind AS ENUM ('call', 'distribution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.capital_event_status AS ENUM ('previsto', 'pago', 'atrasado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager TEXT,
  strategy public.private_strategy NOT NULL DEFAULT 'private_equity',
  committed NUMERIC NOT NULL CHECK (committed >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  vintage INTEGER,
  closed_at DATE,
  term_years NUMERIC,
  nav NUMERIC NOT NULL DEFAULT 0,
  nav_as_of DATE,
  notice_days INTEGER DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commitments_entity ON public.commitments(entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commitments_entity_name
  ON public.commitments (entity_id, lower(name));

ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
REVOKE ALL ON public.commitments FROM anon;

DROP POLICY IF EXISTS "Owners manage commitments" ON public.commitments;
CREATE POLICY "Owners manage commitments" ON public.commitments
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.commitments(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  kind public.capital_event_kind NOT NULL,
  due_date DATE NOT NULL,
  paid_at DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status public.capital_event_status NOT NULL DEFAULT 'previsto',
  notice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_events_commitment ON public.capital_events(commitment_id);
CREATE INDEX IF NOT EXISTS idx_capital_events_entity ON public.capital_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_capital_events_due ON public.capital_events(due_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_capital_events_dedupe
  ON public.capital_events (commitment_id, kind, due_date, amount);

ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capital_events TO authenticated;
GRANT ALL ON public.capital_events TO service_role;
REVOKE ALL ON public.capital_events FROM anon;

DROP POLICY IF EXISTS "Owners manage capital events" ON public.capital_events;
CREATE POLICY "Owners manage capital events" ON public.capital_events
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

COMMENT ON COLUMN public.commitments.notice_days IS
  'Dias de antecedência com que o gestor avisa a chamada. Base do alerta "capital call chegando".';