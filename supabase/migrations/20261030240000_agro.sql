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
