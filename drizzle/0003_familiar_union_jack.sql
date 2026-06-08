-- USING added by hand: bigint (unix seconds) → timestamptz is not an automatic cast.
ALTER TABLE "orders" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING to_timestamp("created_at");--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sign_in_log" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING to_timestamp("created_at");--> statement-breakpoint
ALTER TABLE "sign_in_log" ALTER COLUMN "created_at" SET DEFAULT now();