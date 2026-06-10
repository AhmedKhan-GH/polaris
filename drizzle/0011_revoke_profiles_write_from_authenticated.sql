-- Custom SQL migration file, put your code below! --

-- Defense in depth for the role source-of-truth table.
--
-- profiles.role drives the whole app role chain (getSessionUser → CASL →
-- app.user_roles GUC → owner powers over orders/sign_in_log). Supabase's default
-- `GRANT ALL ... TO anon, authenticated` left those roles holding INSERT/UPDATE/
-- DELETE on profiles, so the ONLY barrier to a logged-in user running
-- `UPDATE profiles SET role='owner' WHERE id = auth.uid()` was the absence of an
-- RLS write policy — and that denial was SILENT (0 rows, no error), so a future
-- permissive profiles policy (F9 user management) could open self-escalation with
-- nothing failing. Revoke the write privileges so the table grant is least-
-- privilege too (read-only for authenticated), making the write fail loudly.
--
-- SELECT is retained: getSessionUser and the realtime owner-firehose policy read
-- profiles as `authenticated`. Provisioning writes run as the privileged role
-- (service_role / postgres), which is untouched here.
--
-- Guarded so vanilla Postgres (the RLS testcontainer harness / CI) — which has no
-- `auth` schema and no anon/authenticated roles — skips it cleanly.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
      ON "profiles" FROM "authenticated", "anon";
  END IF;
END $$;
