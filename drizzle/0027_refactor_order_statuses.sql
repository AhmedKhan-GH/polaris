-- Migration: Collapse 8-value order_status enum down to 6 values.
--
-- Old enum:  drafted, submitted, invoiced, closed, archived, discarded, rejected, voided
-- New enum:  draft, confirmed, processing, fulfilled, closed, cancelled
--
-- Mapping:
--   drafted   -> draft
--   submitted -> confirmed
--   invoiced  -> processing
--   closed    -> closed
--   archived  -> closed  (with is_archived = true)
--   discarded -> cancelled
--   rejected  -> cancelled
--   voided    -> cancelled
--
-- PostgreSQL cannot DROP or rename-to-duplicate values on an existing enum,
-- so we create a new enum, migrate every column via a text CASE expression,
-- then drop the old enum and rename the new one.

BEGIN;

-- ============================================================
-- 1. Add is_archived flag
-- ============================================================
ALTER TABLE "orders" ADD COLUMN "is_archived" boolean NOT NULL DEFAULT false;

-- Backfill: orders currently in 'archived' status get flagged
UPDATE "orders" SET "is_archived" = true WHERE "status" = 'archived';

-- ============================================================
-- 2. Collapse archived -> closed, rejected/voided -> discarded
--    (using existing enum values as intermediate landing pads)
-- ============================================================

-- Temporarily disable the forward-status trigger so these bulk
-- updates don't fail transition validation.
ALTER TABLE "orders" DISABLE TRIGGER ALL;

UPDATE "orders" SET "status" = 'closed'    WHERE "status" = 'archived';
UPDATE "orders" SET "status" = 'discarded' WHERE "status" IN ('rejected', 'voided');

-- Collapse history table too
UPDATE "order_status_history" SET "from_status" = 'closed'    WHERE "from_status" = 'archived';
UPDATE "order_status_history" SET "to_status"   = 'closed'    WHERE "to_status"   = 'archived';
UPDATE "order_status_history" SET "from_status" = 'discarded' WHERE "from_status" IN ('rejected', 'voided');
UPDATE "order_status_history" SET "to_status"   = 'discarded' WHERE "to_status"   IN ('rejected', 'voided');

-- ============================================================
-- 3. Create the new enum
-- ============================================================
CREATE TYPE "order_status_new" AS ENUM (
  'draft',
  'confirmed',
  'processing',
  'fulfilled',
  'closed',
  'cancelled'
);

-- ============================================================
-- 4. Migrate orders.status to new enum via text CASE
-- ============================================================
ALTER TABLE "orders"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "orders"
  ALTER COLUMN "status" SET DATA TYPE "order_status_new"
  USING (
    CASE "status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
    END
  )::"order_status_new";

ALTER TABLE "orders"
  ALTER COLUMN "status" SET DEFAULT 'draft'::"order_status_new";

-- ============================================================
-- 5. Migrate order_status_history columns to new enum
-- ============================================================
ALTER TABLE "order_status_history"
  ALTER COLUMN "from_status" SET DATA TYPE "order_status_new"
  USING (
    CASE "from_status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
      ELSE NULL
    END
  )::"order_status_new";

ALTER TABLE "order_status_history"
  ALTER COLUMN "to_status" SET DATA TYPE "order_status_new"
  USING (
    CASE "to_status"::text
      WHEN 'drafted'   THEN 'draft'
      WHEN 'submitted' THEN 'confirmed'
      WHEN 'invoiced'  THEN 'processing'
      WHEN 'closed'    THEN 'closed'
      WHEN 'discarded' THEN 'cancelled'
    END
  )::"order_status_new";

-- ============================================================
-- 6. Rebuild order_status_counts with new enum
-- ============================================================

-- Drop the trigger first (it references the function which references the table)
DROP TRIGGER IF EXISTS orders_sync_status_counts ON orders;

-- Delete all rows (PK references old enum type)
DELETE FROM "order_status_counts";

-- Swap the column type
ALTER TABLE "order_status_counts"
  ALTER COLUMN "status" SET DATA TYPE "order_status_new"
  USING "status"::text::"order_status_new";

-- ============================================================
-- 7. Drop old enum, rename new to order_status
-- ============================================================
DROP TYPE "order_status";
ALTER TYPE "order_status_new" RENAME TO "order_status";

-- ============================================================
-- 8. Re-seed order_status_counts
-- ============================================================
INSERT INTO "order_status_counts" (status, count)
SELECT s, 0
FROM unnest(enum_range(NULL::"order_status")) AS s;

UPDATE "order_status_counts" c
SET count = sub.count
FROM (
  SELECT status, COUNT(*)::bigint AS count
  FROM orders
  GROUP BY status
) sub
WHERE c.status = sub.status;

-- ============================================================
-- 9. Recreate orders_active_idx with new status values
-- ============================================================
DROP INDEX IF EXISTS "orders_active_idx";
CREATE INDEX "orders_active_idx"
  ON "orders" USING btree ("created_at" DESC NULLS LAST, "id" DESC NULLS LAST)
  WHERE status IN ('draft', 'confirmed', 'processing', 'fulfilled');

-- ============================================================
-- 10. Replace enforce_forward_status() with new transition graph
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'      AND NEW.status IN ('confirmed', 'cancelled'))            OR
    (OLD.status = 'confirmed'  AND NEW.status IN ('draft', 'processing', 'cancelled'))  OR
    (OLD.status = 'processing' AND NEW.status IN ('fulfilled', 'cancelled'))            OR
    (OLD.status = 'fulfilled'  AND NEW.status IN ('closed', 'cancelled'))
    -- closed and cancelled are terminal: no transitions out
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 11. Replace sync_order_status_counts() trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION sync_order_status_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE order_status_counts
    SET count = count + 1
    WHERE status = NEW.status;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE order_status_counts
    SET count = GREATEST(count - 1, 0)
    WHERE status = OLD.status;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE order_status_counts
    SET count = GREATEST(count - 1, 0)
    WHERE status = OLD.status;
    UPDATE order_status_counts
    SET count = count + 1
    WHERE status = NEW.status;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER orders_sync_status_counts
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_status_counts();

-- Re-enable triggers
ALTER TABLE "orders" ENABLE TRIGGER ALL;

COMMIT;
