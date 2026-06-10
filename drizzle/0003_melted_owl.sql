CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Ownership policy for the DISPOSABLE EXEMPLAR (Charter §4). Hand-written here,
-- not in the schema slice: declaring it there would make `db:generate` re-emit
-- (and drift from) it. NO `auth`-schema guard — unlike profiles (drizzle/0001),
-- this targets `app_user` and the `app.user_id`/`app.user_roles` GUCs, all of
-- which exist on BOTH targets (the vanilla test container and the live stack),
-- so it is emitted unconditionally.
--
-- USING (read/visibility): a row is visible when EITHER it is the caller's own
-- row (`created_by` = the `app.user_id` GUC) OR the caller holds the "owner"
-- role (owners read every note). A missing/empty roles GUC makes
-- `nullif(...,'')` NULL, the cast/`@>` is skipped, and `coalesce(..., false)`
-- returns false ⇒ the owner branch is DENY; only own-row visibility remains. The
-- policy fails CLOSED: no identity context means no rows.
--
-- WITH CHECK (write): there is DELIBERATELY NO owner branch. Even an owner may
-- only write rows AS THEMSELVES — every INSERT/UPDATE must leave `created_by`
-- equal to the acting `app.user_id`. Owner is a read-all privilege, never a
-- write-as-anyone privilege; forging another user's authorship is rejected.
--
-- The JSONB containment `@>` matches whole array ELEMENTS, so a crafted role
-- string like 'x,owner' is a single element that can never satisfy `["owner"]`
-- by comma-splitting — delimiter-injection-proof (mirrors withUserContext's JSON
-- encoding).
CREATE POLICY "notes_owner_or_self" ON "notes" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    "notes"."created_by" = current_setting('app.user_id', true)::uuid
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
  )
  WITH CHECK (
    "notes"."created_by" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
-- Full CRUD for app_user; the policy above (not the grant) scopes which rows
-- each caller may actually see and write. The exemplar models a mutable owned
-- resource, so UPDATE/DELETE are granted (contrast sign_in_log's append-only
-- SELECT/INSERT grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON "notes" TO "app_user";