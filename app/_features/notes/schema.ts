import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * DISPOSABLE EXEMPLAR — Domain Charter §4. `notes` is the copy-paste template a
 * real feature is cloned from: it shows the canonical shape of an owned,
 * RLS-protected resource (schema slice here + hand-written policy/grants in the
 * migration + an ownership integration suite). It carries NO product meaning.
 * Deleting this feature — this slice, its line in `lib/registry/schema.ts`, its
 * `drizzle/0003_*.sql` migration — must leave the foundation green; nothing in
 * `lib/` may ever depend on it.
 *
 * Shape choices:
 * - `createdBy` (SQL `created_by`) is a bare uuid with NO FK to `auth.users`:
 *   like the other slices, the app mirrors the auth user id in, and the link is
 *   enforced at the RLS layer, so the table applies cleanly to a vanilla
 *   Postgres container (which has no `auth` schema).
 * - RLS is enabled here so it travels with the schema. The ownership POLICY and
 *   the SELECT/INSERT/UPDATE/DELETE GRANT are NOT declared in this slice — they
 *   target the `app_user` role and read the `app.user_id` / `app.user_roles`
 *   GUCs (runtime concerns), and declaring them here would make `db:generate`
 *   re-emit (and drift from) them. They live hand-written, UNGUARDED, in
 *   drizzle/0003_*.sql — both `app_user` and those GUCs exist on BOTH targets
 *   (vanilla container and live stack). See that migration for the authoritative
 *   policy/grant.
 */
export const notes = pgTable('notes', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
