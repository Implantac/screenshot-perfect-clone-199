-- =============================================================================
-- Wave 25 — assinatura assimétrica das âncoras (ECDSA P-256)
--
-- O PROBLEMA DO HMAC (wave 20)
-- A âncora era assinada com um segredo simétrico. Isso prova integridade, mas
-- cria um impasse de confiança: quem tem o segredo pode assinar. O auditor ou
-- confia na palavra do operador, ou recebe a chave e passa a poder forjar
-- âncoras. Não existe terceiro independente num esquema simétrico.
--
-- A SOLUÇÃO
-- ECDSA P-256 com SHA-256. O servidor assina com a chave privada
-- (AUDIT_SIGNING_PRIVATE_KEY); o auditor verifica com a pública e **não
-- consegue assinar**. A verificação é feita com openssl padrão, sem instalar
-- nada deste projeto:
--
--   openssl dgst -sha256 -verify public.pem -signature signature.der manifest-hash.txt
--
-- O QUE ESTA MIGRATION GUARDA
-- · signature_format — `hex` (HMAC, wave 20) ou `der-base64` (ECDSA, wave 25).
--   Sem isso o verificador não sabe se decodifica base64 ou lê hex.
-- · public_key — PEM que assinou ESTA âncora. Guardar a chave na própria linha
--   é o que mantém âncoras antigas verificáveis depois de uma rotação de chave;
--   sem ela, rotacionar invalidaria o histórico (ou obrigaria a confiar em
--   "qual era a chave em 2026?").
-- · key_fingerprint — SHA-256 do SPKI, 64 hex. Identifica a chave sem expô-la.
--
-- Nada aqui é destrutivo: âncoras antigas em HMAC continuam válidas e
-- verificáveis pelo caminho simétrico.
-- =============================================================================

ALTER TABLE public.audit_anchors
  ADD COLUMN IF NOT EXISTS signature_format text,
  ADD COLUMN IF NOT EXISTS public_key text,
  ADD COLUMN IF NOT EXISTS key_fingerprint text;

COMMENT ON COLUMN public.audit_anchors.signature_format IS
  'hex = HMAC-SHA256 (wave 20); der-base64 = ECDSA P-256 (wave 25).';
COMMENT ON COLUMN public.audit_anchors.public_key IS
  'PEM da chave pública que assinou esta âncora — permite verificar depois de rotacionar.';
COMMENT ON COLUMN public.audit_anchors.key_fingerprint IS
  'SHA-256 do SPKI (64 hex). Identifica a chave sem revelá-la.';

-- Âncoras antigas: formato explícito, para o verificador não adivinhar.
UPDATE public.audit_anchors
   SET signature_format = 'hex'
 WHERE signature_format IS NULL
   AND signature IS NOT NULL
   AND coalesce(signature_algorithm, '') = 'HMAC-SHA256';

CREATE INDEX IF NOT EXISTS audit_anchors_fingerprint_idx
  ON public.audit_anchors(key_fingerprint)
  WHERE key_fingerprint IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Inventário de chaves usadas — para responder "quais âncoras esta chave assinou?"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_signing_keys_used()
RETURNS TABLE (
  key_fingerprint text,
  signature_algorithm text,
  anchors bigint,
  first_used timestamptz,
  last_used timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.key_fingerprint,
         a.signature_algorithm,
         count(*)::bigint,
         min(a.created_at),
         max(a.created_at)
    FROM public.audit_anchors a
   WHERE a.owner_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
   GROUP BY a.key_fingerprint, a.signature_algorithm
   ORDER BY max(a.created_at) DESC;
$$;

COMMENT ON FUNCTION public.audit_signing_keys_used() IS
  'Chaves que já assinaram âncoras do tenant (rotação e due diligence) — wave 25.';

REVOKE ALL ON FUNCTION public.audit_signing_keys_used() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.audit_signing_keys_used() TO authenticated;

-- ---------------------------------------------------------------------------
-- Verificação depois de aplicar:
--   SELECT signature_algorithm, signature_format, count(*)
--     FROM public.audit_anchors GROUP BY 1, 2;
--   SELECT * FROM public.audit_signing_keys_used();
-- ---------------------------------------------------------------------------
