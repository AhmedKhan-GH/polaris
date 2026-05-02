BEGIN;--> statement-breakpoint

DROP TRIGGER IF EXISTS orders_sync_status_counts ON orders;--> statement-breakpoint
DROP FUNCTION IF EXISTS sync_order_status_counts();--> statement-breakpoint

DROP TABLE IF EXISTS order_status_counts;--> statement-breakpoint
CREATE TABLE order_status_counts (
  status order_status NOT NULL,
  count bigint DEFAULT 0 NOT NULL,
  CONSTRAINT order_status_counts_status_pk PRIMARY KEY (status)
);--> statement-breakpoint

INSERT INTO order_status_counts (status, count)
SELECT s, 0
FROM unnest(enum_range(NULL::order_status)) AS s
ON CONFLICT (status) DO NOTHING;--> statement-breakpoint

UPDATE order_status_counts c
SET count = sub.count
FROM (
  SELECT status, COUNT(*)::bigint AS count
  FROM orders
  GROUP BY status
) sub
WHERE c.status = sub.status;--> statement-breakpoint

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
$$;--> statement-breakpoint

CREATE TRIGGER orders_sync_status_counts
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_status_counts();--> statement-breakpoint

COMMIT;--> statement-breakpoint

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
