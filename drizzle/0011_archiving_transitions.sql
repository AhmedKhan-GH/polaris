DROP INDEX IF EXISTS "orders_active_idx";--> statement-breakpoint
CREATE INDEX "orders_active_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status IN ('draft', 'submitted', 'invoiced', 'archiving');--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'     AND NEW.status IN ('submitted', 'deleted'))  OR
    (OLD.status = 'submitted' AND NEW.status IN ('invoiced',  'cancelled')) OR
    (OLD.status = 'invoiced'  AND NEW.status IN ('archiving', 'voided'))    OR
    (OLD.status = 'archiving' AND NEW.status = 'archived')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "orders_forward_status" ON "orders";--> statement-breakpoint
CREATE TRIGGER orders_forward_status
  BEFORE UPDATE OF status ON "orders"
  FOR EACH ROW EXECUTE FUNCTION enforce_forward_status();
