-- orders UPDATE RLS (status transitions). The header has no editable content
-- besides status/status_updated_at, so every UPDATE is a transition. RLS gates
-- ROW ACCESS (who may touch which order); the legal target status is enforced by
-- the guarded action (canTransition / VALID_TRANSITIONS), not encoded here.
--
-- USING: a member may update their OWN order while draft/submitted (submit,
-- recall, cancel); owner/admin may update ANY non-terminal order. Terminal
-- orders (completed/cancelled) match no branch → frozen for everyone.
--
-- WITH CHECK: the new row must stay owned by the member (no ownership theft);
-- owner/admin may write regardless. Target status is NOT constrained here (cancel
-- legitimately writes a terminal state) — that's the action's job.
CREATE POLICY "orders_update_writer" ON "orders" AS PERMISSIVE FOR UPDATE TO "app_user"
  USING (
    ("orders"."created_by" = current_setting('app.user_id', true)::uuid
       AND "orders"."status" in ('draft', 'submitted'))
    OR (
      (coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
       OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false))
      AND "orders"."status" not in ('completed', 'cancelled')
    )
  )
  WITH CHECK (
    "orders"."created_by" = current_setting('app.user_id', true)::uuid
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)
    OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["admin"]'::jsonb, false)
  );
--> statement-breakpoint
GRANT UPDATE ON "orders" TO "app_user";
