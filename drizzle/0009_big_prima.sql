-- This migration updates the memberships table to use a new enum type for roles, and adds RLS policies to enforce that only org creators can create orgs and assign themselves as org_admin.
ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE text USING (
  CASE "role"::text
    WHEN 'admin' THEN 'org_admin'
    WHEN 'member' THEN 'org_member'
    ELSE "role"::text
  END
);
-- The above SQL command alters the "memberships" table by changing the data type of the "role" column to text.
-- It also includes a USING clause that converts existing values in the "role" column from 'admin' to 'org_admin' and from 'member' to 'org_member'.
-- This is necessary to prepare for the next step, which will change the data type to an enum that only allows 'org_admin' and 'org_member' as valid values.

DROP TYPE "public"."org_roles";

CREATE TYPE "public"."org_roles" AS ENUM('org_admin', 'org_member');

ALTER TABLE "memberships" ALTER COLUMN "role" SET DATA TYPE "public"."org_roles" USING "role"::"public"."org_roles";

-- The creator of an org can only create orgs where they are the creator, and can only assign themselves as org_admin for those orgs.
CREATE POLICY "organizations_creator_insert" ON "organizations" AS PERMISSIVE FOR INSERT TO "app_user"
  WITH CHECK ("organizations"."created_by" = current_setting('app.user_id', true)::uuid);

-- Grant insert on organizations to app_user so that they can create orgs and trigger the RLS policy.
GRANT INSERT ON "organizations" TO "app_user";


-- This function checks if a given user is the creator of a given org, and is used in the memberships insert policy to ensure that only org creators can assign themselves as org_admin for their org.
CREATE OR REPLACE FUNCTION is_org_creator(org_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = $1
      AND organizations.created_by = $2
  );
$$;

-- The creator can only make themself org_admin for their new org.
CREATE POLICY "memberships_creator_admin_insert" ON "memberships" AS PERMISSIVE FOR INSERT TO "app_user"
  WITH CHECK (
    "memberships"."user_id" = current_setting('app.user_id', true)::uuid
    AND "memberships"."role" = 'org_admin'
    AND is_org_creator("memberships"."org_id", current_setting('app.user_id', true)::uuid)
  );
