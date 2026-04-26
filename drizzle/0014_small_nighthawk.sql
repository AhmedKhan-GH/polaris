CREATE TABLE "order_status_counts" (
	"status" "order_status" NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "order_status_counts_status_pk" PRIMARY KEY("status")
);

-- Seed every enum value (zero by default) so the application can
-- always resolve a row per status without a LEFT JOIN, then overwrite
-- the rows that have actual orders. The unnest(enum_range(...)) pattern
-- keeps the seed correct as new statuses are added to order_status.
INSERT INTO order_status_counts (status, count)
SELECT s, 0
FROM unnest(enum_range(NULL::"order_status")) AS s
ON CONFLICT (status) DO NOTHING;

UPDATE order_status_counts c
SET count = sub.count
FROM (
  SELECT status, COUNT(*)::bigint AS count
  FROM orders
  GROUP BY status
) sub
WHERE c.status = sub.status;

-- AFTER-row trigger that mirrors INSERT/UPDATE/DELETE on orders into
-- the counters table inside the same transaction --- so the count is
-- always consistent with the actual row state at commit time. UPDATE
-- only adjusts when status actually changes (statusUpdatedAt and
-- other column updates leave counts alone). GREATEST clamps the
-- decrement so a missed seed never produces negative numbers.
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

DROP TRIGGER IF EXISTS orders_sync_status_counts ON orders;
CREATE TRIGGER orders_sync_status_counts
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_status_counts();

-- Membership in the realtime publication so the browser receives
-- count deltas as they're committed, instead of having to poll the
-- aggregate. Idempotent so the migration applies cleanly against a
-- fresh vanilla Postgres or an existing Supabase instance.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'order_status_counts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_counts;
  END IF;
END
$$;
