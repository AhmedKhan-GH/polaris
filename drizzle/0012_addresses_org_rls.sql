CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"label" text NOT NULL,
	"raw_address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Addresses are org-owned map pins. app_user can touch the table, but RLS
-- keeps every read/write inside the active withOrgContext transaction.
CREATE POLICY "addresses_org_rw" ON "addresses" AS PERMISSIVE FOR ALL TO "app_user"
  USING ("addresses"."org_id" = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK ("addresses"."org_id" = nullif(current_setting('app.org_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "addresses" TO "app_user";
