'use server';

import { desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { notes } from './schema';

/**
 * Write budget for notes, OWNED by this feature (Charter D6): 30 writes / 60s
 * per acting user. Notes are immutable, so the only write is create.
 */
const notesWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

/**
 * A note's content, validated at the action boundary. A title is REQUIRED
 * (trimmed, non-empty); the body is optional. Notes are write-once, so this runs
 * only on create.
 */
const noteInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  body: z.string().max(20000, 'Note body too long'),
});

export type NoteRow = {
  id: string;
  createdBy: string;
  title: string;
  body: string;
  createdAt: Date;
};

/**
 * Read the caller's visible notes, newest first (CASL `read Note` + RLS): a member
 * sees their own, an owner sees all. Both layers must pass to return a row.
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
 * Create an immutable note owned by the acting user. Pipeline order is
 * contractual: guard → limiter → validate → context. On success it redirects to
 * `/notes` (leaving create mode and landing on the freshly written note) — never
 * on a denied, throttled, or invalid call.
 */
export async function createNote(formData: FormData): Promise<void> {
  await withPermission('create', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:create:${ctx.userId}`, async () => {
      const { title, body } = noteInput.parse({
        title: String(formData.get('title') ?? ''),
        body: String(formData.get('body') ?? ''),
      });
      await withUserContext(ctx, (tx) =>
        tx.insert(notes).values({ createdBy: ctx.userId, title, body }),
      );
    }),
  );

  redirect('/notes');
}
