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
