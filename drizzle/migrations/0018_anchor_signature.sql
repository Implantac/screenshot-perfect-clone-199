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

UPDATE public.audit_anchors
   SET signature_format = 'hex'
 WHERE signature_format IS NULL
   AND signature IS NOT NULL
   AND coalesce(signature_algorithm, '') = 'HMAC-SHA256';

CREATE INDEX IF NOT EXISTS audit_anchors_fingerprint_idx
  ON public.audit_anchors(key_fingerprint)
  WHERE key_fingerprint IS NOT NULL;

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
