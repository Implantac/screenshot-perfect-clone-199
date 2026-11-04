DO $$ BEGIN
  CREATE TYPE public.asset_class AS ENUM (
    'caixa', 'renda_fixa', 'renda_variavel', 'fundos',
    'imoveis', 'internacional', 'alternativos', 'cripto'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.asset_liquidity AS ENUM ('d0', 'd1', 'd30', 'longo_prazo', 'iliquido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.flow_kind AS ENUM ('aporte', 'resgate', 'provento', 'taxa', 'imposto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.account_kind AS ENUM ('corretora', 'banco', 'fundo', 'previdencia', 'cripto', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.custodians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  country TEXT DEFAULT 'BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custodians_name ON public.custodians (lower(name));

ALTER TABLE public.custodians ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.custodians TO authenticated;
GRANT ALL ON public.custodians TO service_role;
REVOKE ALL ON public.custodians FROM anon;

DROP POLICY IF EXISTS "Authenticated read custodians" ON public.custodians;
CREATE POLICY "Authenticated read custodians" ON public.custodians
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  custodian_id UUID REFERENCES public.custodians(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind public.account_kind NOT NULL DEFAULT 'corretora',
  currency TEXT NOT NULL DEFAULT 'BRL',
  account_number TEXT,
  opened_at DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_entity ON public.accounts(entity_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
REVOKE ALL ON public.accounts FROM anon;

DROP POLICY IF EXISTS "Owners manage accounts" ON public.accounts;
CREATE POLICY "Owners manage accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  asset_class public.asset_class NOT NULL DEFAULT 'renda_fixa',
  liquidity public.asset_liquidity NOT NULL DEFAULT 'd1',
  symbol TEXT,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  as_of DATE NOT NULL DEFAULT CURRENT_DATE,
  is_offshore BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positions_entity ON public.positions(entity_id);
CREATE INDEX IF NOT EXISTS idx_positions_account ON public.positions(account_id);
CREATE INDEX IF NOT EXISTS idx_positions_class ON public.positions(asset_class);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
REVOKE ALL ON public.positions FROM anon;

DROP POLICY IF EXISTS "Owners manage positions" ON public.positions;
CREATE POLICY "Owners manage positions" ON public.positions
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.cash_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  kind public.flow_kind NOT NULL DEFAULT 'aporte',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  flow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_flows_entity ON public.cash_flows(entity_id);
CREATE INDEX IF NOT EXISTS idx_cash_flows_date ON public.cash_flows(flow_date);

ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flows TO authenticated;
GRANT ALL ON public.cash_flows TO service_role;
REVOKE ALL ON public.cash_flows FROM anon;

DROP POLICY IF EXISTS "Owners manage cash flows" ON public.cash_flows;
CREATE POLICY "Owners manage cash flows" ON public.cash_flows
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  as_of DATE NOT NULL,
  market_value NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL DEFAULT 0,
  net_flow NUMERIC NOT NULL DEFAULT 0,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_entity_date
  ON public.portfolio_snapshots (entity_id, as_of);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_snapshots TO authenticated;
GRANT ALL ON public.portfolio_snapshots TO service_role;
REVOKE ALL ON public.portfolio_snapshots FROM anon;

DROP POLICY IF EXISTS "Owners manage snapshots" ON public.portfolio_snapshots;
CREATE POLICY "Owners manage snapshots" ON public.portfolio_snapshots
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

CREATE TABLE IF NOT EXISTS public.tax_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL DEFAULT 'PR',
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_scenarios_entity ON public.tax_scenarios(entity_id);

ALTER TABLE public.tax_scenarios ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_scenarios TO authenticated;
GRANT ALL ON public.tax_scenarios TO service_role;
REVOKE ALL ON public.tax_scenarios FROM anon;

DROP POLICY IF EXISTS "Owners manage tax scenarios" ON public.tax_scenarios;
CREATE POLICY "Owners manage tax scenarios" ON public.tax_scenarios
  FOR ALL TO authenticated
  USING (
    (entity_id IS NOT NULL AND public.owns_entity(entity_id))
    OR (entity_id IS NULL AND created_by = auth.uid())
  )
  WITH CHECK (
    (entity_id IS NOT NULL AND public.owns_entity(entity_id))
    OR (entity_id IS NULL AND created_by = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_tax_scenarios_created_by ON public.tax_scenarios(created_by);

DROP TRIGGER IF EXISTS trg_custodians_updated_at ON public.custodians;
CREATE TRIGGER trg_custodians_updated_at BEFORE UPDATE ON public.custodians
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_positions_updated_at ON public.positions;
CREATE TRIGGER trg_positions_updated_at BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_tax_scenarios_updated_at ON public.tax_scenarios;
CREATE TRIGGER trg_tax_scenarios_updated_at BEFORE UPDATE ON public.tax_scenarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_positions_audit ON public.positions;
CREATE TRIGGER trg_positions_audit AFTER INSERT OR UPDATE OR DELETE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_accounts_audit ON public.accounts;
CREATE TRIGGER trg_accounts_audit AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

INSERT INTO public.custodians (name, code, country) VALUES
  ('XP Investimentos', 'XP', 'BR'),
  ('BTG Pactual', 'BTG', 'BR'),
  ('Itaú Private Bank', 'ITAU', 'BR'),
  ('B3', 'B3', 'BR'),
  ('Interactive Brokers', 'IBKR', 'US'),
  ('Vínculo Direto (imóvel/participação)', 'DIRECT', 'BR')
ON CONFLICT (lower(name)) DO NOTHING;