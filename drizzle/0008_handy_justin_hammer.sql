CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Reads auth.uid() and targets the `authenticated` role — both Supabase-only.
-- Guarded so vanilla Postgres (the RLS testcontainer harness / CI) still applies
-- the table and the rest of the migration set; grant authenticated SELECT so the
-- policy actually gates rows rather than the base privilege.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    GRANT SELECT ON "profiles" TO "authenticated";
    CREATE POLICY "profiles_select_self" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = auth.uid());
  END IF;
END $$;