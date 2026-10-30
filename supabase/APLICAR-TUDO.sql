-- =============================================================================
-- APLICAR-TUDO — waves 4 a 8 do PATRIUM OS
--
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute uma vez.
-- É idempotente (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS / DO 6524 ... EXCEPTION),
-- então rodar de novo não quebra nada.
--
-- Ordem obrigatória: audit → tenant uniques → operations → wealth_core → imports
--                      → quotes → fund_quotes.
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030120000_audit_trail.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030130000_tenant_scoped_uniques.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030140000_operations_tables.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030150000_wealth_core.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030160000_imports.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030170000_quotes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 20261030180000_fund_quotes.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
