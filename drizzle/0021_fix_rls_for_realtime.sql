-- The original policies used current_user_role() which depends on
-- auth.uid() reading PostgREST GUC variables. Those variables are not
-- reliably set in the Supabase Realtime context, so realtime events
-- were silently filtered.
--
-- Fix: replace function-based policies with simple TO authenticated
-- checks, and enable private Realtime channels so the Realtime service
-- evaluates RLS using the subscriber's JWT (role = 'authenticated')
-- instead of defaulting to 'anon'. Private channels require a SELECT
-- policy on realtime.messages for the authenticated role.
--
-- Access control layering:
--   RLS  → blocks unauthenticated access (anon role denied)
--   App  → blocks profileless users (server component redirect)
--   App  → enforces role permissions (owner-only pages, etc.)

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    -- Drop old function-based policies
    DROP POLICY IF EXISTS profiles_select ON profiles;
    DROP POLICY IF EXISTS orders_select ON orders;
    DROP POLICY IF EXISTS orders_insert ON orders;
    DROP POLICY IF EXISTS orders_update ON orders;
    DROP POLICY IF EXISTS osh_select ON order_status_history;
    DROP POLICY IF EXISTS osh_insert ON order_status_history;
    DROP POLICY IF EXISTS osc_select ON order_status_counts;

    -- All policies use TO authenticated so anon is blocked everywhere
    CREATE POLICY profiles_select ON profiles
      FOR SELECT TO authenticated USING (true);

    CREATE POLICY orders_select ON orders
      FOR SELECT TO authenticated USING (true);

    CREATE POLICY orders_insert ON orders
      FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY orders_update ON orders
      FOR UPDATE TO authenticated USING (true);

    CREATE POLICY osh_select ON order_status_history
      FOR SELECT TO authenticated USING (true);

    CREATE POLICY osh_insert ON order_status_history
      FOR INSERT TO authenticated WITH CHECK (true);

    CREATE POLICY osc_select ON order_status_counts
      FOR SELECT TO authenticated USING (true);

    -- Private Realtime channels check realtime.messages RLS to
    -- authorize subscriptions. Without this policy, authenticated
    -- users cannot subscribe to any private channel.
    DROP POLICY IF EXISTS realtime_messages_select ON realtime.messages;
    CREATE POLICY realtime_messages_select ON realtime.messages
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
