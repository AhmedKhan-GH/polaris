ALTER TYPE "order_status" RENAME VALUE 'completed' TO 'closed';--> statement-breakpoint
DROP INDEX IF EXISTS "orders_active_idx";--> statement-breakpoint
CREATE INDEX "orders_active_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status IN ('drafted', 'submitted', 'invoiced', 'closed');--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'drafted'   AND NEW.status IN ('submitted', 'discarded')) OR
    (OLD.status = 'submitted' AND NEW.status IN ('invoiced',  'rejected'))  OR
    (OLD.status = 'invoiced'  AND NEW.status IN ('closed',    'voided'))    OR
    (OLD.status = 'closed'    AND NEW.status = 'archived')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
