-- =============================================================================
-- Wave 28 — conciliação de saldo por conta
--
-- O QUE FALTAVA
-- A wave 8 concilia extrato × custódia (o mesmo fato visto dos dois lados). Mas
-- ela não responde a pergunta seguinte, que é a que fecha o mês:
--
--     "o saldo que o banco diz que eu tenho é o mesmo que eu calculei?"
--
-- Para responder isso faltavam duas coisas: (1) saber a qual CONTA cada
-- lançamento do extrato pertence, e (2) guardar o saldo informado pelo banco em
-- datas de fechamento. Sem (1), somar lançamentos por conta é chute; sem (2), não
-- existe contraprova para comparar.
--
-- DECISÕES
--  - `transactions.account_id` é **nullable**: existem lançamentos anteriores a
--    esta wave e lançamentos que não pertencem a conta nenhuma (despesa do grupo,
--    imóvel). Atribuir em massa por adivinhação seria pior que deixar em branco.
--  - `account_balances` guarda **um saldo por conta por dia** (índice único): o
--    banco não manda dois fechamentos do mesmo dia, e a reimportação do mesmo
--    extrato não pode duplicar a contraprova.
--  - O cálculo (esperado = abertura + entradas − saídas) fica no **código puro**
--    (`src/lib/wealth/account-ledger.ts`), não em SQL: é testável sem banco e
--    pode ser mostrado antes de gravar. O banco guarda fatos, o app calcula.
--  - Saldo informado é dado do cliente: RLS por `owns_entity(entity_id)` e
--    auditoria por trigger, igual ao resto do núcleo de riqueza.
-- =============================================================================

-- --------------------------------------------------------- vínculo do extrato
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.transactions.account_id IS
  'Conta de custódia a que o lançamento pertence. Nulo = não atribuído (wave 28).';

-- O cálculo por conta e período é sempre (account_id, transaction_date).
CREATE INDEX IF NOT EXISTS idx_transactions_account_date
  ON public.transactions (account_id, transaction_date DESC);

-- --------------------------------------------------------------- saldos
CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  -- Data de fechamento informada pelo banco (não a data em que foi digitada).
  as_of DATE NOT NULL,
  balance NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  -- De onde veio a contraprova: saldo do OFX, digitação do operador ou integração.
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT account_balances_source_check
    CHECK (source IN ('ofx', 'manual', 'api', 'extrato'))
);

COMMENT ON TABLE public.account_balances IS
  'Saldo informado pelo banco por conta e data — a contraprova da conciliação (wave 28).';
COMMENT ON COLUMN public.account_balances.as_of IS
  'Data do saldo (fechamento do extrato), não a data da digitação.';

-- Um saldo por conta por dia: reimportar o extrato atualiza, não duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_balances_account_date
  ON public.account_balances (account_id, as_of);
CREATE INDEX IF NOT EXISTS idx_account_balances_entity_date
  ON public.account_balances (entity_id, as_of DESC);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_balances TO authenticated;
GRANT ALL ON public.account_balances TO service_role;
REVOKE ALL ON public.account_balances FROM anon;

DROP POLICY IF EXISTS "Owners manage account balances" ON public.account_balances;
CREATE POLICY "Owners manage account balances" ON public.account_balances
  FOR ALL TO authenticated
  USING (public.owns_entity(entity_id))
  WITH CHECK (public.owns_entity(entity_id));

-- O saldo do banco é prova de conciliação: entra na trilha encadeada.
DROP TRIGGER IF EXISTS audit_account_balances ON public.account_balances;
CREATE TRIGGER audit_account_balances
  AFTER INSERT OR UPDATE OR DELETE ON public.account_balances
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- ---------------------------------------------------------------------------
-- Coerência entre conta e entidade: o saldo tem que ser da mesma entidade da
-- conta. Sem isso, uma chamada distraída grava o saldo da conta A na entidade B
-- e a conciliação passa a comparar coisas diferentes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.account_balance_entity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity UUID;
BEGIN
  SELECT entity_id INTO v_entity FROM public.accounts WHERE id = NEW.account_id;
  IF v_entity IS NULL THEN
    RAISE EXCEPTION 'Conta % não existe.', NEW.account_id;
  END IF;
  IF v_entity <> NEW.entity_id THEN
    RAISE EXCEPTION 'O saldo pertence à entidade % mas a conta pertence a %.', NEW.entity_id, v_entity;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.account_balance_entity_guard() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS account_balances_entity_guard ON public.account_balances;
CREATE TRIGGER account_balances_entity_guard
  BEFORE INSERT OR UPDATE ON public.account_balances
  FOR EACH ROW EXECUTE FUNCTION public.account_balance_entity_guard();

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT account_id, as_of, balance, source FROM public.account_balances ORDER BY as_of DESC;
--   SELECT account_id, count(*) FROM public.transactions WHERE account_id IS NOT NULL GROUP BY 1;
-- ---------------------------------------------------------------------------
