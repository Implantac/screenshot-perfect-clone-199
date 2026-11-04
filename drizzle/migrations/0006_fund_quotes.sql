ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS instrument_id TEXT;

COMMENT ON COLUMN public.positions.instrument_id IS
  'Identificador externo do instrumento: CNPJ (14 dígitos) para fundos de investimento.';

CREATE INDEX IF NOT EXISTS idx_positions_instrument ON public.positions (instrument_id)
  WHERE instrument_id IS NOT NULL;