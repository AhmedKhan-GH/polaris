CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Owner-only read of the event log (mirrors sign_in_log, drizzle/0002): true only
-- when app.user_roles is present, non-empty, and contains "owner". A missing/empty
-- GUC makes the cast NULL and coalesce returns false ⇒ DENY. Fails CLOSED. The JSONB
-- containment matches whole array ELEMENTS, so it is delimiter-injection-proof.
--
-- WITH CHECK (true): an authorized action (createOrder/transitionOrder) appends its
-- event from inside the caller's context — the action is the write gate (it already
-- proved the caller may mutate the order), so the INSERT itself must not be role-gated.
CREATE POLICY "order_events_owner_read" ON "order_events" AS PERMISSIVE FOR ALL TO "app_user"
  USING (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false))
  WITH CHECK (true);--> statement-breakpoint
-- SELECT (owner-gated by the policy) + INSERT (the append) only. UPDATE/DELETE are
-- deliberately withheld: the event log is append-only, so no role — not even app_user
-- — may rewrite or erase a recorded event.
GRANT SELECT, INSERT ON "order_events" TO "app_user";