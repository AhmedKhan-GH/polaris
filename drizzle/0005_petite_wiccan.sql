CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- IAM foundation: creator-scoped organization reads until memberships land.
-- This table is queried through the Drizzle/app_user path, so the policy reads
-- the transaction-scoped app.user_id GUC set by withUserContext.
CREATE POLICY "organizations_creator_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (
    "organizations"."created_by" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
GRANT SELECT ON "organizations" TO "app_user";
