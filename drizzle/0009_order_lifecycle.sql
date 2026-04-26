CREATE TYPE "public"."order_status" AS ENUM('draft', 'submitted', 'invoiced', 'archived', 'deleted', 'cancelled', 'voided');--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" "order_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "duplicated_from_order_id" uuid;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history" USING btree ("order_id","changed_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_duplicated_from_fk" FOREIGN KEY ("duplicated_from_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_active_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status IN ('draft', 'submitted', 'invoiced');--> statement-breakpoint
CREATE FUNCTION enforce_forward_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD.status = 'draft'     AND NEW.status IN ('submitted', 'deleted'))  OR
    (OLD.status = 'submitted' AND NEW.status IN ('invoiced',  'cancelled')) OR
    (OLD.status = 'invoiced'  AND NEW.status IN ('archived',  'voided'))
  ) THEN
    RAISE EXCEPTION 'Invalid order status transition: % -> %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER orders_forward_status
  BEFORE UPDATE OF status ON "orders"
  FOR EACH ROW EXECUTE FUNCTION enforce_forward_status();