-- Migrate timestamp columns to bigint epoch milliseconds (UTC-anchored).
-- Existing rows were written via defaultNow() while the DB session was in
-- UTC (Supabase default), so we interpret stored values AT TIME ZONE 'UTC'
-- when computing the epoch to preserve the same instant.
--
-- Defaults must be dropped before the type change because Postgres won't
-- auto-cast `now()` (timestamp) to bigint, and SET DEFAULT applies before
-- USING. Wrapped in a transaction so a mid-statement failure rolls back
-- cleanly.

BEGIN;--> statement-breakpoint

DROP INDEX IF EXISTS "orders_active_idx";--> statement-breakpoint

ALTER TABLE "order_status_history" ALTER COLUMN "changed_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_status_history"
  ALTER COLUMN "changed_at" SET DATA TYPE bigint
  USING (extract(epoch from "changed_at" AT TIME ZONE 'UTC') * 1000)::bigint;--> statement-breakpoint
ALTER TABLE "order_status_history"
  ALTER COLUMN "changed_at" SET DEFAULT (extract(epoch from now()) * 1000)::bigint;--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "status_updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "status_updated_at" SET DATA TYPE bigint
  USING (extract(epoch from "status_updated_at" AT TIME ZONE 'UTC') * 1000)::bigint;--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "status_updated_at" SET DEFAULT (extract(epoch from now()) * 1000)::bigint;--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "created_at" SET DATA TYPE bigint
  USING (extract(epoch from "created_at" AT TIME ZONE 'UTC') * 1000)::bigint;--> statement-breakpoint
ALTER TABLE "orders"
  ALTER COLUMN "created_at" SET DEFAULT (extract(epoch from now()) * 1000)::bigint;--> statement-breakpoint

CREATE INDEX "orders_active_idx"
  ON "orders" USING btree ("created_at" DESC NULLS LAST, "id" DESC NULLS LAST)
  WHERE status IN ('drafted', 'submitted', 'invoiced', 'closed');--> statement-breakpoint

COMMIT;
