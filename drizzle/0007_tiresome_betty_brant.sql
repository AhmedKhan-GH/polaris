CREATE TABLE "order_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "order_line_items_order_product_unique" UNIQUE("order_id","product_id"),
	CONSTRAINT "order_line_items_quantity_positive" CHECK ("order_line_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Cross-feature FK to the products catalog, hand-written here (the schema slice
-- never imports another feature's schema — boundary rule D). ON DELETE RESTRICT:
-- a product referenced by any line cannot be hard-deleted; retiring it
-- (`products.retired`) is the soft path, so historical orders keep their link.
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Derived RLS (Domain Charter D4): a line item is NOT independently owned — its
-- access derives from its parent order. Both clauses re-check the GUCs directly
-- (self-contained, not relying on orders' own RLS inside the subquery).
--
-- USING (read): visible iff the caller can read the parent order — own it, OR
-- hold the "owner" role (read-all). WITH CHECK (write): the parent order must be
-- the caller's OWN (write-as-self) — an owner's read-all does NOT grant writing
-- another rep's order's lines, mirroring the orders WITH CHECK.
CREATE POLICY "order_line_items_via_parent_order" ON "order_line_items" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_line_items"."order_id"
        AND (
          o."created_by" = current_setting('app.user_id', true)::uuid
          OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "orders" o
      WHERE o."id" = "order_line_items"."order_id"
        AND o."created_by" = current_setting('app.user_id', true)::uuid
    )
  );--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "order_line_items" TO "app_user";