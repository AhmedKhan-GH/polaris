CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	CONSTRAINT "order_lines_order_product_unique" UNIQUE("order_id","product_id"),
	CONSTRAINT "order_lines_quantity_positive" CHECK ("order_lines"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Cross-feature FK to the products catalog, hand-written here (the schema slice
-- never imports another feature's schema — boundary rule D). ON DELETE RESTRICT:
-- a product referenced by any line cannot be hard-deleted; retiring it
-- (products.retired) is the soft path, so placed orders keep their link.
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Parent-derived RLS (Domain Charter D4): a line is NOT independently owned — its
-- access derives from the parent order. Each policy re-checks the GUCs directly
-- (self-contained, not relying on orders' own RLS inside the subquery). The CASL
-- twin is `ordersAbilities`.
--
-- READ: visible iff the caller can READ the parent order (own OR owner/admin).
CREATE POLICY "order_lines_read_via_parent" ON "order_lines" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_lines"."order_id"
        AND (
          o."created_by" = current_setting('app.user_id', true)::uuid
          OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
          OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false)
        )
    )
  );
--> statement-breakpoint
-- WRITE: allowed iff the caller may WRITE the parent — a member only on their OWN
-- `draft`; owner/admin on any non-terminal order. Terminal parents
-- (completed/cancelled) are frozen for everyone. The same predicate is applied as
-- INSERT WITH CHECK and as UPDATE/DELETE USING (+ WITH CHECK on UPDATE).
CREATE POLICY "order_lines_insert_via_parent" ON "order_lines" AS PERMISSIVE FOR INSERT TO "app_user"
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_lines"."order_id"
        AND (
          (o."created_by" = current_setting('app.user_id', true)::uuid AND o."status" = 'draft')
          OR (
            (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
             OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false))
            AND o."status" not in ('completed', 'cancelled')
          )
        )
    )
  );
--> statement-breakpoint
CREATE POLICY "order_lines_update_via_parent" ON "order_lines" AS PERMISSIVE FOR UPDATE TO "app_user"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_lines"."order_id"
        AND (
          (o."created_by" = current_setting('app.user_id', true)::uuid AND o."status" = 'draft')
          OR (
            (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
             OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false))
            AND o."status" not in ('completed', 'cancelled')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_lines"."order_id"
        AND (
          (o."created_by" = current_setting('app.user_id', true)::uuid AND o."status" = 'draft')
          OR (
            (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
             OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false))
            AND o."status" not in ('completed', 'cancelled')
          )
        )
    )
  );
--> statement-breakpoint
CREATE POLICY "order_lines_delete_via_parent" ON "order_lines" AS PERMISSIVE FOR DELETE TO "app_user"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_lines"."order_id"
        AND (
          (o."created_by" = current_setting('app.user_id', true)::uuid AND o."status" = 'draft')
          OR (
            (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
             OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false))
            AND o."status" not in ('completed', 'cancelled')
          )
        )
    )
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_lines" TO "app_user";
