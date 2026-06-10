-- D7 template: per-user broadcast trigger (ADR-0002).
-- Usage: copy into a `drizzle-kit generate --custom` migration; replace $DOMAIN (topic prefix)
-- and $TABLE (streamed table). Executable verification arrives with the feature's live
-- integration test — this file is inert documentation until instantiated.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    CREATE OR REPLACE FUNCTION public.broadcast_$DOMAIN_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, realtime
    AS $fn$
    DECLARE
      owner_id uuid := coalesce(NEW.created_by, OLD.created_by);
    BEGIN
      PERFORM realtime.broadcast_changes('$DOMAIN:' || owner_id::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      PERFORM realtime.broadcast_changes('$DOMAIN:all', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      RETURN NULL;
    END;
    $fn$;
    DROP TRIGGER IF EXISTS $DOMAIN_broadcast ON public.$TABLE;
    CREATE TRIGGER $DOMAIN_broadcast
      AFTER INSERT OR UPDATE OR DELETE ON public.$TABLE
      FOR EACH ROW EXECUTE FUNCTION public.broadcast_$DOMAIN_change();
  END IF;
END $$;
