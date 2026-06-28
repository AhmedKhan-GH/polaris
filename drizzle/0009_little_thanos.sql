-- order_lines: allow the same product on multiple lines, ordered by line_number.
-- Drops the one-row-per-product constraint and adds a per-order line_number
-- (assigned by the action). Hand-edited from the generated diff so the NOT NULL
-- column is backfilled before the constraint lands — safe on a table that
-- already has rows (the generated `ADD COLUMN ... NOT NULL` would fail otherwise).
ALTER TABLE "order_lines" DROP CONSTRAINT "order_lines_order_product_unique";
--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "line_number" integer;
--> statement-breakpoint
-- Backfill existing rows: number each order's lines 1..n by insertion order (id).
UPDATE "order_lines" ol
SET "line_number" = sub.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "order_id" ORDER BY "id") AS rn
  FROM "order_lines"
) sub
WHERE ol."id" = sub."id";
--> statement-breakpoint
ALTER TABLE "order_lines" ALTER COLUMN "line_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_line_unique" UNIQUE("order_id","line_number");
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_line_number_positive" CHECK ("order_lines"."line_number" > 0);
