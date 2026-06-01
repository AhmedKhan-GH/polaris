ALTER TABLE "sign_in_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sign_in_log" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sign_in_log" ADD COLUMN "success" boolean NOT NULL;