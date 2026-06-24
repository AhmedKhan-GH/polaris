-- Migration for IAM 7: listOrgMembers.
-- Allows app_user to read profile emails only for the active org context.
-- Applied by the normal migration command: npm run db:migrate

GRANT SELECT ON "profiles" TO "app_user";
--> statement-breakpoint
CREATE POLICY "profiles_org_member_read" ON "profiles" AS PERMISSIVE FOR SELECT TO "app_user"
  USING (
    EXISTS (
      SELECT 1
      FROM "memberships"
      WHERE "memberships"."user_id" = "profiles"."id"
        AND "memberships"."org_id" = nullif(current_setting('app.org_id', true), '')::uuid
    )
  );
