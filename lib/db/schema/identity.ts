import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `profiles` — the role source of truth (Domain Charter §3, identity slice).
 *
 * Deliberate shape choices:
 * - `id` is a bare uuid PRIMARY KEY with NO default and NO FK to `auth.users`.
 *   The application mirrors the Supabase auth user id into it; keeping the column
 *   FK-free lets this table (and its migration) apply to a vanilla Postgres
 *   container that has no `auth` schema, which is what the migration smoke test
 *   exercises. The link to auth is enforced at the application/RLS layer, not by
 *   a cross-schema constraint.
 * - RLS is enabled here so it travels with the schema. The self-read POLICY and
 *   the write-lock GRANT/REVOKE are NOT declared in this slice: they reference
 *   `auth.uid()` and the Supabase `authenticated`/`anon` roles, which only exist
 *   on the real stack. They live hand-written behind `auth`-schema guards in
 *   drizzle/0001_*.sql so the migration no-ops cleanly on a vanilla container.
 *   Declaring them here would make `db:generate` re-emit them UNGUARDED, drifting
 *   from that hand-edited migration — so the slice intentionally stays silent on
 *   them. See drizzle/0001_*.sql for the authoritative policy/grant/revoke.
 */
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
