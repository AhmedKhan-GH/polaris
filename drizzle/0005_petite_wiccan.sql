CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Only the creator can read their org for M1.
CREATE POLICY "organizations_creator_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (
    "organizations"."created_by" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
-- Keep this read-only until the app needs org writes.
GRANT SELECT ON "organizations" TO "app_user";
