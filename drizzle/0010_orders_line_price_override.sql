-- order_lines: split the single price column into a frozen list-price snapshot
-- and an optional per-line override.
--
-- `unit_price_cents` is RENAMED (not dropped + re-added) so existing rows keep
-- their captured snapshot — it simply becomes `list_price_cents`. A new nullable
-- `override_price_cents` holds a deliberate off-list price the user typed; NULL
-- means "no override, bill the list price". The effective price is derived in
-- code (pricing.ts), never stored. Hand-written so the rename preserves data.
ALTER TABLE "order_lines" RENAME COLUMN "unit_price_cents" TO "list_price_cents";
--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "override_price_cents" integer;
--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_override_price_nonneg" CHECK ("order_lines"."override_price_cents" IS NULL OR "order_lines"."override_price_cents" >= 0);
