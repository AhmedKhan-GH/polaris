ALTER TABLE "order_status_counts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "osc_select" ON "order_status_counts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "osh_select_internal" ON "order_status_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system'));--> statement-breakpoint
CREATE POLICY "osh_select_guest" ON "order_status_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND "order_status_history"."order_id" IN (
          SELECT id FROM orders WHERE created_by = auth.uid()
        )
      );--> statement-breakpoint
CREATE POLICY "osh_insert" ON "order_status_history" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
      );--> statement-breakpoint
CREATE POLICY "orders_select_internal" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member', 'system'));--> statement-breakpoint
CREATE POLICY "orders_select_guest" ON "orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND "orders"."created_by" = auth.uid()
      );--> statement-breakpoint
CREATE POLICY "orders_insert" ON "orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
        (auth.jwt() ->> 'user_role') IN ('guest', 'member', 'admin', 'owner')
        AND "orders"."created_by" = auth.uid()
      );--> statement-breakpoint
CREATE POLICY "orders_update_privileged" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin'));--> statement-breakpoint
CREATE POLICY "orders_update_member" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
        (auth.jwt() ->> 'user_role') = 'member'
        AND "orders"."created_by" = auth.uid()
      );--> statement-breakpoint
CREATE POLICY "orders_update_guest" ON "orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (
        (auth.jwt() ->> 'user_role') = 'guest'
        AND "orders"."created_by" = auth.uid()
        AND "orders"."status" = 'drafted'
      );--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = auth.uid());--> statement-breakpoint
CREATE POLICY "profiles_select_admin" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'system'));