CREATE TABLE IF NOT EXISTS "skus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sku_number" text NOT NULL,
  "quickbooks_legacy_sku" text,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "storage_type" text,
  "default_unit" text,
  "pack_size" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
  "updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
  CONSTRAINT "skus_sku_number_unique" UNIQUE("sku_number")
);

CREATE INDEX IF NOT EXISTS "skus_name_idx" ON "skus" USING btree ("name");
CREATE INDEX IF NOT EXISTS "skus_category_idx" ON "skus" USING btree ("category");

CREATE TABLE IF NOT EXISTS "order_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "sku_id" uuid NOT NULL,
  "line_number" integer DEFAULT 1 NOT NULL,
  "quantity" numeric(12, 3) NOT NULL,
  "unit" text NOT NULL,
  "unit_price" numeric(12, 2),
  "notes" text,
  "created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
  "updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
  CONSTRAINT "order_line_items_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "order_line_items_sku_id_skus_id_fk"
    FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "order_line_items_order_id_idx" ON "order_line_items" USING btree ("order_id");
CREATE INDEX IF NOT EXISTS "order_line_items_sku_id_idx" ON "order_line_items" USING btree ("sku_id");
CREATE INDEX IF NOT EXISTS "order_line_items_order_line_idx" ON "order_line_items" USING btree ("order_id", "line_number");

ALTER TABLE "skus" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_line_items" ENABLE ROW LEVEL SECURITY;
