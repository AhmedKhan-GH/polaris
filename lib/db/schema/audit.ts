import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `sign_in_log` — an append-only audit fact: one row per SUCCESSFUL sign-in
 * (observability slice). The recorder writes a row only after authentication
 * has already succeeded, so EVERY row here represents a successful login —
 * there is deliberately NO `success` column to record failures. Failed/aborted
 * sign-ins are an operational signal for the logger, not a durable fact for
 * this table.
 *
 * Shape choices:
 * - `userId` is nullable: a sign-in can be observed before (or without) a
 *   resolved profile id, but the `email` that was used is always known.
 * - RLS is enabled here so it travels with the schema. The owner-only read
 *   POLICY and the SELECT/INSERT GRANT are NOT declared in this slice — they
 *   target the `app_user` role and read the `app.user_roles` GUC, which are
 *   runtime/role concerns. They live hand-written in drizzle/0002_*.sql so
 *   `db:generate` does not re-emit (and drift from) them. See that migration
 *   for the authoritative policy/grant.
 */
export const signInLog = pgTable('sign_in_log', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id'),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
