-- Enable Supabase Realtime streaming for line item changes.
--
-- Publication membership is separate from the table definition, so keep
-- this as a small idempotent migration that works in fresh Postgres and in
-- Supabase environments where the publication already exists.

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
      AND tablename = 'order_line_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_line_items;
  END IF;
END
$$;
