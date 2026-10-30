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
