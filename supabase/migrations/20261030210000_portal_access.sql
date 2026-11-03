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
