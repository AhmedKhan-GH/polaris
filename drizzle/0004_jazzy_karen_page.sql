-- Custom SQL migration file, put your code below! --

-- Realtime plumbing for `notes`, instantiated from the two D7 templates
-- (lib/realtime/templates/*) per ADR-0002: $DOMAIN -> notes, $TABLE -> notes.
-- Both blocks are guarded by an `IF EXISTS (... schema_name = 'realtime')` check
-- so this migration is a NO-OP on a database without the Supabase `realtime`
-- schema (the vanilla testcontainer the ownership-RLS suite uses) and only takes
-- effect on the live Supabase stack. Executable verification lives in
-- app/_features/notes/__tests__/notes-broadcast.integration.test.ts.

-- 1. Per-user broadcast trigger (template: broadcast-trigger.sql).
--    AFTER INSERT/UPDATE/DELETE on public.notes, broadcast the changed row to
--    BOTH the owner's private 'notes:{owner}' topic and the 'notes:all'
--    firehose. SECURITY DEFINER with a pinned search_path.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    CREATE OR REPLACE FUNCTION public.broadcast_notes_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, realtime
    AS $fn$
    DECLARE
      owner_id uuid := coalesce(NEW.created_by, OLD.created_by);
    BEGIN
      PERFORM realtime.broadcast_changes('notes:' || owner_id::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      PERFORM realtime.broadcast_changes('notes:all', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      RETURN NULL;
    END;
    $fn$;
    DROP TRIGGER IF EXISTS notes_broadcast ON public.notes;
    CREATE TRIGGER notes_broadcast
      AFTER INSERT OR UPDATE OR DELETE ON public.notes
      FOR EACH ROW EXECUTE FUNCTION public.broadcast_notes_change();
  END IF;
END $$;
--> statement-breakpoint
-- 2. Channel-layer gating on realtime.messages (template:
--    realtime-messages-policy.sql). A subscriber reads only their own
--    'notes:{auth.uid()}' topic; an owner additionally reads 'notes:all'
--    (checked via the subscriber's own profiles row — profiles_select_self
--    permits it, so no recursion). NEVER row-RLS a streamed table for delivery.
--    The DROP precedes the CREATE (template README's idempotency advice) so a
--    re-applied migration replaces the policy cleanly rather than erroring on a
--    duplicate name.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    DROP POLICY IF EXISTS "notes_read_own_topic" ON "realtime"."messages";
    EXECUTE 'CREATE POLICY "notes_read_own_topic" ON "realtime"."messages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
      realtime.topic() = ''notes:'' || (select auth.uid())::text
      OR (
        realtime.topic() = ''notes:all''
        AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = ''owner'')
      )
    )';
  END IF;
END $$;
