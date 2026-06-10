CREATE TABLE "sign_in_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sign_in_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Owner-only read of the audit trail. Unlike profiles' policy (drizzle/0001),
-- this needs NO `auth`-schema guard: it targets `app_user` and reads the
-- `app.user_roles` GUC, both of which exist on BOTH DB targets (the vanilla
-- test container and the live Supabase stack). So it is emitted unconditionally.
--
-- Read gate (USING): true only when app.user_roles is present, non-empty, AND
-- contains "owner". A missing or empty GUC makes `nullif(...,'')` NULL, the
-- cast/`@>` is skipped, and `coalesce(..., false)` returns false ⇒ DENY. The
-- policy fails CLOSED: no identity context means no rows.
--
-- The JSONB containment `@>` matches whole array ELEMENTS, so a crafted role
-- string like 'owner","x' can never satisfy the check by string splicing —
-- it is delimiter-injection-proof (mirrors withUserContext's JSON encoding).
--
-- WITH CHECK (true): the recorder (lib/audit/record-sign-in) inserts a fact
-- with NO session/role context published, so writes must not be gated on
-- app.user_roles. Reads stay locked to owners; only INSERTs are open (and only
-- because the GRANT below is INSERT-only).
CREATE POLICY "sign_in_log_owner_read" ON "sign_in_log" AS PERMISSIVE FOR ALL TO "app_user"
  USING (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false))
  WITH CHECK (true);
--> statement-breakpoint
-- SELECT (owner-gated by the policy) + INSERT (the recorder's append) only.
-- UPDATE/DELETE are deliberately withheld: an audit log is append-only, so no
-- role — not even app_user — may mutate or erase a recorded sign-in.
GRANT SELECT, INSERT ON "sign_in_log" TO "app_user";