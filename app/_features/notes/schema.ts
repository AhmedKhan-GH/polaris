import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `notes` — a narrow, IMMUTABLE annotation primitive: an authored title + body,
 * written once and never edited (a correction is simply a new note). There is no
 * version chain — the append-only record of annotations is the sequence of notes
 * themselves. Kept deliberately generic so it can be the FK TARGET other features
 * link to (e.g. a future `order_notes` link table); `notes` knows about no domain,
 * so the dependency only ever points inward at it.
 *
 * `created_by` is a bare uuid (no FK to auth.users) so the table applies to a
 * vanilla Postgres container; RLS is enabled here, and the ownership policy + grant
 * are hand-written in the migration (drizzle/0003), not this slice.
 */
export const notes = pgTable('notes', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by').notNull(),
  title: text('title').notNull().default(''),
  body: text('body').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();
