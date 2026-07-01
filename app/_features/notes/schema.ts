import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * `notes` — graduating from the Charter §4 disposable exemplar into a real,
 * FK-able backbone (spec: docs/superpowers/specs/2026-06-30-note-versioning-design.md).
 * A note is an identity + metadata anchor; its CONTENT is an append-only
 * version chain in `note_versions`.
 *
 * TRANSITION NOTE: `body` is retained for now as the current-content projection so
 * the existing read path + realtime broadcast keep working (expand→migrate→contract).
 * Once the editor reads from `note_versions`, a later migration drops `body` and the
 * note row becomes pure identity/metadata. `body` is NOT the design end-state.
 *
 * Shape choices (unchanged): `created_by` is a bare uuid (no FK to auth.users);
 * RLS is enabled here, the ownership policy + grant are hand-written in the
 * migration (drizzle/0003 for `notes`; the new one for `note_versions`).
 */
export const notes = pgTable('notes', {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .default(sql`gen_random_uuid()`),
  createdBy: uuid('created_by').notNull(),
  // Current title + body projection (transitional, like `body` — see note above).
  // Both are versioned in `note_versions`; empty title renders as "Untitled".
  title: text('title').notNull().default(''),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}).enableRLS();

/**
 * `note_versions` — the append-only content history of a note (ADR-0007 document
 * versioning). Each row is a full body SNAPSHOT at one edit; `seq` orders them
 * (genesis = 1) and the max `seq` per note is the current content. There is no
 * `type` and no delta — a note is *defined by* its versions.
 *
 * Access derives from the parent `notes` row (like `order_lines` → `orders`): the
 * hand-written RLS policy joins back to `notes`, so this table has no `created_by`
 * of its own (it has `edited_by`, the author of THIS version). Immutability is
 * enforced by the GRANT — `SELECT, INSERT` only, NO UPDATE/DELETE — hand-written
 * in the migration, exactly like `sign_in_log` / `order_events`.
 */
export const noteVersions = pgTable(
  'note_versions',
  {
    id: uuid('id')
      .primaryKey()
      .notNull()
      .default(sql`gen_random_uuid()`),
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    // A version is the whole document at one edit — title AND body snapshot together,
    // so a rename is captured in history exactly like a body edit.
    title: text('title').notNull().default(''),
    body: text('body').notNull(),
    editedBy: uuid('edited_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [unique('note_versions_note_seq_unique').on(table.noteId, table.seq)],
).enableRLS();
