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
