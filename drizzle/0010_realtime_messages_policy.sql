-- Policy on Supabase's realtime.messages — guarded so vanilla Postgres (the RLS
-- testcontainer harness / CI) still applies the rest of the migration set.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    CREATE POLICY "orders_read_own_topic" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (realtime.topic() = 'orders:' || (select auth.uid())::text
      OR (
        realtime.topic() = 'orders:all'
        AND EXISTS (SELECT 1 FROM "profiles" WHERE "profiles"."id" = (select auth.uid()) AND "profiles"."role" = 'owner')
      ));
  END IF;
END $$;
