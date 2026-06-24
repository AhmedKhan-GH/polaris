-- Migration for IAM 6: addMemberByEmail.
-- Adds the narrow profile lookup and org_admin-only membership insert policy.
-- Applied by the normal migration command: npm run db:migrate

-- Narrow profile lookup for addMemberByEmail.
CREATE OR REPLACE FUNCTION profile_id_for_email(email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM profiles
  WHERE lower(profiles.email) = lower($1)
  LIMIT 1;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION profile_id_for_email(text) TO "app_user";
--> statement-breakpoint
-- Org admins may add members only inside their current org context.
CREATE POLICY "memberships_org_admin_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO "app_user"
  WITH CHECK (
    "memberships"."org_id" = nullif(current_setting('app.org_id', true), '')::uuid
    AND current_setting('app.org_role', true) = 'org_admin'
  );
