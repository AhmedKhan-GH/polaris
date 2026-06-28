CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"hour12" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Self-write policy (ADR-0009). Hand-written here, not in the schema slice:
-- declaring it there would make `db:generate` re-emit (and drift from) it. NO
-- `auth`-schema guard — it targets `app_user` and the `app.user_id` GUC, both of
-- which exist on BOTH targets (the vanilla test container and the live stack), so
-- it is emitted unconditionally.
--
-- A user reads and writes ONLY their own row: `user_id` must equal the
-- `app.user_id` GUC for SELECT (USING) and for INSERT/UPDATE (WITH CHECK). There
-- is DELIBERATELY no owner branch — preferences are strictly personal; even an
-- owner never reads or writes another user's row. A missing/empty GUC makes
-- `current_setting(...,true)` NULL, so `user_id = NULL` is NULL ⇒ no rows: the
-- policy fails CLOSED.
CREATE POLICY "user_preferences_self" ON "user_preferences" AS PERMISSIVE FOR ALL TO "app_user"
  USING (
    "user_preferences"."user_id" = current_setting('app.user_id', true)::uuid
  )
  WITH CHECK (
    "user_preferences"."user_id" = current_setting('app.user_id', true)::uuid
  );
--> statement-breakpoint
-- SELECT/INSERT/UPDATE for app_user; the policy above scopes which row. No
-- DELETE — preferences are upserted (insert-or-update), never deleted; a user
-- without a row falls back to the UTC/24h defaults in getPreferences().
GRANT SELECT, INSERT, UPDATE ON "user_preferences" TO "app_user";