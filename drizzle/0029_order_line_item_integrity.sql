-- Add database-level integrity checks for the order line item workflow.
-- App/server actions validate these too; constraints keep direct SQL and
-- concurrent writes honest.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skus_sku_number_not_blank'
  ) THEN
    ALTER TABLE "skus"
      ADD CONSTRAINT "skus_sku_number_not_blank"
      CHECK (length(btrim("sku_number")) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skus_name_not_blank'
  ) THEN
    ALTER TABLE "skus"
      ADD CONSTRAINT "skus_name_not_blank"
      CHECK (length(btrim("name")) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_items_order_line_unique'
  ) THEN
    ALTER TABLE "order_line_items"
      ADD CONSTRAINT "order_line_items_order_line_unique"
      UNIQUE ("order_id", "line_number");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_items_line_number_positive'
  ) THEN
    ALTER TABLE "order_line_items"
      ADD CONSTRAINT "order_line_items_line_number_positive"
      CHECK ("line_number" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_items_quantity_positive'
  ) THEN
    ALTER TABLE "order_line_items"
      ADD CONSTRAINT "order_line_items_quantity_positive"
      CHECK ("quantity" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_items_unit_not_blank'
  ) THEN
    ALTER TABLE "order_line_items"
      ADD CONSTRAINT "order_line_items_unit_not_blank"
      CHECK (length(btrim("unit")) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_items_unit_price_non_negative'
  ) THEN
    ALTER TABLE "order_line_items"
      ADD CONSTRAINT "order_line_items_unit_price_non_negative"
      CHECK ("unit_price" IS NULL OR "unit_price" >= 0);
  END IF;
END
$$;
