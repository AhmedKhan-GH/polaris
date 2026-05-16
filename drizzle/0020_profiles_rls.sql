-- RLS and profile-gated access policies.
-- Guarded so the migration runs on both Supabase (has auth schema)
-- and plain Postgres (integration tests via testcontainers).

DO $$ BEGIN
  -- FK to auth.users only exists in Supabase environments.
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fk
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_counts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- auth.uid() only exists in Supabase. Skip function + policies on
  -- plain Postgres so integration tests can run without RLS.
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.current_user_role()
      RETURNS user_role
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT role FROM profiles WHERE id = auth.uid();
      $body$;
    $fn$;

    CREATE POLICY profiles_select ON profiles
      FOR SELECT USING (current_user_role() IS NOT NULL);

    CREATE POLICY orders_select ON orders
      FOR SELECT USING (current_user_role() IS NOT NULL);

    CREATE POLICY orders_insert ON orders
      FOR INSERT WITH CHECK (current_user_role() IS NOT NULL);

    CREATE POLICY orders_update ON orders
      FOR UPDATE USING (current_user_role() IS NOT NULL);

    CREATE POLICY osh_select ON order_status_history
      FOR SELECT USING (current_user_role() IS NOT NULL);

    CREATE POLICY osh_insert ON order_status_history
      FOR INSERT WITH CHECK (current_user_role() IS NOT NULL);

    CREATE POLICY osc_select ON order_status_counts
      FOR SELECT USING (current_user_role() IS NOT NULL);
  END IF;
END $$;
