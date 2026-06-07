CREATE ROLE "app_user";--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "orders_owner_or_self" ON "orders" AS PERMISSIVE FOR ALL TO "app_user" USING ("orders"."created_by" = current_setting('app.user_id', true)::uuid
        OR 'owner' = ANY(string_to_array(current_setting('app.user_roles', true), ','))) WITH CHECK ("orders"."created_by" = current_setting('app.user_id', true)::uuid);--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "app_user";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "orders" TO "app_user";