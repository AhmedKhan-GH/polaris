CREATE OR REPLACE FUNCTION get_my_org_ids(user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
SELECT org_id FROM memberships WHERE user_id = $1;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON "memberships" TO "app_user";

ALTER POLICY "member_read" ON "memberships" TO app_user USING (org_id IN (SELECT get_my_org_ids(current_setting('app.user_id', true)::uuid)));

DROP POLICY "organizations_creator_read" ON "organizations";

CREATE POLICY "organizations_member_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "app_user" USING ("organizations"."id" IN (SELECT get_my_org_ids(current_setting('app.user_id', true)::uuid)));