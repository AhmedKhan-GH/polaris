-- D7 template: channel-layer gating on realtime.messages (ADR-0002).
-- A subscriber reads only their own '$DOMAIN:{auth.uid()}' topic; the owner role
-- additionally reads '$DOMAIN:all' (checked via the subscriber's own profiles row —
-- profiles_select_self permits it, so no recursion). NEVER row-RLS a streamed table
-- for delivery filtering.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    EXECUTE 'CREATE POLICY "$DOMAIN_read_own_topic" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      realtime.topic() = ''$DOMAIN:'' || (select auth.uid())::text
      OR (
        realtime.topic() = ''$DOMAIN:all''
        AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ''owner'')
      )
    )';
  END IF;
END $$;
