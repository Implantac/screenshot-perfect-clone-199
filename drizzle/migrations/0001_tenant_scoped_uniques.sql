ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_tax_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS entities_owner_tax_id_key
  ON public.entities (owner_user_id, tax_id)
  WHERE tax_id IS NOT NULL;

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_email_key;
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_tax_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS members_owner_email_key
  ON public.members (owner_user_id, email)
  WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_owner_tax_id_key
  ON public.members (owner_user_id, tax_id)
  WHERE tax_id IS NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, t.relname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE n.nspname = 'public'
      AND c.contype = 'u'
      AND t.relname IN ('entities', 'members')
      AND a.attname IN ('tax_id', 'email')
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.relname, r.conname);
    RAISE NOTICE 'Removida constraint única global %.%', r.relname, r.conname;
  END LOOP;
END $$;