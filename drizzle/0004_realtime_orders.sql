-- Enable Supabase Realtime streaming for the `orders` table.
--
-- This is a Postgres-level publication membership change, not a schema
-- change: the `orders` table itself is unchanged. Wrapped in an
-- idempotent DO block so the same migration can apply against a fresh
-- vanilla Postgres (where `supabase_realtime` does not yet exist) as
-- well as a Supabase instance where the publication is already set up
-- and the table may already have been added.

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
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$$;
