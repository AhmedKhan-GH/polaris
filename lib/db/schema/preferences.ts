import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `user_preferences` — per-account display preferences (ADR-0009). An
 * identity-adjacent FOUNDATION slice: every feature formats timestamps through
 * getPreferences(), so this is cross-cutting and cannot be a business feature
 * (Iron Rule 2). One row per user, keyed by the mirrored auth user id.
 *
 * Shape choices mirror the other foundation slices (identity, audit):
 * - `userId` (SQL `user_id`) is a bare uuid PRIMARY KEY with NO FK to
 *   `auth.users`. The app mirrors the auth id in; the link is enforced at the
 *   RLS layer, so the table applies to a vanilla Postgres container.
 * - RLS is enabled here so it travels with the schema. The SELF-WRITE POLICY and
 *   the SELECT/INSERT/UPDATE GRANT are NOT declared in this slice — they target
 *   `app_user` and read the `app.user_id` GUC (runtime concerns), and declaring
 *   them would make `db:generate` re-emit (and drift from) them. They live
 *   hand-written in the migration. See drizzle/0013_*.sql for the policy/grant.
 */
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey(),
  timezone: text('timezone').notNull().default('UTC'),
  hour12: boolean('hour12').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
