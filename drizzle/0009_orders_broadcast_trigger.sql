-- Custom SQL migration file, put your code below! --

-- Broadcast each orders change to its owner's private topic (and a global owner
-- firehose). SECURITY DEFINER so app_user's insert can reach the realtime schema.
-- Per-user realtime is enforced at the CHANNEL layer (realtime.messages policy +
-- this topic routing) because the Postgres-Changes row authorizer can't read our
-- app.user_id GUC (see drizzle/0021 history on branch main). Guarded so vanilla
-- Postgres (the RLS testcontainer harness / CI) still applies the rest of the set.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN

    CREATE OR REPLACE FUNCTION public.broadcast_order_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, realtime
    AS $fn$
    DECLARE
      owner_id uuid := coalesce(NEW.created_by, OLD.created_by);
    BEGIN
      PERFORM realtime.broadcast_changes(
        'orders:' || owner_id::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      PERFORM realtime.broadcast_changes(
        'orders:all', TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD);
      RETURN NULL;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS orders_broadcast ON public.orders;
    CREATE TRIGGER orders_broadcast
      AFTER INSERT OR UPDATE OR DELETE ON public.orders
      FOR EACH ROW EXECUTE FUNCTION public.broadcast_order_change();

  END IF;
END $$;
