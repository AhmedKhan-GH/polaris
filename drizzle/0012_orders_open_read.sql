-- Open READ access to orders (and their line items) for now: every signed-in
-- `app_user` may SELECT every order and every line, regardless of who created it
-- or what status it's in. A deliberate, TEMPORARY simplification — the CASL twin
-- (`ordersAbilities`) opens `read Order` to match.
--
-- WRITE policies are intentionally untouched: a member still writes only their
-- own `draft`, owner/admin any non-terminal order, and terminal orders stay
-- frozen for everyone. Read-all never becomes write-as-anyone.
--
-- This replaces the own-or-owner/admin read on `orders` and the parent-derived
-- read on `order_lines`. The latter re-derived line visibility from the parent
-- order, the source of the "an admin can see a cancelled order but not its
-- lines" asymmetry; an unconditional SELECT removes it. `DROP ... IF EXISTS` so
-- the migration is safe to apply over a drifted dev database.
DROP POLICY IF EXISTS "orders_read_own_or_privileged" ON "orders";
--> statement-breakpoint
CREATE POLICY "orders_read_all" ON "orders" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (true);
--> statement-breakpoint
DROP POLICY IF EXISTS "order_lines_read_via_parent" ON "order_lines";
--> statement-breakpoint
CREATE POLICY "order_lines_read_all" ON "order_lines" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (true);
