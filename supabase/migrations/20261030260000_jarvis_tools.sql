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
