-- =============================================================================
-- APLICAR-TUDO — waves 4 a 20 do PATRIUM OS
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
