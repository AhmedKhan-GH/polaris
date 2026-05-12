-- Link profiles to Supabase auth so only real users get rows.
ALTER TABLE profiles
  ADD CONSTRAINT profiles_id_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on all application tables.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_counts ENABLE ROW LEVEL SECURITY;

-- Returns the role of the authenticated user, or NULL if no profile.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- profiles: any profiled user can read all profiles.
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (current_user_role() IS NOT NULL);

-- orders: profiled users get full read/write.
CREATE POLICY orders_select ON orders
  FOR SELECT
  USING (current_user_role() IS NOT NULL);

CREATE POLICY orders_insert ON orders
  FOR INSERT
  WITH CHECK (current_user_role() IS NOT NULL);

CREATE POLICY orders_update ON orders
  FOR UPDATE
  USING (current_user_role() IS NOT NULL);

-- order_status_history: profiled users can read and append.
CREATE POLICY osh_select ON order_status_history
  FOR SELECT
  USING (current_user_role() IS NOT NULL);

CREATE POLICY osh_insert ON order_status_history
  FOR INSERT
  WITH CHECK (current_user_role() IS NOT NULL);

-- order_status_counts: read-only for profiled users.
-- Writes happen via trigger (runs as table owner, bypasses RLS).
CREATE POLICY osc_select ON order_status_counts
  FOR SELECT
  USING (current_user_role() IS NOT NULL);
