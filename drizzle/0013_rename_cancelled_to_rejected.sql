ALTER TYPE "order_status" RENAME VALUE 'cancelled' TO 'rejected';--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'     AND NEW.status IN ('submitted', 'discarded')) OR
    (OLD.status = 'submitted' AND NEW.status IN ('invoiced',  'rejected'))  OR
    (OLD.status = 'invoiced'  AND NEW.status IN ('archiving', 'voided'))    OR
    (OLD.status = 'archiving' AND NEW.status = 'archived')
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
