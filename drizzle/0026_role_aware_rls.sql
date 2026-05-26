-- Replace blanket "TO authenticated USING (true)" policies with
-- role-aware policies that read the app role from the JWT claim
-- (auth.jwt() ->> 'user_role'). This closes the security gap where
-- any authenticated user could read/write any row via direct Supabase
-- REST calls, bypassing app-layer CASL checks.
--
-- The access token hook must set 'user_role' in the JWT for these
-- policies to work. If the claim is missing, the role resolves to NULL
-- and no policy matches — fail-closed by default.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN

    -- ================================================================
    -- PROFILES
    -- ================================================================
    DROP POLICY IF EXISTS profiles_select ON profiles;

    -- Everyone can read their own profile
    CREATE POLICY profiles_select_own ON profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid());

    -- Owner and admin can read all profiles (team management)
    CREATE POLICY profiles_select_admin ON profiles
      FOR SELECT TO authenticated
      USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'system'));

    -- ================================================================
    -- ORDERS
    -- ================================================================
    DROP POLICY IF EXISTS orders_select ON orders;
    DROP POLICY IF EXISTS orders_insert ON orders;
    DROP POLICY IF EXISTS orders_update ON orders;

    -- SELECT: internal roles see all rows
    CREATE POLICY orders_select_internal ON orders
      FOR SELECT TO authenticated
      USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system'));

    -- SELECT: guests see only rows they created
    CREATE POLICY orders_select_guest ON orders
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND created_by = auth.uid()
      );

    -- INSERT: roles that can create orders, must set created_by to self
    CREATE POLICY orders_insert ON orders
      FOR INSERT TO authenticated
      WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
        AND created_by = auth.uid()
      );

    -- UPDATE: owner/admin can update any order
    CREATE POLICY orders_update_privileged ON orders
      FOR UPDATE TO authenticated
      USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin'));

    -- UPDATE: member can update only their own orders
    CREATE POLICY orders_update_member ON orders
      FOR UPDATE TO authenticated
      USING (
        (auth.jwt() ->> 'user_role') = 'member'
        AND created_by = auth.uid()
      );

    -- UPDATE: guest can update only their own drafted orders
    CREATE POLICY orders_update_guest ON orders
      FOR UPDATE TO authenticated
      USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND created_by = auth.uid()
        AND status = 'drafted'
      );

    -- ================================================================
    -- ORDER STATUS HISTORY
    -- ================================================================
    DROP POLICY IF EXISTS osh_select ON order_status_history;
    DROP POLICY IF EXISTS osh_insert ON order_status_history;

    -- SELECT: same visibility as orders — internal roles see all
    CREATE POLICY osh_select_internal ON order_status_history
      FOR SELECT TO authenticated
      USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system'));

    -- SELECT: guests see history for their own orders only
    CREATE POLICY osh_select_guest ON order_status_history
      FOR SELECT TO authenticated
      USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND order_id IN (
          SELECT id FROM orders WHERE created_by = auth.uid()
        )
      );

    -- INSERT: roles that can transition or discard
    CREATE POLICY osh_insert ON order_status_history
      FOR INSERT TO authenticated
      WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
      );

    -- ================================================================
    -- ORDER STATUS COUNTS (read-only aggregate, safe for all)
    -- ================================================================
    -- No change needed — keep existing policy
    -- osc_select: FOR SELECT TO authenticated USING (true)

    -- ================================================================
    -- REALTIME MESSAGES (no change)
    -- ================================================================
    -- realtime_messages_select stays as-is

  END IF;
END $$;
