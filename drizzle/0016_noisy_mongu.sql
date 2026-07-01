CREATE TABLE "note_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"body" text NOT NULL,
	"edited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_versions_note_seq_unique" UNIQUE("note_id","seq")
);
--> statement-breakpoint
ALTER TABLE "note_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: seed one genesis version (seq 1) per existing note from its current
-- body, so no note loses content when the version chain becomes the source of
-- truth. Runs as the privileged migrate role (bypasses RLS), before the grant.
INSERT INTO "note_versions" ("note_id", "seq", "body", "edited_by", "created_at")
  SELECT "id", 1, "body", "created_by", "created_at" FROM "notes";--> statement-breakpoint
-- Ownership derives from the parent note (like order_lines → orders). Hand-written
-- here, not in the schema slice, so `db:generate` doesn't re-emit/drift.
-- USING (read): the parent note is visible to the caller — own row OR "owner" role
-- (fails closed with no identity; delimiter-injection-proof via jsonb @>).
-- WITH CHECK (write): NO owner branch — a version may only be appended to the
-- caller's OWN note; owner is read-all, never write-as-anyone.
CREATE POLICY "note_versions_via_note" ON "note_versions" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    EXISTS (
      SELECT 1 FROM "notes" n
      WHERE n."id" = "note_versions"."note_id"
        AND (
          n."created_by" = current_setting('app.user_id', true)::uuid
          OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "notes" n
      WHERE n."id" = "note_versions"."note_id"
        AND n."created_by" = current_setting('app.user_id', true)::uuid
    )
  );--> statement-breakpoint
-- Append-only by grant: SELECT + INSERT only, NO UPDATE/DELETE — content history
-- is immutable (mirrors sign_in_log / order_events). The policy above scopes rows.
GRANT SELECT, INSERT ON "note_versions" TO "app_user";