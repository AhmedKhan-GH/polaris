'use server';

import { desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { noteVersions, notes } from './schema';

/**
 * Write budget for notes, OWNED by this feature (Charter D6): 30 writes / 60s
 * per acting user. Shared by every note write (create + edit).
 */
const notesWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

/**
 * The note body, validated at the action boundary. Blank/oversized is rejected
 * before any DB write; messages surface to the caller verbatim.
 */
const bodySchema = z.string().min(1, 'Note body is required').max(20000, 'Note body too long');

export type NoteRow = {
  id: string;
  createdBy: string;
  body: string;
  createdAt: Date;
};

export type NoteVersionRow = {
  id: string;
  seq: number;
  body: string;
  editedBy: string;
  createdAt: Date;
};

/**
 * Read the caller's visible notes, newest first (CASL `read Note` + RLS). `body`
 * is the current-content projection (kept in sync by the write-through below);
 * the contract is unchanged during the expand phase.
 */
export async function getNotes(): Promise<NoteRow[]> {
  return withPermission('read', 'Note', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select({
          id: notes.id,
          createdBy: notes.createdBy,
          body: notes.body,
          createdAt: notes.createdAt,
        })
        .from(notes)
        .orderBy(desc(notes.createdAt)),
    ),
  );
}

/**
 * The append-only version chain of one note, newest first — the History panel's
 * source, and the `.txt`/restore source. RLS scopes it to notes the caller may
 * see (the `note_versions` policy joins back to the parent note).
 */
export async function getNoteHistory(noteId: string): Promise<NoteVersionRow[]> {
  return withPermission('read', 'Note', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select({
          id: noteVersions.id,
          seq: noteVersions.seq,
          body: noteVersions.body,
          editedBy: noteVersions.editedBy,
          createdAt: noteVersions.createdAt,
        })
        .from(noteVersions)
        .where(eq(noteVersions.noteId, noteId))
        .orderBy(desc(noteVersions.seq)),
    ),
  );
}

/**
 * Create a note owned by the acting user. Write-through, one transaction: the
 * `notes` row (current-content projection) AND its genesis `note_versions` row
 * (`seq 1`) are written together, so the projection and the version chain can
 * never diverge (ADR-0007 load → apply → save). Pipeline order is contractual:
 * guard → limiter → validate → context, then revalidate.
 */
export async function createNote(formData: FormData): Promise<void> {
  await withPermission('create', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:create:${ctx.userId}`, async () => {
      const body = bodySchema.parse(String(formData.get('body') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.transaction(async (t) => {
          const [row] = await t
            .insert(notes)
            .values({ createdBy: ctx.userId, body })
            .returning({ id: notes.id });
          await t
            .insert(noteVersions)
            .values({ noteId: row.id, seq: 1, body, editedBy: ctx.userId });
        }),
      );
    }),
  );

  revalidatePath('/notes');
}

/**
 * Edit a note: APPEND a new version (never mutate history) and update the
 * current-content projection, in one transaction. `seq` is the note's current
 * max + 1. RLS forbids editing another user's note (the `note_versions` WITH
 * CHECK requires the parent be the caller's own), so this fails closed.
 */
export async function editNote(noteId: string, body: string): Promise<void> {
  await withPermission('update', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:edit:${ctx.userId}`, async () => {
      const parsed = bodySchema.parse(body);
      await withUserContext(ctx, (tx) =>
        tx.transaction(async (t) => {
          const [{ next }] = await t
            .select({ next: sql<number>`coalesce(max(${noteVersions.seq}), 0) + 1` })
            .from(noteVersions)
            .where(eq(noteVersions.noteId, noteId));
          await t.update(notes).set({ body: parsed }).where(eq(notes.id, noteId));
          await t
            .insert(noteVersions)
            .values({ noteId, seq: Number(next), body: parsed, editedBy: ctx.userId });
        }),
      );
    }),
  );

  revalidatePath('/notes');
}
