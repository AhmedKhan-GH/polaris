import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * IAM foundation: root organization tenant entity.
 *
 * Until memberships land, organization visibility is creator-scoped through the
 * app_user/GUC RLS path: a caller may read only rows whose `created_by` matches
 * `app.user_id`. Policy and grants live in the generated migration so they stay
 * aligned with the runtime role and the RLS integration test.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
