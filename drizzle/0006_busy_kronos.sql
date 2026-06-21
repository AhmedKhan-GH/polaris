CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Ownership RLS for orders (Domain Charter D4) — hand-written here, NOT in the
-- schema slice (declaring it there would make `db:generate` re-emit and drift).
-- Targets `app_user` + the `app.user_*` GUCs, present on both the vanilla test
-- container and the live stack. The CASL twin is `ordersAbilities`.
--
-- USING (read/visibility): a row is visible when it is the caller's own order
-- (`created_by` = the `app.user_id` GUC) OR the caller holds the "owner" role
-- (owners read all). A missing/empty roles GUC makes `nullif(...,'')` NULL, the
-- cast/`@>` is skipped, and `coalesce(..., false)` returns false ⇒ owner branch
-- DENY; only own-row visibility remains. Fails CLOSED: no identity, no rows.
--
-- WITH CHECK (write): DELIBERATELY no owner branch — every INSERT/UPDATE must
-- leave `created_by` equal to the acting `app.user_id`. Owner is a read-all
-- privilege, never a write-as-anyone privilege.
--
-- The JSONB containment `@>` matches whole array ELEMENTS, so a crafted role
-- like 'x,owner' is one element that can never satisfy `["owner"]` by
-- comma-splitting — delimiter-injection-proof.
CREATE POLICY "orders_owner_or_self" ON "orders" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    "orders"."created_by" = current_setting('app.user_id', true)::uuid
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
  )
  WITH CHECK (
    "orders"."created_by" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
-- Full CRUD for app_user; the policy above scopes which rows each caller may see
-- and write.
GRANT SELECT, INSERT, UPDATE, DELETE ON "orders" TO "app_user";