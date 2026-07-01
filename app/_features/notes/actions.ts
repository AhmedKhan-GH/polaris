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
 * A note's editable content, validated at the action boundary. Title and body are
 * each optional strings (an empty title renders as "Untitled"), but a note may not
 * be BOTH blank — a fully empty save is rejected before any DB write.
 */
const noteInput = z
  .object({
    title: z.string().max(200, 'Title too long'),
    body: z.string().max(20000, 'Note body too long'),
  })
  .refine((v) => v.title.trim().length > 0 || v.body.trim().length > 0, {
    message: 'A note needs a title or body',
  });

export type NoteRow = {
  id: string;
  createdBy: string;
  title: string;
  body: string;
  createdAt: Date;
};

export type NoteVersionRow = {
  id: string;
  seq: number;
  title: string;
  body: string;
  editedBy: string;
  createdAt: Date;
};

/**
 * Read the caller's visible notes, newest first (CASL `read Note` + RLS). Title +
 * body are the current-content projection, kept in sync by the write-through below.
 */
export async function getNotes(): Promise<NoteRow[]> {
  return withPermission('read', 'Note', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select({
          id: notes.id,
          createdBy: notes.createdBy,
          title: notes.title,
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
 * source (and restore/`.txt` source). Each version snapshots title + body. RLS
 * scopes it to notes the caller may see (the policy joins back to the parent note).
 */
export async function getNoteHistory(noteId: string): Promise<NoteVersionRow[]> {
  return withPermission('read', 'Note', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx
        .select({
          id: noteVersions.id,
          seq: noteVersions.seq,
          title: noteVersions.title,
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
 * `notes` projection AND its genesis `note_versions` row (`seq 1`, title + body)
 * together, so projection and chain never diverge. Pipeline order is contractual:
 * guard → limiter → validate → context, then revalidate.
 */
export async function createNote(formData: FormData): Promise<void> {
  await withPermission('create', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:create:${ctx.userId}`, async () => {
      const { title, body } = noteInput.parse({
        title: String(formData.get('title') ?? ''),
        body: String(formData.get('body') ?? ''),
      });
      await withUserContext(ctx, (tx) =>
        tx.transaction(async (t) => {
          const [row] = await t
            .insert(notes)
            .values({ createdBy: ctx.userId, title, body })
            .returning({ id: notes.id });
          await t
            .insert(noteVersions)
            .values({ noteId: row.id, seq: 1, title, body, editedBy: ctx.userId });
        }),
      );
    }),
  );

  revalidatePath('/notes');
}

/**
 * Edit a note: APPEND a new version (title + body snapshot; never mutate history)
 * and update the current projection, in one transaction. `seq` is the note's
 * current max + 1. RLS forbids editing another user's note (the `note_versions`
 * WITH CHECK requires the parent be the caller's own), so this fails closed.
 */
export async function editNote(noteId: string, title: string, body: string): Promise<void> {
  await withPermission('update', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:edit:${ctx.userId}`, async () => {
      const parsed = noteInput.parse({ title, body });
      await withUserContext(ctx, (tx) =>
        tx.transaction(async (t) => {
          const [{ next }] = await t
            .select({ next: sql<number>`coalesce(max(${noteVersions.seq}), 0) + 1` })
            .from(noteVersions)
            .where(eq(noteVersions.noteId, noteId));
          await t
            .update(notes)
            .set({ title: parsed.title, body: parsed.body })
            .where(eq(notes.id, noteId));
          await t.insert(noteVersions).values({
            noteId,
            seq: Number(next),
            title: parsed.title,
            body: parsed.body,
            editedBy: ctx.userId,
          });
        }),
      );
    }),
  );

  revalidatePath('/notes');
}

/**
 * Form adapter for the editor's Save and a version Restore: reads `noteId`,
 * `title`, `body` from the submitted form and delegates to `editNote` (append a
 * version). Thin on purpose — `editNote` stays the single tested edit path.
 */
export async function saveNote(formData: FormData): Promise<void> {
  await editNote(
    String(formData.get('noteId') ?? ''),
    String(formData.get('title') ?? ''),
    String(formData.get('body') ?? ''),
  );
}
