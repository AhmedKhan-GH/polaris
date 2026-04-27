DROP INDEX IF EXISTS "orders_active_idx";--> statement-breakpoint
DROP TRIGGER IF EXISTS "orders_forward_status" ON "orders";--> statement-breakpoint
DROP FUNCTION IF EXISTS enforce_forward_status();--> statement-breakpoint
ALTER TYPE "public"."order_status" RENAME TO "order_status__old";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'submitted', 'invoiced', 'archiving', 'archived', 'deleted', 'cancelled', 'voided');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "order_status" USING ("status"::text::"order_status");--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "from_status" TYPE "order_status" USING ("from_status"::text::"order_status");--> statement-breakpoint
ALTER TABLE "order_status_history" ALTER COLUMN "to_status" TYPE "order_status" USING ("to_status"::text::"order_status");--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "public"."order_status__old";
