CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price_cents" integer NOT NULL,
	"retired" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Role-based catalog RLS (Domain Charter D4) — hand-written here, NOT in the
-- schema slice: declaring it there would make `db:generate` re-emit (and drift
-- from) it. Targets `app_user` + the `app.user_roles` GUC, both of which exist
-- on BOTH targets (the vanilla test container and the live stack), so it is
-- emitted unconditionally. The CASL twin is `productsAbilities`; both layers
-- must pass to write a row.
--
-- READ is UNCONDITIONAL: every `app_user` sees the whole catalog (the line-item
-- picker needs it). Denying an UNAUTHENTICATED caller is the guard's fail-closed
-- job, not a row concern.
CREATE POLICY "products_read_all" ON "products" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (true);
--> statement-breakpoint
-- WRITE is OWNER-ONLY: INSERT/UPDATE/DELETE require the "owner" role in the
-- `app.user_roles` GUC. A missing/empty GUC makes `nullif(...,'')` NULL, the
-- cast/`@>` is skipped, and `coalesce(..., false)` returns false ⇒ DENY (fail
-- closed). The JSONB containment `@>` matches whole array ELEMENTS, so a crafted
-- role like 'x,owner' is a single element that can never satisfy `["owner"]` by
-- comma-splitting — delimiter-injection-proof (mirrors withUserContext's JSON
-- encoding). A non-owner INSERT trips WITH CHECK (throws); a non-owner
-- UPDATE/DELETE matches zero rows under USING (no error, no effect).
CREATE POLICY "products_owner_write" ON "products" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
  )
  WITH CHECK (
    coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
  );
--> statement-breakpoint
-- Full CRUD grant for app_user; the policies above (not the grant) scope reads
-- to everyone and writes to owners. DELETE is granted: a catalog row CAN be hard
-- deleted by an owner today; once orders reference products, `retired` is the
-- soft path the picker filters on.
GRANT SELECT, INSERT, UPDATE, DELETE ON "products" TO "app_user";