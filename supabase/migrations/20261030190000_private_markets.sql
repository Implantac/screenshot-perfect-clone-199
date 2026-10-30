-- =============================================================================
-- Privados: compromissos, capital calls e distribuições (wave 10)
-- =============================================================================
-- Por que existe
-- --------------
-- Fundo fechado (PE, VC, infra, agro, real estate) não é posição: é **promessa**.
-- A família assina R$ 50 milhões e o gestor chama esse capital ao longo de 5 anos.
-- O número que importa todo dia não é o saldo: é o **capital não integralizado**
-- (unfunded), porque é ele que vai virar saída de caixa com prazo curto — muitas
-- vezes com 10 dias de aviso.
--
-- Modelo:
--   commitments    → o compromisso (veículo, gestor, estratégia, valor assinado)
--   capital_events → cada chamada (call) e cada devolução (distribution)
--
-- Separação deliberada: `committed` fica no compromisso (não muda), o realizado
-- é sempre derivado dos eventos. Assim nenhum número é gravado duas vezes e não
-- existe o clássico "o saldo não bate com a soma dos lançamentos".
-- =============================================================================

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

-- -------------------------------------------------------------- commitments
CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  /** Nome do veículo, como aparece no contrato. */
  name TEXT NOT NULL,
  manager TEXT,
  strategy public.private_strategy NOT NULL DEFAULT 'private_equity',
  /** Capital assinado (comprometido). */
  committed NUMERIC NOT NULL CHECK (committed >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  /** Safra (ano do closing) — usada para agrupar vintage. */
  vintage INTEGER,
  closed_at DATE,
  /** Prazo do fundo em anos, para estimar o ritmo de chamada. */
  term_years NUMERIC,
  /** Valor justo atual informado pelo gestor (NAV), base do TVPI. */
  nav NUMERIC NOT NULL DEFAULT 0,
  nav_as_of DATE,
  /** DIAS DE AVISO típicos do gestor: alimenta o alerta de capital call. */
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

-- ------------------------------------------------------------ capital events
CREATE TABLE IF NOT EXISTS public.capital_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id UUID NOT NULL REFERENCES public.commitments(id) ON DELETE CASCADE,
  /** Denormalizado para a policy ser uma condição só (sem JOIN em RLS). */
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  kind public.capital_event_kind NOT NULL,
  /** Data de vencimento/crédito informada pelo gestor. */
  due_date DATE NOT NULL,
  /** Data em que o dinheiro efetivamente se moveu. */
  paid_at DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status public.capital_event_status NOT NULL DEFAULT 'previsto',
  /** Número do aviso/notificação do gestor, para conciliar com e-mail. */
  notice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_events_commitment ON public.capital_events(commitment_id);
CREATE INDEX IF NOT EXISTS idx_capital_events_entity ON public.capital_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_capital_events_due ON public.capital_events(due_date);
-- Um aviso do gestor não entra duas vezes (mesmo veículo, mesmo tipo, mesmo dia, mesmo valor).
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
