-- =============================================================================
-- APLICAR-TUDO — waves 4 a 26 do PATRIUM OS
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- É idempotente (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS / DO $$ ... EXCEPTION),
-- então rodar de novo não quebra nada.
--
-- Depois de rodar, confirme com:  bun run check:schema
-- =============================================================================



-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030120000_audit_trail.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Trilha de auditoria real + índices de leitura
--
-- Até aqui a tabela `audit_logs` existia, tinha RLS e grant de SELECT para admin,
-- mas NADA escrevia nela: a "trilha de auditoria" prometida pela landing não existia.
-- Esta migração cria o trigger genérico que registra INSERT/UPDATE/DELETE nas
-- tabelas sensíveis, com o autor (auth.uid()) e o diff old/new em JSONB.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := (to_jsonb(OLD) ->> 'id')::uuid;
  ELSE
    v_record_id := (to_jsonb(NEW) ->> 'id')::uuid;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Só o owner das tabelas / service_role precisa executar a função.
REVOKE EXECUTE ON FUNCTION public.record_audit_log() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_entities ON public.entities;
CREATE TRIGGER audit_entities
  AFTER INSERT OR UPDATE OR DELETE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_assets ON public.assets;
CREATE TRIGGER audit_assets
  AFTER INSERT OR UPDATE OR DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_documents ON public.documents;
CREATE TRIGGER audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_risks ON public.risks;
CREATE TRIGGER audit_risks
  AFTER INSERT OR UPDATE OR DELETE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_transactions ON public.transactions;
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_jarvis_insights ON public.jarvis_insights;
CREATE TRIGGER audit_jarvis_insights
  AFTER INSERT OR UPDATE OR DELETE ON public.jarvis_insights
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- Índices de leitura usados pelas telas de risco/documento/auditoria
CREATE INDEX IF NOT EXISTS idx_risks_due_date ON public.risks(due_date);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_assets_entity ON public.assets(entity_id);
CREATE INDEX IF NOT EXISTS idx_jarvis_insights_entity ON public.jarvis_insights(entity_id);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030130000_tenant_scoped_uniques.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Unicidade por tenant (bug de multi-tenancy)
--
-- A migração inicial criou `tax_id UNIQUE` em entities e `email`/`tax_id UNIQUE`
-- em members. Como o RLS é por linha (owner_user_id), essas constraints globais
-- quebram o produto de duas formas:
--
--   1. um tenant NÃO consegue cadastrar um CNPJ que outro tenant já cadastrou
--      (ex.: duas consultorias atendendo o mesmo grupo familiar);
--   2. o erro 23505 funciona como oráculo de existência: "CNPJ já cadastrado"
--      revela informação de OUTRO tenant para quem não tem acesso a ela.
--
-- Correção: trocar as constraints globais por índices únicos compostos
-- (owner_user_id, <coluna>), ignorando NULLs.
-- =============================================================================

-- entities.tax_id
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_tax_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS entities_owner_tax_id_key
  ON public.entities (owner_user_id, tax_id)
  WHERE tax_id IS NOT NULL;

-- members.email / members.tax_id
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_email_key;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_tax_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS members_owner_email_key
  ON public.members (owner_user_id, email)
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_owner_tax_id_key
  ON public.members (owner_user_id, tax_id)
  WHERE tax_id IS NOT NULL;

-- Varredura defensiva: se o projeto tiver constraints únicas globais com nomes
-- diferentes dos padrão do Postgres, remove mesmo assim.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND c.contype = 'u'
      AND t.relname IN ('entities', 'members')
      AND a.attname IN ('tax_id', 'email')
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.relname, r.conname);
    RAISE NOTICE 'Removida constraint única global %.%', r.relname, r.conname;
  END LOOP;
END $$;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030140000_operations_tables.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Tabelas operacionais: fornecedores e processos jurídicos
-- + auditoria legível pelo próprio dono do dado
--
-- Até aqui, /fornecedores e /legal eram telas 100% decorativas (arrays fixos no
-- JSX). Estas tabelas dão lastro real aos dois módulos, seguindo o mesmo padrão de
-- multi-tenancy do resto do schema: o acesso herda de `entities.owner_user_id`
-- via `owns_entity(entity_id)`.
-- =============================================================================

-- ---------------------------------------------------------------- fornecedores
CREATE TYPE public.supplier_status AS ENUM ('homologado', 'em_analise', 'risco_critico', 'inativo');

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tax_id TEXT,
  category TEXT,                       -- Serviços, Insumos, Jurídico, TI, Obras…
  contact_email TEXT,
  contact_phone TEXT,
  status public.supplier_status NOT NULL DEFAULT 'em_analise',
  compliance_score NUMERIC DEFAULT 100 CHECK (compliance_score >= 0 AND compliance_score <= 100),
  contract_value NUMERIC DEFAULT 0,
  contract_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_entity ON public.suppliers(entity_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
REVOKE ALL ON public.suppliers FROM anon;

DROP POLICY IF EXISTS "Owners manage suppliers" ON public.suppliers;
CREATE POLICY "Owners manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_suppliers ON public.suppliers;
CREATE TRIGGER set_updated_at_suppliers BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------- processos legais
CREATE TYPE public.legal_case_status AS ENUM ('em_andamento', 'suspenso', 'acordo', 'encerrado');
CREATE TYPE public.legal_case_type AS ENUM ('civel', 'tributario', 'ambiental', 'trabalhista', 'societario', 'imobiliario');

CREATE TABLE IF NOT EXISTS public.legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  type public.legal_case_type NOT NULL DEFAULT 'civel',
  status public.legal_case_status NOT NULL DEFAULT 'em_andamento',
  court TEXT,                          -- Vara / órgão
  risk_level public.risk_severity NOT NULL DEFAULT 'medium',
  value_at_stake NUMERIC DEFAULT 0,
  next_hearing TIMESTAMPTZ,
  responsible_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_cases_entity ON public.legal_cases(entity_id);
CREATE INDEX IF NOT EXISTS idx_legal_cases_status ON public.legal_cases(status);
CREATE INDEX IF NOT EXISTS idx_legal_cases_hearing ON public.legal_cases(next_hearing);

ALTER TABLE public.legal_cases ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_cases TO authenticated;
GRANT ALL ON public.legal_cases TO service_role;
REVOKE ALL ON public.legal_cases FROM anon;

DROP POLICY IF EXISTS "Owners manage legal cases" ON public.legal_cases;
CREATE POLICY "Owners manage legal cases" ON public.legal_cases
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_legal_cases ON public.legal_cases;
CREATE TRIGGER set_updated_at_legal_cases BEFORE UPDATE ON public.legal_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================================
-- Auditoria: o dono do dado pode ler a própria trilha
--
-- A policy anterior liberava SELECT apenas para `admin`, então a tela
-- /jarvis/historico não tinha como mostrar nada para o usuário comum. Agora cada
-- evento carrega o `owner_user_id` resolvido no momento da escrita e o dono lê o
-- que é dele. Admin continua vendo tudo.
-- =============================================================================
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS owner_user_id UUID;

CREATE OR REPLACE FUNCTION public.audit_owner_for(
  p_table TEXT,
  p_row JSONB
) RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity UUID;
BEGIN
  IF p_table IN ('entities', 'members') THEN
    RETURN (p_row ->> 'owner_user_id')::uuid;
  END IF;

  v_entity := (p_row ->> 'entity_id')::uuid;
  IF v_entity IS NOT NULL THEN
    RETURN (SELECT owner_user_id FROM public.entities WHERE id = v_entity);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_owner_for(text, jsonb) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row jsonb;
  v_record_id uuid;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_record_id := (v_row ->> 'id')::uuid;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data, owner_user_id)
  VALUES (
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    public.audit_owner_for(TG_TABLE_NAME, v_row)
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Preenche o dono nos eventos já existentes (best effort) e passa a manter o índice.
UPDATE public.audit_logs l
SET owner_user_id = public.audit_owner_for(l.table_name, COALESCE(l.new_data, l.old_data))
WHERE l.owner_user_id IS NULL AND COALESCE(l.new_data, l.old_data) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_owner ON public.audit_logs(owner_user_id, created_at DESC);

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners read their audit logs" ON public.audit_logs;
CREATE POLICY "Owners read their audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Auditoria das duas novas tabelas
DROP TRIGGER IF EXISTS audit_suppliers ON public.suppliers;
CREATE TRIGGER audit_suppliers
  AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_legal_cases ON public.legal_cases;
CREATE TRIGGER audit_legal_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.legal_cases
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS audit_members ON public.members;
CREATE TRIGGER audit_members
  AFTER INSERT OR UPDATE OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030150000_wealth_core.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Núcleo de riqueza: custódia, posições, fluxos e cenários sucessórios
--
-- Por que esta migration existe
-- -----------------------------
-- Até aqui o PATRIUM OS conhecia *imóveis e ativos registrais* (tabela `assets`),
-- mas não conhecia *posições financeiras* — que é o núcleo de qualquer plataforma
-- de family office (Smartbrain, GoFunds, Masttro, Addepar). Sem posição por
-- custodiante não há alocação, não há TWR/MWR e não há conciliação.
--
-- Modelo (4 níveis):
--   custodians ─┐
--   accounts ───┼─→ positions      (o que a família tem, onde e quanto vale)
--   cash_flows ─┘                  (aportes/resgates/proventos → base do MWR)
--   portfolio_snapshots            (série mensal → base do TWR e do drawdown)
--   tax_scenarios                  (simulações sucessórias/tributárias)
--
-- Multi-tenancy: tudo herda de `entities.owner_user_id` via `owns_entity()`,
-- igual ao resto do schema. `positions` carrega `entity_id` denormalizado para
-- que a policy seja uma só condição (sem JOIN em RLS, que é caro).
-- =============================================================================

-- ------------------------------------------------------------------- enums
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

-- -------------------------------------------------------------- custodians
-- Instituições (B3, Itaú Private, XP, BTG, Interactive Brokers…). Globais por
-- desenho: não carregam dado de cliente, só o cadastro da contraparte.
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

-- Catálogo de instituições é leitura para qualquer usuário autenticado;
-- escrita apenas por service_role (seed/admin).
DROP POLICY IF EXISTS "Authenticated read custodians" ON public.custodians;
CREATE POLICY "Authenticated read custodians" ON public.custodians
  FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------- accounts
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

-- ----------------------------------------------------------------- positions
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
  -- Custo de aquisição total (não unitário): base do ganho não realizado.
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

-- --------------------------------------------------------------- cash_flows
-- Aportes e resgates são o que permite separar *retorno* de *dinheiro novo*.
-- Sem eles, qualquer cálculo de rentabilidade é mentira.
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

-- -------------------------------------------------------- portfolio_snapshots
-- Um ponto por mês (ou por data de fechamento) com o valor consolidado.
-- É a série que alimenta TWR, drawdown e evolução patrimonial.
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  as_of DATE NOT NULL,
  market_value NUMERIC NOT NULL DEFAULT 0,
  cost_basis NUMERIC NOT NULL DEFAULT 0,
  net_flow NUMERIC NOT NULL DEFAULT 0,   -- aportes - resgates no período
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

-- ------------------------------------------------------------- tax_scenarios
-- Simulação sucessória/tributária (o diferencial da Finvity, trazido para cá).
-- Guardamos premissas e resultado em JSONB: o cálculo é determinístico e pode
-- ser reexecutado, mas congelar o snapshot é o que permite comparar cenários.
CREATE TABLE IF NOT EXISTS public.tax_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL DEFAULT 'PR',  -- UF define a alíquota de ITCMD
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

-- Cenário sem entidade (simulação do grupo inteiro) é do usuário dono.
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

-- --------------------------------------------------------------- triggers
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

-- Auditoria: posições e contas mudam valor e dono — precisa de trilha.
DROP TRIGGER IF EXISTS trg_positions_audit ON public.positions;
CREATE TRIGGER trg_positions_audit AFTER INSERT OR UPDATE OR DELETE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_accounts_audit ON public.accounts;
CREATE TRIGGER trg_accounts_audit AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- ------------------------------------------------------------------- seed
INSERT INTO public.custodians (name, code, country) VALUES
  ('XP Investimentos', 'XP', 'BR'),
  ('BTG Pactual', 'BTG', 'BR'),
  ('Itaú Private Bank', 'ITAU', 'BR'),
  ('B3', 'B3', 'BR'),
  ('Interactive Brokers', 'IBKR', 'US'),
  ('Vínculo Direto (imóvel/participação)', 'DIRECT', 'BR')
ON CONFLICT (lower(name)) DO NOTHING;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030160000_imports.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030170000_quotes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030180000_fund_quotes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Cota de fundos pela CVM (wave 7)
-- =============================================================================
-- Fundo de investimento aberto não tem ticker: a identidade é o CNPJ, e a cota
-- do dia vem do Informe Diário da CVM (`inf_diario_fi_YYYYMM.zip`).
--
-- Optamos por uma coluna própria (`instrument_id`) em vez de sobrecarregar
-- `symbol`:
--   symbol        → "FIM-MULTI" (rótulo do gestor, aparece na tela)
--   instrument_id → "12345678000190" (CNPJ, chave da cotação)
-- Assim um fundo pode ser renomeado sem perder a série de cotas — e um papel da
-- B3 continua usando `symbol` normalmente.
-- =============================================================================

ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS instrument_id TEXT;

COMMENT ON COLUMN public.positions.instrument_id IS
  'Identificador externo do instrumento: CNPJ (14 dígitos) para fundos de investimento.';

CREATE INDEX IF NOT EXISTS idx_positions_instrument ON public.positions (instrument_id)
  WHERE instrument_id IS NOT NULL;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030190000_private_markets.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030200000_balance_sheet.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Balanço patrimonial: passivos e metas (wave 11)
-- =============================================================================
-- Por que existe
-- --------------
-- Até aqui o PATRIUM só mostrava um lado do balanço. Patrimônio líquido é
-- ativo − passivo, e family office decide com os dois: dívida barata alavancando
-- fazenda é estratégia; dívida cara em cartão é sangria. Sem passivo, a
-- "alocação" esconde metade da verdade.
--
-- Duas tabelas:
--   liabilities → o que se deve (saldo devedor, taxa, prazo, garantia)
--   goals       → para onde o patrimônio deveria caminhar (valor, prazo, prioridade)
--
-- `outstanding` é o saldo devedor de hoje, informado — não recalculado a partir
-- de amortização, porque o banco pode ter repactuado e o extrato é a verdade.
-- O serviço da dívida (prestação) é derivado no app a partir de saldo/taxa/prazo.
-- =============================================================================

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

-- --------------------------------------------------------------- liabilities
CREATE TABLE IF NOT EXISTS public.liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.liability_kind NOT NULL DEFAULT 'emprestimo',
  creditor TEXT,
  /** Valor original contratado. */
  principal NUMERIC NOT NULL DEFAULT 0,
  /** Saldo devedor hoje (a verdade do extrato/contrato). */
  outstanding NUMERIC NOT NULL DEFAULT 0 CHECK (outstanding >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL',
  /** Taxa efetiva anual (%). 0 = sem juros (ex.: mútuo familiar). */
  rate_annual NUMERIC NOT NULL DEFAULT 0,
  amortization public.amortization_kind NOT NULL DEFAULT 'price',
  term_months INTEGER,
  start_date DATE,
  /** Vencimento final ou da parcela em atraso. */
  due_date DATE,
  /** Garantia (imóvel, safra, aval). Texto livre: quem lê é o operador. */
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

-- -------------------------------------------------------------------- goals
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind public.goal_kind NOT NULL DEFAULT 'meta_patrimonial',
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  /** Já separado/aportado para essa meta. */
  allocated NUMERIC NOT NULL DEFAULT 0 CHECK (allocated >= 0),
  target_date DATE NOT NULL,
  priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  /** Retorno esperado da carteira que financia a meta (% a.a.). */
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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030210000_portal_access.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Portal do cliente: permissão granular por pessoa (wave 14)
-- =============================================================================
-- Por que existe
-- --------------
-- O PATRIUM guarda o patrimônio de uma família, não de uma pessoa. Quem entra
-- para ler quase nunca deve ver tudo:
--
--   · o herdeiro vê o consolidado e a política, mas não a dívida de cada
--     operação nem o contencioso do irmão;
--   · o contador vê fluxo, passivo e documento fiscal, mas não precisa ver o
--     imóvel da praia;
--   · o sócio minoritário vê a fatia dele, não o balanço da holding inteira;
--   · o gestor externo vê posição e retorno, não vê sucessão nem dados pessoais.
--
-- A regra deste desenho: **negar por padrão, conceder por seção**. O grant nasce
-- com o pacote da persona (`portal_role`) e guarda explicitamente as seções
-- liberadas — de modo que mudar o pacote no código no futuro não amplie acesso
-- de ninguém que já existe (o que já foi concedido está gravado em `sections`).
--
-- Duas salvaguardas que não são "acessório":
--   1. `visibility` controla o grão do número: `completo` (R$ 63.386.946),
--      `resumido` (R$ 63,4 mi) ou `faixas` (R$ 60–70 mi). Herdeiro não precisa
--      do centavo; o faixa evita que um print vire informação de mercado.
--   2. `expires_at` + `require_mfa`: acesso de terceiro tem prazo e segundo
--      fator. Sem prazo, todo convite é permanente por acidente.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.portal_role AS ENUM (
    'titular',        -- o dono: vê tudo
    'conjuge',        -- regime de bens: vê o consolidado
    'herdeiro',       -- consolidado e política, sem dívida detalhada
    'socio',          -- visão da participação societária
    'gestor',         -- posição e retorno, sem sucessão/dados pessoais
    'contador',       -- financeiro, passivo e documentos fiscais
    'auditor'         -- leitura ampla, sem documentos pessoais
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_visibility AS ENUM ('completo', 'resumido', 'faixas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.portal_status AS ENUM ('convite_pendente', 'ativo', 'suspenso', 'revogado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- portal_grants
CREATE TABLE IF NOT EXISTS public.portal_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  -- Vínculo opcional com o cadastro de membros da família: quem já é sócio
  -- cadastrado não precisa ser redigitado.
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.portal_role NOT NULL DEFAULT 'herdeiro',
  /** Seções liberadas. Lista explícita: negar por padrão, conceder por seção. */
  sections TEXT[] NOT NULL DEFAULT ARRAY['resumo', 'alocacao']::TEXT[],
  visibility public.portal_visibility NOT NULL DEFAULT 'resumido',
  status public.portal_status NOT NULL DEFAULT 'convite_pendente',
  /** Exportar PDF é permissão separada: baixar é vazar. */
  can_export BOOLEAN NOT NULL DEFAULT false,
  can_see_liabilities BOOLEAN NOT NULL DEFAULT false,
  can_see_documents BOOLEAN NOT NULL DEFAULT false,
  require_mfa BOOLEAN NOT NULL DEFAULT true,
  /** Acesso de terceiro tem prazo; NULL só é aceitável para o titular. */
  expires_at DATE,
  invited_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT portal_grants_email_shape CHECK (position('@' in email) > 1),
  CONSTRAINT portal_grants_sections_not_empty CHECK (cardinality(sections) > 0)
);

-- Um e-mail só pode ter um grant por entidade (reconvidar = atualizar).
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_grants_entity_email
  ON public.portal_grants (entity_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_portal_grants_entity ON public.portal_grants(entity_id);
CREATE INDEX IF NOT EXISTS idx_portal_grants_status ON public.portal_grants(status);
CREATE INDEX IF NOT EXISTS idx_portal_grants_expiry ON public.portal_grants(expires_at)
  WHERE expires_at IS NOT NULL;

ALTER TABLE public.portal_grants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_grants TO authenticated;
GRANT ALL ON public.portal_grants TO service_role;
REVOKE ALL ON public.portal_grants FROM anon;

-- Dono da entidade administra os convites.
DROP POLICY IF EXISTS "Owners manage portal grants" ON public.portal_grants;
CREATE POLICY "Owners manage portal grants" ON public.portal_grants
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

-- O convidado lê o próprio grant (é o que a tela do portal usa para saber o que
-- pode mostrar). Ele nunca lê o grant de outra pessoa.
DROP POLICY IF EXISTS "Grantee reads own portal grant" ON public.portal_grants;
CREATE POLICY "Grantee reads own portal grant" ON public.portal_grants
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'ativo'
  );

-- `status` muda sozinho quando o prazo passa: um grant vencido não pode
-- continuar "ativo" só porque ninguém abriu a tela.
CREATE OR REPLACE FUNCTION public.expire_portal_grants()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.portal_grants
     SET status = 'revogado', updated_at = now()
   WHERE status IN ('ativo', 'convite_pendente')
     AND expires_at IS NOT NULL
     AND expires_at < current_date;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;

GRANT EXECUTE ON FUNCTION public.expire_portal_grants() TO authenticated;

-- Marca o primeiro acesso (o "convite pendente" vira "ativo" quando a pessoa
-- realmente entra, e não quando o convite é enviado).
CREATE OR REPLACE FUNCTION public.touch_portal_access(_grant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.portal_grants
     SET last_access_at = now(),
         status = CASE WHEN status = 'convite_pendente' THEN 'ativo'::public.portal_status ELSE status END,
         updated_at = now()
   WHERE id = _grant_id
     AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
END $$;

GRANT EXECUTE ON FUNCTION public.touch_portal_access(uuid) TO authenticated;

COMMENT ON TABLE public.portal_grants IS
  'Permissão de leitura por pessoa (sócio, herdeiro, contador, gestor). Negar por padrão; conceder por seção.';
COMMENT ON COLUMN public.portal_grants.sections IS
  'Seções liberadas explicitamente. Mudar o pacote da persona no app não amplia acesso existente.';
COMMENT ON COLUMN public.portal_grants.visibility IS
  'Grão do número: completo (centavo), resumido (milhão) ou faixas (banda).';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030220000_auth_security.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Segurança de acesso: política, MFA e trava de sessão (wave 17)
-- =============================================================================
-- Por que existe
-- --------------
-- A wave 14 gravou `require_mfa` em cada convite do portal e NADA exigia MFA de
-- fato. Promessa no banco sem controle no acesso é pior do que não prometer:
-- cria confiança sem lastro — e é exatamente o que uma due diligence derruba em
-- cinco minutos de conversa.
--
-- Esta migração coloca o controle onde ele não pode ser contornado pelo cliente:
--
--   1. `security_policies` — a régua do tenant (senha, MFA, sessão), uma linha.
--   2. `public.mfa_satisfied()` — verdadeiro quando a sessão está em `aal2`
--      (segundo fator usado) **ou** quando a política dispensa MFA.
--   3. RLS com dentes: escrita em `portal_grants` e leitura de dado sensível
--      passam a exigir `mfa_satisfied()`. Não é o app que decide — é o banco.
--
-- Limite conhecido e declarado: o Supabase Auth (GoTrue) em projeto gerenciado
-- não aceita política de senha customizada. A política de senha é aplicada no
-- app antes de chamar `signUp`/`updateUser`, e o mínimo de 6 caracteres do
-- projeto é o piso que o banco garante.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.mfa_scope AS ENUM ('admin', 'portal', 'todos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- --------------------------------------------------------- security_policies
CREATE TABLE IF NOT EXISTS public.security_policies (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  mfa_required_admin BOOLEAN NOT NULL DEFAULT true,
  mfa_required_portal BOOLEAN NOT NULL DEFAULT true,
  mfa_grace_days INTEGER NOT NULL DEFAULT 7 CHECK (mfa_grace_days >= 0 AND mfa_grace_days <= 90),
  min_password_length INTEGER NOT NULL DEFAULT 12 CHECK (min_password_length >= 6 AND min_password_length <= 72),
  require_mixed_case BOOLEAN NOT NULL DEFAULT true,
  require_number BOOLEAN NOT NULL DEFAULT true,
  require_symbol BOOLEAN NOT NULL DEFAULT true,
  block_common_passwords BOOLEAN NOT NULL DEFAULT true,
  password_history INTEGER NOT NULL DEFAULT 5 CHECK (password_history >= 0 AND password_history <= 24),
  max_failed_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_failed_attempts >= 3 AND max_failed_attempts <= 20),
  session_timeout_minutes INTEGER NOT NULL DEFAULT 480 CHECK (session_timeout_minutes >= 15 AND session_timeout_minutes <= 10080),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT security_policies_singleton CHECK (id)
);

INSERT INTO public.security_policies (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.security_policies TO authenticated;
GRANT INSERT, UPDATE ON public.security_policies TO authenticated;
GRANT ALL ON public.security_policies TO service_role;
REVOKE ALL ON public.security_policies FROM anon;

-- Leitura: qualquer usuário autenticado (o formulário de senha precisa da régua).
DROP POLICY IF EXISTS "Authenticated read security policy" ON public.security_policies;
CREATE POLICY "Authenticated read security policy" ON public.security_policies
  FOR SELECT TO authenticated USING (true);

-- Escrita: só admin do tenant.
DROP POLICY IF EXISTS "Admins update security policy" ON public.security_policies;
CREATE POLICY "Admins update security policy" ON public.security_policies
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------- MFA: estado da sessão
/**
 * Verdadeiro quando o segundo fator está satisfeito para a sessão atual.
 *
 * `aal` (authenticator assurance level) vem no JWT: `aal1` = só senha,
 * `aal2` = senha + fator verificado nesta sessão. A distinção importa: ter fator
 * cadastrado e não tê-lo usado é diferente de não ter fator.
 */
CREATE OR REPLACE FUNCTION public.session_is_elevated()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

CREATE OR REPLACE FUNCTION public.mfa_satisfied(_scope public.mfa_scope DEFAULT 'admin')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  policy_record public.security_policies%ROWTYPE;
  required boolean;
BEGIN
  SELECT * INTO policy_record FROM public.security_policies WHERE id = true;
  IF NOT FOUND THEN
    RETURN true; -- sem política gravada, não se bloqueia ninguém
  END IF;

  required := CASE _scope
    WHEN 'admin' THEN policy_record.mfa_required_admin
    WHEN 'portal' THEN policy_record.mfa_required_portal
    ELSE policy_record.mfa_required_admin OR policy_record.mfa_required_portal
  END;

  IF NOT required THEN
    RETURN true;
  END IF;

  RETURN public.session_is_elevated();
END $$;

GRANT EXECUTE ON FUNCTION public.mfa_satisfied(public.mfa_scope) TO authenticated;

/**
 * Lista dos fatores do próprio usuário, para a tela de segurança não depender de
 * vazar `auth.mfa_factors` para o cliente.
 */
CREATE OR REPLACE FUNCTION public.my_mfa_factors()
RETURNS TABLE (id uuid, friendly_name text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT f.id, f.friendly_name, f.status, f.created_at
    FROM auth.mfa_factors f
   WHERE f.user_id = auth.uid()
     AND f.status = 'verified'
$$;

GRANT EXECUTE ON FUNCTION public.my_mfa_factors() TO authenticated;

-- --------------------------------------------- RLS com dentes: portal exige MFA
-- Escrever convite de acesso é operação de nível administrador: exige segundo
-- fator quando a política pede. Reaplica a policy de dono com a trava junto.
DROP POLICY IF EXISTS "Owners manage portal grants" ON public.portal_grants;
CREATE POLICY "Owners manage portal grants" ON public.portal_grants
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id) AND public.mfa_satisfied('admin'))
  WITH CHECK (public.owns_entity(entity_id) AND public.mfa_satisfied('admin'));

-- O convidado lê o próprio grant; com MFA exigido no portal, só em sessão elevada.
DROP POLICY IF EXISTS "Grantee reads own portal grant" ON public.portal_grants;
CREATE POLICY "Grantee reads own portal grant" ON public.portal_grants
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'ativo'
    AND public.mfa_satisfied('portal')
  );

COMMENT ON TABLE public.security_policies IS
  'Régua única de senha, MFA e sessão do tenant. Aplicada no app e no RLS.';
COMMENT ON FUNCTION public.mfa_satisfied(public.mfa_scope) IS
  'Trava de sessão: exige aal2 quando a política do escopo pede MFA.';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030230000_legal_provisions.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Contencioso como passivo: probabilidade, provisão e risco esperado (wave 18)
-- =============================================================================
-- Por que existe
-- --------------
-- A tabela `legal_cases` guardava o processo e o `value_at_stake` — o valor da
-- causa. Só que valor da causa não é passivo: R$ 68 milhões de inventário em
-- andamento não é dívida de R$ 68 milhões, e ação de cobrança com 10% de chance
-- de perder também não. Sem probabilidade, o contencioso nunca entra no balanço
-- e o PL do produto fica otimista por omissão.
--
-- O que a wave 18 acrescenta:
--   · `polarity`   — ré (passivo), autora (ativo contingente) ou processo sem
--                    contingência financeira (inventário, regularização);
--   · `probability`— percentual informado pelo jurídico; nulo = usa a heurística
--                    de risco × fase no app (e o relatório diz que usou);
--   · `phase`      — fase processual, que move a probabilidade;
--   · `expected_settlement` — quando o dinheiro deve sair, para trazer a
--                    provisão a valor presente (CPC 25, §46).
--
-- E uma tabela de lançamentos, `legal_provision_entries`, que é o que permite o
-- rollforward (saldo inicial + constituições + atualização − reversões − baixas).
-- Sem subledger, "provisão" é um número que aparece por mágica a cada relatório
-- e ninguém consegue explicar a variação para o auditor.
--
-- A conta é sempre derivada, nunca digitada: `provision_recognized` é uma coluna
-- GERADA que aplica a régua (passivo provável) sobre os dados do processo. O valor
-- em reais vem do motor (`src/lib/legal/provision.ts`) e o saldo escriturado, do
-- subledger — nenhum dos dois é campo digitado.
-- =============================================================================

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

-- ------------------------------------------------------------- novas colunas
ALTER TABLE public.legal_cases
  ADD COLUMN IF NOT EXISTS polarity public.legal_polarity NOT NULL DEFAULT 'passivo',
  ADD COLUMN IF NOT EXISTS probability NUMERIC(5, 4),
  ADD COLUMN IF NOT EXISTS phase public.legal_phase,
  ADD COLUMN IF NOT EXISTS expected_settlement DATE,
  ADD COLUMN IF NOT EXISTS lawyer_assessment TEXT;

-- Probabilidade é percentual de perda (passivo) ou de êxito (ativo): 0 a 1.
ALTER TABLE public.legal_cases
  DROP CONSTRAINT IF EXISTS legal_cases_probability_range;
ALTER TABLE public.legal_cases
  ADD CONSTRAINT legal_cases_probability_range
  CHECK (probability IS NULL OR (probability > 0 AND probability <= 1));

-- Provável = perda mais provável que não (CPC 25 / IAS 37). A coluna é gerada:
-- ninguém "escolhe" reconhecer provisão, a régua aplica.
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

-- --------------------------------------------------- legal_provision_entries
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

-- O lançamento herda o tenant do processo: quem enxerga o caso enxerga a provisão.
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

-- ------------------------------------------------------------ view de saldo
-- Saldo escriturado por processo: soma dos lançamentos com sinal contábil.
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

-- ---------------------------------------------------------------------------
-- Alerta de governança: processo encerrado que ainda tem saldo escriturado.
-- É o erro clássico de fechamento — o caso acaba, a provisão fica.
-- ---------------------------------------------------------------------------
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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030240000_agro.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Agro: talhão, arrendamento, barter e passivo ambiental (wave 19)
-- =============================================================================
-- Por que existe
-- --------------
-- A fazenda no PATRIUM era um `assets` com `area` em texto livre ("1.250 ha") e
-- um valor de laudo. Isso serve para o balanço e não serve para o negócio: não
-- diz se a safra dá lucro, se o arrendamento paga o capital, quanto custa o
-- barter nem quanto falta de reserva legal.
--
-- Nenhum consolidador financeiro cobre isso; nenhum app de agro cobre custódia.
-- O fosso está exatamente na junção — e a junção exige dado estruturado por
-- TALHÃO, não uma string de hectares.
--
-- Quatro tabelas, cada uma com o mínimo para a conta rodar:
--   agro_fields        — talhão: área, cultura, produtividade, custo
--   agro_leases        — arrendamento/parceria: dinheiro, sacas ou percentual
--   agro_barters       — insumo pago em sacas, com preço travado
--   agro_environmental — CAR, bioma, reserva legal e APP por propriedade
--
-- Toda a matemática fica em `src/lib/agro/agro.ts` (função pura, testável). O
-- banco guarda o FATO declarado; nenhuma coluna aqui é resultado de cálculo.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.agro_crop AS ENUM (
    'soja', 'milho', 'milho_safrinha', 'algodao', 'cana', 'cafe',
    'pastagem', 'floresta', 'saf', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agro_system AS ENUM ('lavoura', 'pastagem', 'saf', 'floresta', 'il', 'app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agro_biome AS ENUM (
    'amazonia', 'cerrado', 'mata_atlantica', 'pampa', 'pantanal', 'caatinga'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.car_status AS ENUM ('ativo', 'pendente', 'em_analise', 'irregular', 'sem_car');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lease_role AS ENUM (
    'arrendador',          -- cede a área e recebe
    'arrendatario',        -- toma a área e paga
    'parceiro_outorgante', -- entra com a terra na parceria
    'parceiro_outorgado'   -- entra com o capital/lavoura na parceria
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lease_payment AS ENUM ('dinheiro', 'sacas', 'parceria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- agro_fields
CREATE TABLE IF NOT EXISTS public.agro_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_ha NUMERIC NOT NULL CHECK (area_ha > 0),
  crop public.agro_crop NOT NULL DEFAULT 'soja',
  system public.agro_system NOT NULL DEFAULT 'lavoura',
  /** Produtividade declarada na safra (sc/ha). Nulo = usa o default do módulo. */
  productivity_sc_ha NUMERIC,
  /** Custo de produção declarado (R$/ha). */
  cost_per_ha NUMERIC,
  season TEXT,                          -- ex.: "2025/26"
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agro_fields_asset ON public.agro_fields(asset_id);
CREATE INDEX IF NOT EXISTS idx_agro_fields_entity ON public.agro_fields(entity_id);

ALTER TABLE public.agro_fields ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agro_fields TO authenticated;
GRANT ALL ON public.agro_fields TO service_role;
REVOKE ALL ON public.agro_fields FROM anon;

DROP POLICY IF EXISTS "Owners manage agro fields" ON public.agro_fields;
CREATE POLICY "Owners manage agro fields" ON public.agro_fields
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_agro_fields ON public.agro_fields;
CREATE TRIGGER set_updated_at_agro_fields BEFORE UPDATE ON public.agro_fields
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------- agro_leases
CREATE TABLE IF NOT EXISTS public.agro_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  role public.lease_role NOT NULL,
  counterparty TEXT,
  area_ha NUMERIC NOT NULL CHECK (area_ha > 0),
  payment public.lease_payment NOT NULL DEFAULT 'dinheiro',
  price_per_ha_year NUMERIC,            -- quando o pagamento é em dinheiro
  bags_per_ha NUMERIC,                  -- quando o pagamento é em sacas
  share_percent NUMERIC CHECK (share_percent IS NULL OR (share_percent >= 0 AND share_percent <= 100)),
  starts_on DATE,
  ends_on DATE,
  /** Índice de reajuste combinado: igpm, ipca, ipc_fipe ou fixo. */
  adjustment_index TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cada tipo de pagamento exige o seu campo: contrato sem preço é contrato que
  -- ninguém consegue calcular depois.
  CONSTRAINT agro_leases_payment_fields CHECK (
    (payment = 'dinheiro' AND price_per_ha_year IS NOT NULL)
    OR (payment = 'sacas' AND bags_per_ha IS NOT NULL)
    OR (payment = 'parceria' AND share_percent IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_agro_leases_asset ON public.agro_leases(asset_id);

ALTER TABLE public.agro_leases ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agro_leases TO authenticated;
GRANT ALL ON public.agro_leases TO service_role;
REVOKE ALL ON public.agro_leases FROM anon;

DROP POLICY IF EXISTS "Owners manage agro leases" ON public.agro_leases;
CREATE POLICY "Owners manage agro leases" ON public.agro_leases
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_agro_leases ON public.agro_leases;
CREATE TRIGGER set_updated_at_agro_leases BEFORE UPDATE ON public.agro_leases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- --------------------------------------------------------------- agro_barters
CREATE TABLE IF NOT EXISTS public.agro_barters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  supplier TEXT,
  season TEXT,
  /** Valor dos insumos se fossem pagos à vista (R$). */
  input_value NUMERIC NOT NULL CHECK (input_value > 0),
  /** Sacas entregues na colheita. */
  bags_due NUMERIC NOT NULL CHECK (bags_due > 0),
  /** Preço da saca travado no contrato (R$). */
  bag_reference_price NUMERIC NOT NULL CHECK (bag_reference_price > 0),
  area_ha NUMERIC,
  months_to_delivery INT DEFAULT 12,
  delivery_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agro_barters_asset ON public.agro_barters(asset_id);

ALTER TABLE public.agro_barters ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agro_barters TO authenticated;
GRANT ALL ON public.agro_barters TO service_role;
REVOKE ALL ON public.agro_barters FROM anon;

DROP POLICY IF EXISTS "Owners manage agro barters" ON public.agro_barters;
CREATE POLICY "Owners manage agro barters" ON public.agro_barters
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_agro_barters ON public.agro_barters;
CREATE TRIGGER set_updated_at_agro_barters BEFORE UPDATE ON public.agro_barters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------- agro_environmental
CREATE TABLE IF NOT EXISTS public.agro_environmental (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES public.entities(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
  total_ha NUMERIC NOT NULL CHECK (total_ha > 0),
  biome public.agro_biome NOT NULL DEFAULT 'cerrado',
  /** Propriedade dentro da Amazônia Legal — muda a exigência do cerrado (35% x 20%). */
  in_legal_amazon BOOLEAN NOT NULL DEFAULT true,
  legal_reserve_declared_ha NUMERIC,
  app_ha NUMERIC,
  car_number TEXT,
  car_status public.car_status DEFAULT 'sem_car',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agro_env_asset ON public.agro_environmental(asset_id);

ALTER TABLE public.agro_environmental ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agro_environmental TO authenticated;
GRANT ALL ON public.agro_environmental TO service_role;
REVOKE ALL ON public.agro_environmental FROM anon;

DROP POLICY IF EXISTS "Owners manage agro environmental" ON public.agro_environmental;
CREATE POLICY "Owners manage agro environmental" ON public.agro_environmental
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

DROP TRIGGER IF EXISTS set_updated_at_agro_env ON public.agro_environmental;
CREATE TRIGGER set_updated_at_agro_env BEFORE UPDATE ON public.agro_environmental
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------- leitura pronta
-- Área agrícola por propriedade: é o número que o balanço e o relatório citam.
CREATE OR REPLACE VIEW public.agro_area_by_asset
WITH (security_invoker = true) AS
SELECT
  f.asset_id,
  f.entity_id,
  COALESCE(SUM(f.area_ha) FILTER (WHERE f.system = 'lavoura'), 0) AS crop_ha,
  COALESCE(SUM(f.area_ha) FILTER (WHERE f.system = 'pastagem'), 0) AS pasture_ha,
  COALESCE(SUM(f.area_ha), 0) AS total_ha,
  COUNT(*) AS fields
FROM public.agro_fields f
GROUP BY f.asset_id, f.entity_id;

COMMENT ON VIEW public.agro_area_by_asset IS
  'Área por propriedade separando lavoura de pastagem (wave 19).';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030250000_audit_chain.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Trilha de auditoria encadeada + âncoras assinadas (wave 20)
-- =============================================================================
-- Por que existe
-- --------------
-- A wave 4 criou o trigger que grava `audit_logs` de verdade. Mas log gravável
-- não prova nada: quem tem acesso ao banco apaga a linha, ajusta o valor e a
-- "trilha" continua linda no relatório. Para virar prova, a trilha precisa de
-- três coisas que ela não tinha:
--
--   1. ENCADEAMENTO — cada entrada carrega o hash da anterior. Apagar ou alterar
--      uma linha quebra todos os elos seguintes.
--   2. CADEIA POR TENANT — a cadeia é por `owner_user_id`. Cadeia global obrigaria
--      lock global; por tenant, cada família tem a sua e a verificação é local.
--   3. ÂNCORA ASSINADA — o auditor recebe um manifest (contagem + elo atual +
--      hash da cadeia) assinado com HMAC-SHA256 pelo servidor. A âncora prova
--      "neste instante a cadeia tinha este estado", mesmo que o banco mude depois.
--
-- Detalhes de implementação que importam:
--   · `pg_advisory_xact_lock` serializa a escrita por tenant — sem isso, dois
--     inserts simultâneos leem o mesmo "último hash" e a cadeia bifurca.
--   · O texto canônico vive em UMA função (`audit_payload_text`), usada pelo
--     trigger e exposta pela view de verificação. O app só faz o SHA-256 —
--     nenhuma chance de divergir formatação de JSON entre JS e Postgres.
--   · `audit_anchors` não tem policy de UPDATE/DELETE: âncora emitida é imutável
--     para `authenticated`. Só o `service_role` (owner das tabelas) poderia mexer,
--     e é isso que dá sentido à assinatura.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------- colunas novas
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

-- ------------------------------------------------------- texto canônico do hash
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

-- ------------------------------------------------------------- elo da cadeia
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

-- --------------------------------------------------- encadeia o que já existe
-- Backfill idempotente: só toca linhas sem hash, em ordem cronológica por tenant.
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

-- Roda uma vez na aplicação da migration (não faz nada se já está encadeado).
SELECT public.backfill_audit_chain();

-- --------------------------------------------------------------- view de leitura
-- `security_invoker`: valem as policies de audit_logs (dono do dado ou admin).
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

-- --------------------------------------------------------------- verificação SQL
-- Verificação barata no banco (o app faz a versão completa, com conteúdo).
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

-- ------------------------------------------------------------------ âncoras
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
-- Sem UPDATE nem DELETE: âncora emitida é imutável. Se o estado mudou, emite-se
-- outra âncora — o histórico de âncoras é justamente o que dá a linha do tempo.
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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030260000_jarvis_tools.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 21 — JARVIS com ferramentas e aprovação humana
--
-- O JARVIS não escreve: ele PROPÕE. Esta tabela é o registro da proposta:
--   pending → approved/rejected → applied (ou failed)
--
-- Por que uma tabela e não um JSON no chat:
--   · a aprovação precisa ser auditável (quem aprovou, quando, com que nota);
--   · a proposta sobrevive ao refresh e pode ser revisada depois;
--   · o status é a trava de idempotência do "aplicar" (só aplica o que está
--     aprovado, e só uma vez).
--
-- RLS: o dono lê e cria as suas; o envelope de decisão é fechado pelo servidor
-- (decisão e aplicação passam por `service` ou pela sessão do próprio dono com
-- `owner_user_id = auth.uid()`). DELETE é negado: proposta é registro, não rascunho.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.jarvis_proposals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind              text NOT NULL,
  title             text NOT NULL,
  rationale         text,
  effect            text,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pending',
  tool              text,
  question          text,
  decided_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at        timestamptz,
  decision_note     text,
  applied_at        timestamptz,
  applied_record_id uuid,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT jarvis_proposals_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'failed')),
  CONSTRAINT jarvis_proposals_kind_check
    CHECK (kind IN ('criar_risco', 'criar_plano_acao', 'lancar_provisao'))
);

COMMENT ON TABLE public.jarvis_proposals IS
  'Propostas de escrita do JARVIS. Nada é gravado nos módulos sem aprovação humana.';
COMMENT ON COLUMN public.jarvis_proposals.status IS
  'pending = aguardando; approved/rejected = decisão humana; applied = efeito gravado; failed = erro ao aplicar.';

CREATE INDEX IF NOT EXISTS jarvis_proposals_owner_status_idx
  ON public.jarvis_proposals(owner_user_id, status, created_at DESC);

ALTER TABLE public.jarvis_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jarvis_proposals_select_own" ON public.jarvis_proposals;
CREATE POLICY "jarvis_proposals_select_own"
  ON public.jarvis_proposals FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Criação só como o próprio dono (o servidor usa a sessão do usuário).
DROP POLICY IF EXISTS "jarvis_proposals_insert_own" ON public.jarvis_proposals;
CREATE POLICY "jarvis_proposals_insert_own"
  ON public.jarvis_proposals FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND status = 'pending');

-- Atualização apenas pelo dono: decide e aplica. Sem UPDATE de terceiro.
DROP POLICY IF EXISTS "jarvis_proposals_update_own" ON public.jarvis_proposals;
CREATE POLICY "jarvis_proposals_update_own"
  ON public.jarvis_proposals FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Sem DELETE: proposta é registro histórico.
DROP POLICY IF EXISTS "jarvis_proposals_delete_none" ON public.jarvis_proposals;
CREATE POLICY "jarvis_proposals_delete_none"
  ON public.jarvis_proposals FOR DELETE
  TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- Contagem por status para o widget do painel (evita puxar as linhas).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jarvis_pending_proposals(_limit int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  title text,
  kind text,
  effect text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.title, p.kind, p.effect, p.created_at
    FROM public.jarvis_proposals p
   WHERE p.status = 'pending'
     AND p.owner_user_id = auth.uid()
   ORDER BY p.created_at DESC
   LIMIT greatest(_limit, 1);
$$;

COMMENT ON FUNCTION public.jarvis_pending_proposals IS
  'Propostas do JARVIS aguardando aprovação do usuário logado.';

REVOKE ALL ON FUNCTION public.jarvis_pending_proposals(int) FROM public;
GRANT EXECUTE ON FUNCTION public.jarvis_pending_proposals(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificação rápida (rodar depois de aplicar):
--   SELECT status, count(*) FROM public.jarvis_proposals GROUP BY status;
--   SELECT public.jarvis_pending_proposals(5);
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030270000_multi_family_office.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 22 — multi-tenant real para multi-family office (MFO)
--
-- PROBLEMA
-- Até aqui, "tenant" = um usuário. Todas as tabelas de entidade são protegidas
-- por `public.owns_entity(entity_id)`, que resolve para `entity.owner_user_id =
-- auth.uid()`. Isso é ótimo para uma família e inútil para um escritório que
-- administra 30 famílias: cada analista teria de logar na conta do cliente.
--
-- DECISÃO DE ARQUITETURA (a parte que importa)
-- NÃO se abre nenhuma policy existente. Adiciona-se uma camada de LEITURA
-- AGREGADA por escritório:
--
--   · `offices`         — o escritório (MFO)
--   · `office_members`  — quem trabalha no escritório (papel + status)
--   · `office_clients`  — o vínculo escritório ↔ família, criado PELA FAMÍLIA
--                         (consentimento explícito, revogável)
--
-- O acesso à dados de cliente acontece por DUAS funções SECURITY DEFINER que
-- checam o vínculo explicitamente e devolvem AGREGADOS, nunca linhas cruas:
--
--   office_can_read_tenant(owner)         → o vínculo existe e está ativo?
--   office_consolidation()                → uma linha por família com os totais
--
-- Por que não dar SELECT nas tabelas dos clientes para os analistas:
--   1. as telas atuais (dashboard, custódia, agro…) foram desenhadas para UMA
--      família — se o RLS entregasse 30 famílias, a tela misturaria patrimônios
--      e mostraria um número que não existe;
--   2. dado pessoal de cliente não deve chegar ao navegador do analista por
--      acidente de `.select()`;
--   3. leitura agregada é suficiente para o trabalho de conselho e é auditável.
-- O drill-down por família fica para a wave seguinte, com registro de acesso.
--
-- Consentimento: a linha de `office_clients` só pode ser criada pelo PRÓPRIO
-- `owner_user_id` da família (WITH CHECK `owner_user_id = auth.uid()`), mesmo que
-- quem peça seja o escritório. Sem consentimento, não há vínculo.
-- =============================================================================

-- ---------------------------------------------------------------- escritórios
CREATE TABLE IF NOT EXISTS public.offices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text,
  document    text,
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offices IS
  'Escritório (multi-family office). Agrupa equipe e famílias clientes.';

CREATE UNIQUE INDEX IF NOT EXISTS offices_slug_key ON public.offices (lower(slug)) WHERE slug IS NOT NULL;

-- ------------------------------------------------------------------- equipe
-- O convite é por e-mail (não há como descobrir o uuid de outra pessoa com
-- segurança): `user_id` fica nulo até a pessoa entrar e a claim ser feita.
CREATE TABLE IF NOT EXISTS public.office_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  role        text NOT NULL DEFAULT 'analista',
  status      text NOT NULL DEFAULT 'ativo',
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_members_role_check
    CHECK (role IN ('socio', 'gestor', 'analista', 'leitor')),
  CONSTRAINT office_members_status_check
    CHECK (status IN ('ativo', 'convidado', 'suspenso')),
  CONSTRAINT office_members_identity_check
    CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS office_members_user_key
  ON public.office_members (office_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS office_members_email_key
  ON public.office_members (office_id, lower(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE public.office_members IS
  'Equipe do escritório. Convite por e-mail (user_id nulo) vira vínculo na primeira sessão da pessoa.';
COMMENT ON COLUMN public.office_members.role IS
  'socio = administra o escritório; gestor = administra famílias e equipe; analista = lê; leitor = só relatórios.';

CREATE INDEX IF NOT EXISTS office_members_user_idx ON public.office_members(user_id, status);

-- ------------------------------------------------------ famílias (clientes)
CREATE TABLE IF NOT EXISTS public.office_clients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id      uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  -- Chave do tenant da família: é o `owner_user_id` que já existe em todo o app.
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          text NOT NULL,
  status         text NOT NULL DEFAULT 'ativo',
  granted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  CONSTRAINT office_clients_status_check
    CHECK (status IN ('ativo', 'pausado', 'encerrado')),
  CONSTRAINT office_clients_unique UNIQUE (office_id, owner_user_id)
);

COMMENT ON TABLE public.office_clients IS
  'Consentimento da família: liga um tenant (owner_user_id) a um escritório. Criado pela família.';

CREATE INDEX IF NOT EXISTS office_clients_owner_idx
  ON public.office_clients(owner_user_id, status);

-- ------------------------------------------------------------------ funções
CREATE OR REPLACE FUNCTION public.office_role_of(_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
    FROM public.office_members m
   WHERE m.user_id = _user
     AND m.status = 'ativo'
   ORDER BY CASE m.role WHEN 'socio' THEN 1 WHEN 'gestor' THEN 2 WHEN 'analista' THEN 3 ELSE 4 END
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_role_of(uuid) IS
  'Papel mais alto do usuário em um escritório ativo (null se não é de escritório nenhum).';

CREATE OR REPLACE FUNCTION public.office_can_read_tenant(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner IS NOT NULL AND (
    _owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
        FROM public.office_clients c
        JOIN public.office_members m ON m.office_id = c.office_id
       WHERE c.owner_user_id = _owner
         AND c.status = 'ativo'
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
    )
  );
$$;

COMMENT ON FUNCTION public.office_can_read_tenant(uuid) IS
  'True se o chamador é a própria família, admin, ou membro ativo de um escritório com vínculo ativo.';

REVOKE ALL ON FUNCTION public.office_role_of(uuid) FROM public;
REVOKE ALL ON FUNCTION public.office_can_read_tenant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.office_role_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.office_can_read_tenant(uuid) TO authenticated;

-- O escritório informa o slug à família; a família consente usando o slug.
-- Sem isso, a busca por slug não retornaria nada (a policy de `offices` só
-- mostra escritórios dos quais a pessoa já é membro).
CREATE OR REPLACE FUNCTION public.office_lookup(_slug text)
RETURNS TABLE (id uuid, name text, slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.slug
    FROM public.offices o
   WHERE lower(o.slug) = lower(btrim(_slug))
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_lookup(text) IS
  'Resolve um escritório pelo slug para que a família conceda acesso (consentimento).';

REVOKE ALL ON FUNCTION public.office_lookup(text) FROM public;
GRANT EXECUTE ON FUNCTION public.office_lookup(text) TO authenticated;

-- Convites por e-mail viram vínculo na primeira sessão de quem foi convidado.
CREATE OR REPLACE FUNCTION public.claim_office_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count integer;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL OR v_email = '' THEN
    RETURN 0;
  END IF;

  WITH claimed AS (
    UPDATE public.office_members m
       SET user_id = auth.uid(),
           status = 'ativo'
     WHERE m.user_id IS NULL
       AND m.status = 'convidado'
       AND lower(m.email) = v_email
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM claimed;

  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.claim_office_invites() IS
  'Liga convites pendentes (por e-mail) ao usuário logado. Retorna quantos foram reivindicados.';

REVOKE ALL ON FUNCTION public.claim_office_invites() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_office_invites() TO authenticated;

-- ------------------------------------------------------------ consolidação
-- Uma linha por família cliente do chamador. Só agregados: nenhum nome de ativo,
-- nenhum documento, nenhum processo. O que o conselho precisa e nada além.
CREATE OR REPLACE FUNCTION public.office_consolidation()
RETURNS TABLE (
  office_id           uuid,
  office_name         text,
  owner_user_id       uuid,
  label               text,
  client_status       text,
  granted_at          timestamptz,
  entities            integer,
  entities_value      numeric,
  assets_value        numeric,
  positions_value     numeric,
  liabilities_value   numeric,
  net_worth           numeric,
  risks_open          integer,
  risks_critical      integer,
  documents_expiring  integer,
  documents_overdue   integer,
  legal_exposure      numeric,
  agro_area_ha        numeric,
  last_update         timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.office_id,
    o.name,
    c.owner_user_id,
    c.label,
    c.status,
    c.granted_at,
    coalesce(e.entities, 0),
    coalesce(e.entities_value, 0),
    coalesce(a.assets_value, 0),
    coalesce(p.positions_value, 0),
    coalesce(l.liabilities_value, 0),
    coalesce(a.assets_value, 0) + coalesce(p.positions_value, 0) - coalesce(l.liabilities_value, 0),
    coalesce(r.risks_open, 0),
    coalesce(r.risks_critical, 0),
    coalesce(d.documents_expiring, 0),
    coalesce(d.documents_overdue, 0),
    coalesce(j.legal_exposure, 0),
    coalesce(g.agro_area_ha, 0),
    greatest(
      coalesce(a.last_update, 'epoch'::timestamptz),
      coalesce(p.last_update, 'epoch'::timestamptz),
      coalesce(l.last_update, 'epoch'::timestamptz)
    )
  FROM public.office_clients c
  JOIN public.offices o ON o.id = c.office_id
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS entities,
           coalesce(sum(x.entities_value), 0) AS entities_value
      FROM (
        SELECT e1.id, sum(coalesce(a1."value", 0)) AS entities_value
          FROM public.entities e1
          LEFT JOIN public.assets a1 ON a1.entity_id = e1.id
         WHERE e1.owner_user_id = c.owner_user_id
         GROUP BY e1.id
      ) x
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(a2."value", 0)), 0) AS assets_value,
           max(coalesce(a2.updated_at, a2.created_at)) AS last_update
      FROM public.assets a2
      JOIN public.entities e2 ON e2.id = a2.entity_id
     WHERE e2.owner_user_id = c.owner_user_id
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(p2.quantity, 0) * coalesce(p2.unit_price, 0)), 0) AS positions_value,
           max(coalesce(p2.updated_at, p2.created_at)) AS last_update
      FROM public.positions p2
      JOIN public.entities e3 ON e3.id = p2.entity_id
     WHERE e3.owner_user_id = c.owner_user_id
  ) p ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(l2.outstanding, 0)), 0) AS liabilities_value,
           max(coalesce(l2.updated_at, l2.created_at)) AS last_update
      FROM public.liabilities l2
      JOIN public.entities e4 ON e4.id = l2.entity_id
     WHERE e4.owner_user_id = c.owner_user_id
  ) l ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE coalesce(r2.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado'))::int AS risks_open,
           count(*) FILTER (
             WHERE coalesce(r2.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
               AND r2.severity IN ('critical', 'critica', 'alta', 'high')
           )::int AS risks_critical
      FROM public.risks r2
      JOIN public.entities e5 ON e5.id = r2.entity_id
     WHERE e5.owner_user_id = c.owner_user_id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (
             WHERE d2.expiry_date IS NOT NULL
               AND d2.expiry_date >= current_date
               AND d2.expiry_date <= current_date + 60
           )::int AS documents_expiring,
           count(*) FILTER (
             WHERE d2.expiry_date IS NOT NULL AND d2.expiry_date < current_date
           )::int AS documents_overdue
      FROM public.documents d2
      JOIN public.entities e6 ON e6.id = d2.entity_id
     WHERE e6.owner_user_id = c.owner_user_id
  ) d ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(j2.value_at_stake, 0)), 0) AS legal_exposure
      FROM public.legal_cases j2
      JOIN public.entities e7 ON e7.id = j2.entity_id
     WHERE e7.owner_user_id = c.owner_user_id
       AND coalesce(j2.status::text, '') NOT IN ('encerrado', 'arquivado', 'procedente')
  ) j ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(coalesce(g2.area_ha, 0)), 0) AS agro_area_ha
      FROM public.agro_fields g2
      JOIN public.entities e8 ON e8.id = g2.entity_id
     WHERE e8.owner_user_id = c.owner_user_id
  ) g ON true
  WHERE public.office_can_read_tenant(c.owner_user_id)
    AND c.status <> 'encerrado'
  ORDER BY o.name, c.label;
$$;

COMMENT ON FUNCTION public.office_consolidation() IS
  'Agregado por família cliente visível ao chamador. Não devolve linhas cruas de cliente.';

REVOKE ALL ON FUNCTION public.office_consolidation() FROM public;
GRANT EXECUTE ON FUNCTION public.office_consolidation() TO authenticated;

-- ---------------------------------------------------------------------- RLS
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_clients ENABLE ROW LEVEL SECURITY;

-- offices: membro lê o seu; criador insere; socio/gestor edita.
DROP POLICY IF EXISTS "office_members_read_office" ON public.offices;
CREATE POLICY "office_members_read_office" ON public.offices
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = offices.id AND m.user_id = auth.uid() AND m.status <> 'suspenso'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "office_create_own" ON public.offices;
CREATE POLICY "office_create_own" ON public.offices
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "office_admin_update" ON public.offices;
CREATE POLICY "office_admin_update" ON public.offices
  FOR UPDATE TO authenticated
  USING (public.office_role_of(auth.uid()) IN ('socio', 'gestor') AND created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- office_members: vejo a equipe do escritório onde trabalho; socio/gestor gerencia.
DROP POLICY IF EXISTS "office_members_read_team" ON public.office_members;
CREATE POLICY "office_members_read_team" ON public.office_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "office_members_manage" ON public.office_members;
CREATE POLICY "office_members_manage" ON public.office_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- quem cria o escritório entra como socio; socio/gestor convida o resto
    (user_id = auth.uid() AND role = 'socio')
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
         AND me.role IN ('socio', 'gestor')
    )
  );

DROP POLICY IF EXISTS "office_members_update" ON public.office_members;
CREATE POLICY "office_members_update" ON public.office_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_members.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
         AND me.role IN ('socio', 'gestor')
    )
  )
  WITH CHECK (true);

-- office_clients: a família vê quem tem acesso; o escritório vê seus vínculos;
-- SÓ a família cria/altera o vínculo (consentimento).
DROP POLICY IF EXISTS "office_clients_read" ON public.office_clients;
CREATE POLICY "office_clients_read" ON public.office_clients
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members me
       WHERE me.office_id = office_clients.office_id
         AND me.user_id = auth.uid()
         AND me.status = 'ativo'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "office_clients_grant_by_family" ON public.office_clients;
CREATE POLICY "office_clients_grant_by_family" ON public.office_clients
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND granted_by = auth.uid()
    AND status = 'ativo'
  );

DROP POLICY IF EXISTS "office_clients_update_by_family" ON public.office_clients;
CREATE POLICY "office_clients_update_by_family" ON public.office_clients
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Revogação é registro histórico: DELETE negado, usa-se status = 'encerrado'.
DROP POLICY IF EXISTS "office_clients_no_delete" ON public.office_clients;
CREATE POLICY "office_clients_no_delete" ON public.office_clients
  FOR DELETE TO authenticated
  USING (false);

-- ---------------------------------------------------------------------------
-- Verificação rápida depois de aplicar:
--   SELECT * FROM public.office_role_of(auth.uid());
--   SELECT public.office_can_read_tenant(auth.uid());
--   SELECT * FROM public.office_consolidation();
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030280000_tenant_isolation.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 23 — fechar o vazamento entre tenants (policies legadas)
--
-- O DIAGNÓSTICO (registrado na wave 22, §30.1)
-- Conviveram, desde a primeira versão do projeto, duas camadas de RLS:
--
--   · as policies "legadas" criadas antes do modelo por entidade:
--       FOR ALL USING (auth.role() = 'authenticated')
--       FOR SELECT USING (true)
--   · as policies por dono/entidade criadas depois:
--       USING (public.owns_entity(entity_id)) / owner_user_id = auth.uid()
--
-- Políticas PERMISSIVAS se somam com OR. Enquanto a legada existe, ela anula a
-- nova: qualquer usuário autenticado lê e escreve **dados de outro tenant**.
-- Tabelas afetadas: entities, entity_shares, members, assets, documents,
-- transactions, risks, audit_logs, jarvis_insights, jarvis_health_scores e
-- jarvis_action_plans. Em `audit_logs` o efeito era o pior possível: a trilha de
-- auditoria de todos os tenants era legível por qualquer sessão.
--
-- POR QUE ISSO PRECISA DE CUIDADO
-- Ao remover a policy permissiva, linhas SEM vínculo de tenant (entity_id nulo,
-- owner_user_id nulo) deixariam de ser visíveis para todo mundo — inclusive para
-- quem as criou. Isso parece "perda de dados" e gera ticket. A solução não é
-- manter o buraco aberto: é **quarentena**.
--
--   · linha com vínculo  → visível ao dono (como sempre deveria ter sido);
--   · linha sem vínculo  → visível APENAS para admin, que pode adotá-la.
--
-- Nada é apagado. Nada fica público. O admin é avisado por função de contagem.
--
-- Também é recriada a policy de INSERT em `audit_logs` para o autor registrar o
-- próprio evento: o trigger `record_audit_log()` é SECURITY DEFINER e continua
-- funcionando sem policy, mas o JARVIS (wave 21) grava a trilha da proposta pela
-- sessão do usuário e não pode perder esse direito.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auditoria viva do isolamento (o número que a tela mostra)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patrium_tenant_tables()
RETURNS TABLE (table_name text, tenant_column text)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT * FROM (VALUES
    ('entities',            'owner_user_id'),
    ('members',             'owner_user_id'),
    ('entity_shares',       'entity_id'),
    ('assets',              'entity_id'),
    ('documents',           'entity_id'),
    ('transactions',        'entity_id'),
    ('risks',               'entity_id'),
    ('liabilities',         'entity_id'),
    ('positions',           'entity_id'),
    ('accounts',            'entity_id'),
    ('goals',               'entity_id'),
    ('suppliers',           'entity_id'),
    ('commitments',         'entity_id'),
    ('portal_grants',       'entity_id'),
    ('legal_cases',         'entity_id'),
    ('agro_fields',         'entity_id'),
    ('agro_leases',         'entity_id'),
    ('agro_barters',        'entity_id'),
    ('agro_environmental',  'entity_id'),
    ('audit_logs',          'owner_user_id'),
    ('jarvis_insights',     'entity_id'),
    ('jarvis_health_scores','entity_id')
  ) AS t(table_name, tenant_column);
$$;

COMMENT ON FUNCTION public.patrium_tenant_tables() IS
  'Tabelas que guardam dado de tenant e a coluna que define o dono (wave 23).';

-- Classifica as policies permissivas que ainda estão de pé.
CREATE OR REPLACE FUNCTION public.patrium_isolation_audit()
RETURNS TABLE (
  table_name     text,
  policy_name    text,
  cmd            text,
  qual           text,
  with_check     text,
  verdict        text,
  detail         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tenant AS (
    SELECT t.table_name, t.tenant_column FROM public.patrium_tenant_tables() t
  ),
  -- Dados de referência: leitura compartilhada é intencional e não é vazamento.
  compartilhado(nome) AS (
    VALUES ('quotes'), ('quote_runs'), ('custodians'), ('security_policies')
  )
  SELECT
    p.tablename::text,
    p.policyname::text,
    p.cmd::text,
    coalesce(p.qual, ''),
    coalesce(p.with_check, ''),
    CASE
      WHEN c.nome IS NOT NULL THEN 'compartilhado'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('true', '(true)')
        OR lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('auth.role()=''authenticated''', '(auth.role()=''authenticated'')')
        OR lower(replace(coalesce(p.qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
        THEN 'vazamento'
      ELSE 'ok'
    END,
    CASE
      WHEN c.nome IS NOT NULL THEN 'Leitura compartilhada intencional (dado de mercado/referência).'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) IN ('true', '(true)')
        THEN 'Policy sem predicado: qualquer sessão autenticada alcança linhas de outro tenant.'
      WHEN lower(replace(coalesce(p.qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
        THEN 'Policy legada por papel: anula (OR) a policy por entidade/dono.'
      ELSE 'Escopada por dono ou entidade.'
    END
  FROM pg_policies p
  JOIN tenant t ON t.table_name = p.tablename AND p.schemaname = 'public'
  LEFT JOIN compartilhado c ON c.nome = p.tablename::text
  ORDER BY 6, 1, 2;
$$;

COMMENT ON FUNCTION public.patrium_isolation_audit() IS
  'Auditoria viva das policies de isolamento por tenant (wave 23). Não devolve dado de cliente.';

REVOKE ALL ON FUNCTION public.patrium_isolation_audit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patrium_isolation_audit() TO authenticated;
REVOKE ALL ON FUNCTION public.patrium_tenant_tables() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.patrium_tenant_tables() TO authenticated;

-- Contagem de linhas órfãs (sem dono) por tabela — só admin.
CREATE OR REPLACE FUNCTION public.patrium_orphan_counts()
RETURNS TABLE (table_name text, tenant_column text, orphan_rows bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas admin pode ver a contagem de linhas órfãs.';
  END IF;

  FOR r IN SELECT * FROM public.patrium_tenant_tables() LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL', r.table_name, r.tenant_column)
      INTO v_count;
    table_name := r.table_name;
    tenant_column := r.tenant_column;
    orphan_rows := coalesce(v_count, 0);
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.patrium_orphan_counts() IS
  'Linhas sem vínculo de tenant (entity_id/owner_user_id nulo) por tabela. Ficam em quarentena para admin (wave 23).';

REVOKE ALL ON FUNCTION public.patrium_orphan_counts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patrium_orphan_counts() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Derrubar as policies legadas
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entities;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.entity_shares;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.members;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.assets;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.documents;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.risks;
DROP POLICY IF EXISTS "Full access to authenticated users" ON public.audit_logs;

DROP POLICY IF EXISTS "Users can manage their action plans" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Authenticated users can manage action plans" ON public.jarvis_action_plans;
DROP POLICY IF EXISTS "Users can view insights related to their entities" ON public.jarvis_insights;
DROP POLICY IF EXISTS "Users can view health scores" ON public.jarvis_health_scores;

-- Qualquer outra policy que use o padrão legado por papel.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND lower(replace(coalesce(qual, ''), ' ', '')) LIKE '%auth.role()=''authenticated''%'
       AND tablename IN (SELECT table_name FROM public.patrium_tenant_tables())
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Policy legada removida: %.%', r.tablename, r.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Quarentena: linha sem dono fica visível só para admin
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_policy text;
BEGIN
  FOR r IN SELECT * FROM public.patrium_tenant_tables()
            WHERE table_name IN (
              'entities', 'members', 'entity_shares', 'assets', 'documents',
              'transactions', 'risks', 'audit_logs', 'jarvis_insights',
              'jarvis_health_scores'
            )
  LOOP
    v_policy := format('Quarentena admin %s', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%I IS NULL AND public.has_role(auth.uid(), ''admin'')) WITH CHECK (%I IS NULL AND public.has_role(auth.uid(), ''admin''))',
      v_policy, r.table_name, r.tenant_column, r.tenant_column
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trilha: autor registra o próprio evento (JARVIS wave 21 depende disso)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autores registram a própria trilha" ON public.audit_logs;
CREATE POLICY "Autores registram a própria trilha" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND coalesce(user_id, auth.uid()) = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. Aviso — o que fazer com as linhas órfãs
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_total bigint := 0;
  v_detail text := '';
  r record;
BEGIN
  FOR r IN
    SELECT pc.table_name, pc.orphan_rows
      FROM public.patrium_orphan_counts() pc
     WHERE pc.orphan_rows > 0
  LOOP
    v_total := v_total + r.orphan_rows;
    v_detail := v_detail || format('%s: %s linha(s); ', r.table_name, r.orphan_rows);
  END LOOP;

  IF v_total > 0 THEN
    RAISE NOTICE
      'Quarentena ativa: % linha(s) sem vínculo de tenant (%) — visíveis apenas para admin. Adote-as para uma entidade (UPDATE ... SET entity_id = <uuid>) ou remova com decisão registrada.',
      v_total, v_detail;
  ELSE
    RAISE NOTICE 'Isolamento fechado: nenhuma linha órfã encontrada.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT * FROM public.patrium_isolation_audit() WHERE verdict <> 'ok';
--   SELECT * FROM public.patrium_orphan_counts() WHERE orphan_rows > 0;
-- Ambos devem voltar vazios (ou só 'compartilhado').
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030290000_office_detail_scope.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 24 — drill-down por família: escopo consentido + log de acesso
--
-- A wave 22 entregou o consolidado **agregado**: o escritório via quanto cada
-- família tinha, nunca o conteúdo. Isso é certo para o conselho, mas insuficiente
-- para o trabalho diário — o analista precisa ver a carteira para opinar.
--
-- Esta wave abre o detalhe com duas condições, as duas no banco:
--
--   1. ESCOPO. A família escolhe, seção por seção, o que o escritório pode abrir
--      (`office_clients.scopes`). O default é o mínimo: só `resumo`. Nada de
--      "consentimento amplo por omissão".
--   2. REGISTRO. Cada abertura grava uma linha em `office_access_log` com quem,
--      qual família, qual seção e quando. A família **vê** esse log — transparência
--      sobre quem olhou seus dados é parte do consentimento, não um extra.
--
-- Por que não dar SELECT nas tabelas: ver §30.2 da documentação. Mesmo com
-- escopo, o detalhe sai por função curada — sem `notes`, sem texto livre, sem
-- URL de arquivo. O que o analista precisa para opinar, e nada além.
--
-- Revogar escopo é imediato: a função checa `scopes` a cada chamada; não há
-- cache de permissão.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Escopos no vínculo
-- ---------------------------------------------------------------------------
ALTER TABLE public.office_clients
  ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['resumo']::text[];

COMMENT ON COLUMN public.office_clients.scopes IS
  'Seções que o escritório pode abrir em detalhe. Default mínimo: resumo. Escolhido pela família.';

-- Só escopos conhecidos, sempre incluindo 'resumo' (que é o agregado mínimo).
ALTER TABLE public.office_clients
  DROP CONSTRAINT IF EXISTS office_clients_scopes_check;
ALTER TABLE public.office_clients
  ADD CONSTRAINT office_clients_scopes_check
  CHECK (
    scopes <@ ARRAY['resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos']::text[]
    AND 'resumo' = ANY (scopes)
  );

-- ---------------------------------------------------------------------------
-- 2. Log de acesso (imutável)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_access_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id         uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  -- Quem abriu (membro da equipe do escritório).
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- De quem é o dado aberto.
  target_owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope             text NOT NULL,
  action            text NOT NULL DEFAULT 'abrir_detalhe',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT office_access_log_scope_check
    CHECK (scope IN ('resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos')),
  CONSTRAINT office_access_log_action_check
    CHECK (action IN ('abrir_detalhe', 'negado_sem_escopo', 'consolidado'))
);

COMMENT ON TABLE public.office_access_log IS
  'Quem do escritório abriu qual seção de qual família, quando. A família pode ler os próprios acessos.';

CREATE INDEX IF NOT EXISTS office_access_log_target_idx
  ON public.office_access_log(target_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS office_access_log_reader_idx
  ON public.office_access_log(user_id, created_at DESC);

ALTER TABLE public.office_access_log ENABLE ROW LEVEL SECURITY;

-- Família vê quem abriu o dado dela; membro vê o que ele mesmo abriu; sócio/gestor
-- do escritório vê o log do escritório inteiro (para auditar a própria equipe).
DROP POLICY IF EXISTS "office_access_log_read" ON public.office_access_log;
CREATE POLICY "office_access_log_read" ON public.office_access_log
  FOR SELECT TO authenticated
  USING (
    target_owner_id = auth.uid()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = office_access_log.office_id
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
         AND m.role IN ('socio', 'gestor')
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Log é registro: sem edição, sem exclusão.
DROP POLICY IF EXISTS "office_access_log_no_update" ON public.office_access_log;
CREATE POLICY "office_access_log_no_update" ON public.office_access_log
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "office_access_log_no_delete" ON public.office_access_log;
CREATE POLICY "office_access_log_no_delete" ON public.office_access_log
  FOR DELETE TO authenticated USING (false);

-- ---------------------------------------------------------------------------
-- 3. Escopos efetivos de um vínculo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.office_client_scopes(_owner uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(c.scopes, ARRAY['resumo']::text[])
    FROM public.office_clients c
   WHERE c.owner_user_id = _owner
     AND c.status = 'ativo'
   ORDER BY c.granted_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.office_client_scopes(uuid) IS
  'Escopos consentidos pela família (vínculo ativo mais recente).';

REVOKE ALL ON FUNCTION public.office_client_scopes(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_client_scopes(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Detalhe curado, por escopo, com registro de acesso
-- ---------------------------------------------------------------------------
-- Devolve jsonb com as seções permitidas. Cada seção traz só o necessário para
-- o analista opinar: nada de `notes`, texto livre ou URL de arquivo.
CREATE OR REPLACE FUNCTION public.office_family_detail(_owner uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link     record;
  v_scopes   text[];
  v_sections jsonb := '{}'::jsonb;
  v_result   jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória.';
  END IF;

  SELECT c.id, c.office_id, c.label, c.scopes
    INTO v_link
    FROM public.office_clients c
   WHERE c.owner_user_id = _owner
     AND c.status = 'ativo'
   ORDER BY c.granted_at DESC
   LIMIT 1;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Nenhum vínculo ativo: a família precisa consentir o acesso ao escritório.';
  END IF;

  -- Só membro ativo do escritório do vínculo, a própria família ou admin.
  IF NOT (
    _owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.office_members m
       WHERE m.office_id = v_link.office_id
         AND m.user_id = auth.uid()
         AND m.status = 'ativo'
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para abrir este detalhe.';
  END IF;

  v_scopes := coalesce(v_link.scopes, ARRAY['resumo']::text[]);

  -- Registro ANTES de devolver: acesso negado também é registro.
  INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
  VALUES (v_link.office_id, auth.uid(), _owner, 'resumo', 'abrir_detalhe');

  -- ---- resumo: sempre presente (é o mínimo que o vínculo garante)
  v_sections := v_sections || jsonb_build_object(
    'resumo',
    (
      SELECT jsonb_build_object(
        'entities', count(DISTINCT e.id),
        'assetsValue', coalesce(sum(coalesce(a.value, 0)), 0),
        'lastUpdate', max(coalesce(a.updated_at, a.created_at))
      )
      FROM public.entities e
      LEFT JOIN public.assets a ON a.entity_id = e.id
      WHERE e.owner_user_id = _owner
    )
  );

  -- ---- custódia
  IF 'custodia' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'custodia', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'custodia',
      jsonb_build_object(
        'total', (
          SELECT coalesce(sum(coalesce(p.quantity, 0) * coalesce(p.unit_price, 0)), 0)
            FROM public.positions p
            JOIN public.entities e ON e.id = p.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'byClass', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT p.asset_class::text AS class,
                     count(*)::int AS positions,
                     sum(coalesce(p.quantity, 0) * coalesce(p.unit_price, 0)) AS value
                FROM public.positions p
                JOIN public.entities e ON e.id = p.entity_id
               WHERE e.owner_user_id = _owner
               GROUP BY p.asset_class
               ORDER BY 3 DESC
            ) t
        ),
        'debt', (
          SELECT coalesce(sum(coalesce(l.outstanding, 0)), 0)
            FROM public.liabilities l
            JOIN public.entities e ON e.id = l.entity_id
           WHERE e.owner_user_id = _owner
        )
      )
    );
  END IF;

  -- ---- contencioso
  IF 'contencioso' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'contencioso', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'contencioso',
      jsonb_build_object(
        'exposure', (
          SELECT coalesce(sum(coalesce(c.value_at_stake, 0)), 0)
            FROM public.legal_cases c
            JOIN public.entities e ON e.id = c.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'cases', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT c.title, c.type::text AS type, c.status::text AS status,
                     c.probability, coalesce(c.value_at_stake, 0) AS value
                FROM public.legal_cases c
                JOIN public.entities e ON e.id = c.entity_id
               WHERE e.owner_user_id = _owner
               ORDER BY coalesce(c.value_at_stake, 0) DESC
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  -- ---- agro
  IF 'agro' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'agro', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'agro',
      jsonb_build_object(
        'areaHa', (
          SELECT coalesce(sum(coalesce(f.area_ha, 0)), 0)
            FROM public.agro_fields f
            JOIN public.entities e ON e.id = f.entity_id
           WHERE e.owner_user_id = _owner
        ),
        'fields', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT f.name, f.crop::text AS crop, f.area_ha,
                     f.productivity_sc_ha, f.cost_per_ha
                FROM public.agro_fields f
                JOIN public.entities e ON e.id = f.entity_id
               WHERE e.owner_user_id = _owner
               ORDER BY f.area_ha DESC
               LIMIT 15
            ) t
        )
      )
    );
  END IF;

  -- ---- documentos (sem URL de arquivo)
  IF 'documentos' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'documentos', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'documentos',
      jsonb_build_object(
        'expiring', (
          SELECT count(*)::int
            FROM public.documents d
            JOIN public.entities e ON e.id = d.entity_id
           WHERE e.owner_user_id = _owner
             AND d.expiry_date >= current_date
             AND d.expiry_date <= current_date + 60
        ),
        'overdue', (
          SELECT count(*)::int
            FROM public.documents d
            JOIN public.entities e ON e.id = d.entity_id
           WHERE e.owner_user_id = _owner
             AND d.expiry_date < current_date
        ),
        'items', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT d.title, d.type, d.expiry_date, d.status::text AS status
                FROM public.documents d
                JOIN public.entities e ON e.id = d.entity_id
               WHERE e.owner_user_id = _owner
                 AND d.expiry_date IS NOT NULL
               ORDER BY d.expiry_date
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  -- ---- riscos
  IF 'riscos' = ANY (v_scopes) THEN
    INSERT INTO public.office_access_log (office_id, user_id, target_owner_id, scope, action)
    VALUES (v_link.office_id, auth.uid(), _owner, 'riscos', 'abrir_detalhe');

    v_sections := v_sections || jsonb_build_object(
      'riscos',
      jsonb_build_object(
        'open', (
          SELECT count(*)::int
            FROM public.risks r
            JOIN public.entities e ON e.id = r.entity_id
           WHERE e.owner_user_id = _owner
             AND coalesce(r.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
        ),
        'items', (
          SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
            FROM (
              SELECT r.title, r.severity::text AS severity, r.status, r.due_date
                FROM public.risks r
                JOIN public.entities e ON e.id = r.entity_id
               WHERE e.owner_user_id = _owner
                 AND coalesce(r.status, 'aberto') NOT IN ('resolvido', 'fechado', 'mitigado')
               ORDER BY CASE r.severity
                          WHEN 'critical' THEN 1 WHEN 'critica' THEN 1
                          WHEN 'high' THEN 2 WHEN 'alta' THEN 2
                          WHEN 'medium' THEN 3 WHEN 'media' THEN 3
                          ELSE 4 END,
                        r.due_date NULLS LAST
               LIMIT 10
            ) t
        )
      )
    );
  END IF;

  v_result := jsonb_build_object(
    'ownerUserId', _owner,
    'label', v_link.label,
    'officeId', v_link.office_id,
    'scopes', to_jsonb(v_scopes),
    'sections', v_sections,
    'generatedAt', now()
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.office_family_detail(uuid) IS
  'Detalhe por família respeitando os escopos consentidos. Cada seção aberta gera linha em office_access_log (wave 24).';

REVOKE ALL ON FUNCTION public.office_family_detail(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_family_detail(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Leitura do log pela família (transparência)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.office_my_access_log(_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  office_name text,
  reader_email text,
  scope text,
  action text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id,
         o.name,
         coalesce(u.email, 'membro do escritório'),
         l.scope,
         l.action,
         l.created_at
    FROM public.office_access_log l
    JOIN public.offices o ON o.id = l.office_id
    LEFT JOIN auth.users u ON u.id = l.user_id
   WHERE l.target_owner_id = auth.uid()
   ORDER BY l.created_at DESC
   LIMIT greatest(_limit, 1);
$$;

COMMENT ON FUNCTION public.office_my_access_log(int) IS
  'Quem abriu meus dados e quando — visível para a própria família (wave 24).';

REVOKE ALL ON FUNCTION public.office_my_access_log(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_my_access_log(int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. A família troca os escopos (dentro do próprio vínculo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.office_set_scopes(_grant uuid, _scopes text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT c.owner_user_id INTO v_owner
    FROM public.office_clients c
   WHERE c.id = _grant;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Só a própria família altera os escopos deste vínculo.';
  END IF;

  IF NOT ('resumo' = ANY (_scopes)) THEN
    RAISE EXCEPTION 'O escopo resumo não pode ser removido.';
  END IF;

  IF NOT (_scopes <@ ARRAY['resumo', 'custodia', 'contencioso', 'agro', 'documentos', 'riscos']::text[]) THEN
    RAISE EXCEPTION 'Escopo desconhecido.';
  END IF;

  UPDATE public.office_clients
     SET scopes = _scopes
   WHERE id = _grant;

  RETURN _scopes;
END;
$$;

COMMENT ON FUNCTION public.office_set_scopes(uuid, text[]) IS
  'Atualiza os escopos consentidos. Só a família dona do vínculo.';

REVOKE ALL ON FUNCTION public.office_set_scopes(uuid, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.office_set_scopes(uuid, text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT office_client_scopes(auth.uid());
--   SELECT office_family_detail(auth.uid());
--   SELECT * FROM office_my_access_log(20);
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030300000_anchor_signature.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 25 — assinatura assimétrica das âncoras (ECDSA P-256)
--
-- O PROBLEMA DO HMAC (wave 20)
-- A âncora era assinada com um segredo simétrico. Isso prova integridade, mas
-- cria um impasse de confiança: quem tem o segredo pode assinar. O auditor ou
-- confia na palavra do operador, ou recebe a chave e passa a poder forjar
-- âncoras. Não existe terceiro independente num esquema simétrico.
--
-- A SOLUÇÃO
-- ECDSA P-256 com SHA-256. O servidor assina com a chave privada
-- (AUDIT_SIGNING_PRIVATE_KEY); o auditor verifica com a pública e **não
-- consegue assinar**. A verificação é feita com openssl padrão, sem instalar
-- nada deste projeto:
--
--   openssl dgst -sha256 -verify public.pem -signature signature.der manifest-hash.txt
--
-- O QUE ESTA MIGRATION GUARDA
-- · signature_format — `hex` (HMAC, wave 20) ou `der-base64` (ECDSA, wave 25).
--   Sem isso o verificador não sabe se decodifica base64 ou lê hex.
-- · public_key — PEM que assinou ESTA âncora. Guardar a chave na própria linha
--   é o que mantém âncoras antigas verificáveis depois de uma rotação de chave;
--   sem ela, rotacionar invalidaria o histórico (ou obrigaria a confiar em
--   "qual era a chave em 2026?").
-- · key_fingerprint — SHA-256 do SPKI, 64 hex. Identifica a chave sem expô-la.
--
-- Nada aqui é destrutivo: âncoras antigas em HMAC continuam válidas e
-- verificáveis pelo caminho simétrico.
-- =============================================================================

ALTER TABLE public.audit_anchors
  ADD COLUMN IF NOT EXISTS signature_format text,
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS key_fingerprint text;

COMMENT ON COLUMN public.audit_anchors.signature_format IS
  'hex = HMAC-SHA256 (wave 20); der-base64 = ECDSA P-256 (wave 25).';
COMMENT ON COLUMN public.audit_anchors.public_key IS
  'PEM da chave pública que assinou esta âncora — permite verificar depois de rotacionar.';
COMMENT ON COLUMN public.audit_anchors.key_fingerprint IS
  'SHA-256 do SPKI (64 hex). Identifica a chave sem revelá-la.';

-- Âncoras antigas: formato explícito, para o verificador não adivinhar.
UPDATE public.audit_anchors
   SET signature_format = 'hex'
 WHERE signature_format IS NULL
   AND signature IS NOT NULL
   AND coalesce(signature_algorithm, '') = 'HMAC-SHA256';

CREATE INDEX IF NOT EXISTS audit_anchors_fingerprint_idx
  ON public.audit_anchors(key_fingerprint)
  WHERE key_fingerprint IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Inventário de chaves usadas — para responder "quais âncoras esta chave assinou?"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_signing_keys_used()
RETURNS TABLE (
  key_fingerprint text,
  signature_algorithm text,
  anchors bigint,
  first_used timestamptz,
  last_used timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.key_fingerprint,
         a.signature_algorithm,
         count(*)::bigint,
         min(a.created_at),
         max(a.created_at)
    FROM public.audit_anchors a
   WHERE a.owner_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
   GROUP BY a.key_fingerprint, a.signature_algorithm
   ORDER BY max(a.created_at) DESC;
$$;

COMMENT ON FUNCTION public.audit_signing_keys_used() IS
  'Chaves que já assinaram âncoras do tenant (rotação e due diligence) — wave 25.';

REVOKE ALL ON FUNCTION public.audit_signing_keys_used() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.audit_signing_keys_used() TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT signature_algorithm, signature_format, count(*)
--     FROM public.audit_anchors GROUP BY 1, 2;
--   SELECT * FROM public.audit_signing_keys_used();
-- ---------------------------------------------------------------------------

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030310000_system_events.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =============================================================================
-- Wave 26 — observabilidade: eventos de sistema no próprio banco
--
-- POR QUE NO BANCO E NÃO SÓ EM UM FORNECEDOR
-- O produto roda em ambientes onde não há Sentry contratado, e amarrar a
-- operação a um fornecedor para responder "quebrou alguma coisa?" é caro e
-- frágil. Aqui os eventos ficam onde os dados já estão, com RLS de admin, e o
-- encaminhamento para fora (webhook/Sentry/Datadog) é opcional — se existir,
-- OBSERVABILITY_WEBHOOK_URL resolve.
--
-- O QUE ISTO **NÃO** É
-- Não é a trilha de auditoria. A trilha (waves 20–25) prova o que aconteceu com
-- os dados, é encadeada por hash e imutável. Aqui é diagnóstico operacional:
-- erro, lentidão, falha de integração. Misturar os dois encareceria a trilha e
-- enfraqueceria a prova.
--
-- PII: a aplicação depura e-mail, documento, UUID, token e valor monetário antes
-- de gravar (`scrub` em src/lib/observability/telemetry.ts). A defesa aqui é a
-- segunda camada: retenção curta e leitura restrita a admin.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.system_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL,
  severity     text NOT NULL,
  source       text NOT NULL,
  message      text NOT NULL,
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Agrupa ocorrências iguais sem precisar ler a mensagem.
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

-- Gravação: qualquer sessão autenticada pode registrar o próprio evento
-- (o cliente reporta erro de tela). Leitura: só admin — mensagem de erro pode
-- conter detalhe de outro tenant, mesmo depurada.
DROP POLICY IF EXISTS "system_events_insert_authenticated" ON public.system_events;
CREATE POLICY "system_events_insert_authenticated" ON public.system_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "system_events_read_admin" ON public.system_events;
CREATE POLICY "system_events_read_admin" ON public.system_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Evento não se edita nem se apaga pela aplicação: se estiver errado, registra-se
-- outro. Limpeza é operação de banco (retenção), não do app.
DROP POLICY IF EXISTS "system_events_no_update" ON public.system_events;
CREATE POLICY "system_events_no_update" ON public.system_events
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "system_events_no_delete" ON public.system_events;
CREATE POLICY "system_events_no_delete" ON public.system_events
  FOR DELETE TO authenticated USING (false);

-- ---------------------------------------------------------------------------
-- Contagem por fingerprint na janela (o que o painel mostra)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Retenção: 90 dias de evento operacional. Mais que isso vira custo sem uso —
-- diagnóstico serve para agir, e quem precisa de histórico de longo prazo usa a
-- trilha de auditoria.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT * FROM public.system_event_counts(24);
--   SELECT * FROM public.system_events_recent(20);
-- ---------------------------------------------------------------------------
