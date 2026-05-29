ALTER TABLE "orders" ADD COLUMN "is_archived" boolean NOT NULL DEFAULT false;--> statement-breakpoint
UPDATE "orders" SET "is_archived" = true WHERE "status" = 'archived';--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_forward_status ON orders;--> statement-breakpoint
DROP TRIGGER IF EXISTS orders_sync_status_counts ON orders;--> statement-breakpoint
DROP INDEX IF EXISTS "orders_active_idx";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "from_status" TYPE text USING "from_status"::text;--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "to_status" TYPE text USING "to_status"::text;--> statement-breakpoint
DELETE FROM "order_status_counts";--> statement-breakpoint
ALTER TABLE "order_status_counts" ALTER COLUMN "status" TYPE text USING "status"::text;--> statement-breakpoint
DROP TYPE "order_status";--> statement-breakpoint
UPDATE "orders" SET "status" = 'closed' WHERE "status" = 'archived';--> statement-breakpoint
UPDATE "orders" SET "status" = 'cancelled' WHERE "status" IN ('discarded', 'rejected', 'voided');--> statement-breakpoint
UPDATE "orders" SET "status" = 'draft' WHERE "status" = 'drafted';--> statement-breakpoint
UPDATE "orders" SET "status" = 'confirmed' WHERE "status" = 'submitted';--> statement-breakpoint
UPDATE "orders" SET "status" = 'processing' WHERE "status" = 'invoiced';--> statement-breakpoint
UPDATE "order_status_history" SET "from_status" = CASE "from_status" WHEN 'drafted' THEN 'draft' WHEN 'submitted' THEN 'confirmed' WHEN 'invoiced' THEN 'processing' WHEN 'closed' THEN 'closed' WHEN 'archived' THEN 'closed' WHEN 'discarded' THEN 'cancelled' WHEN 'rejected' THEN 'cancelled' WHEN 'voided' THEN 'cancelled' ELSE "from_status" END, "to_status" = CASE "to_status" WHEN 'drafted' THEN 'draft' WHEN 'submitted' THEN 'confirmed' WHEN 'invoiced' THEN 'processing' WHEN 'closed' THEN 'closed' WHEN 'archived' THEN 'closed' WHEN 'discarded' THEN 'cancelled' WHEN 'rejected' THEN 'cancelled' WHEN 'voided' THEN 'cancelled' ELSE "to_status" END;--> statement-breakpoint
CREATE TYPE "order_status" AS ENUM ('draft', 'confirmed', 'processing', 'fulfilled', 'closed', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "order_status" USING "status"::"order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "from_status" TYPE "order_status" USING "from_status"::"order_status";--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "to_status" TYPE "order_status" USING "to_status"::"order_status";--> statement-breakpoint
ALTER TABLE "order_status_counts" ALTER COLUMN "status" TYPE "order_status" USING "status"::"order_status";--> statement-breakpoint
INSERT INTO "order_status_counts" (status, count) SELECT s, COALESCE(c.cnt, 0) FROM unnest(enum_range(NULL::"order_status")) AS s LEFT JOIN (SELECT status, COUNT(*)::bigint AS cnt FROM orders GROUP BY status) c ON c.status = s;--> statement-breakpoint
CREATE INDEX "orders_active_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE status IN ('draft', 'confirmed', 'processing', 'fulfilled');--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_forward_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF; IF NOT ((OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled')) OR (OLD.status = 'confirmed' AND NEW.status IN ('draft', 'processing', 'cancelled')) OR (OLD.status = 'processing' AND NEW.status IN ('fulfilled', 'cancelled')) OR (OLD.status = 'fulfilled' AND NEW.status IN ('closed', 'cancelled'))) THEN RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation'; END IF; RETURN NEW; END; $$;--> statement-breakpoint
CREATE TRIGGER orders_forward_status BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION enforce_forward_status();--> statement-breakpoint
CREATE OR REPLACE FUNCTION sync_order_status_counts() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP = 'INSERT' THEN UPDATE order_status_counts SET count = count + 1 WHERE status = NEW.status; ELSIF TG_OP = 'DELETE' THEN UPDATE order_status_counts SET count = GREATEST(count - 1, 0) WHERE status = OLD.status; ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN UPDATE order_status_counts SET count = GREATEST(count - 1, 0) WHERE status = OLD.status; UPDATE order_status_counts SET count = count + 1 WHERE status = NEW.status; END IF; RETURN NULL; END; $$;--> statement-breakpoint
CREATE TRIGGER orders_sync_status_counts AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION sync_order_status_counts();
