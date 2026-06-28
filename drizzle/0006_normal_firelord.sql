-- Human-readable order numbers draw from this sequence (START 100000). Created
-- here (not the schema slice) so db:generate never re-emits it; the table's
-- order_number default references it, so it must exist first.
CREATE SEQUENCE IF NOT EXISTS "orders_order_number_seq" START WITH 100000;
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" bigint DEFAULT nextval('orders_order_number_seq') NOT NULL,
	"created_by" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" in ('draft', 'submitted', 'processing', 'completed', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Ownership+role RLS (Domain Charter D4) — hand-written here, NOT the schema
-- slice (declaring it there would make db:generate re-emit and drift). Targets
-- `app_user` + the `app.user_*` GUCs, present on both the vanilla test container
-- and the live stack. The CASL twin is `ordersAbilities`.
--
-- READ (USING): visible to the creator (`created_by` = the `app.user_id` GUC) OR
-- to any `owner`/`admin` (read-all). A missing/empty roles GUC makes
-- `nullif(...,'')` NULL, the cast/`@>` is skipped, `coalesce(...,false)` denies
-- the role branches — only own-row visibility remains. Fails CLOSED.
--
-- The JSONB containment `@>` matches whole array ELEMENTS, so a crafted role like
-- 'x,owner' is one element that can never satisfy `["owner"]` by comma-splitting
-- — delimiter-injection-proof (mirrors withUserContext's JSON encoding).
CREATE POLICY "orders_read_own_or_privileged" ON "orders" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (
    "orders"."created_by" = current_setting('app.user_id', true)::uuid
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false)
  );
--> statement-breakpoint
-- INSERT (WITH CHECK): create-as-self — every role's new row must carry its own
-- `created_by`. Read-all never becomes write-as-anyone on insert.
CREATE POLICY "orders_insert_self" ON "orders" AS PERMISSIVE FOR INSERT TO "app_user"
  WITH CHECK (
    "orders"."created_by" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
-- SELECT + INSERT granted now; UPDATE (status transitions) arrives with its own
-- slice. app_user needs USAGE on the sequence to draw order_number on insert.
GRANT SELECT, INSERT ON "orders" TO "app_user";
--> statement-breakpoint
GRANT USAGE ON SEQUENCE "orders_order_number_seq" TO "app_user";
