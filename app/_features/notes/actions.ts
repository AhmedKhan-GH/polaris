'use server';

import { desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withUserContext } from '@/lib/db/with-user-context';
import { withPermission } from '@/lib/permissions/guard';
import { createRateLimiter, withRateLimit } from '@/lib/rate-limit';

import { notes } from './schema';

/**
 * Write budget for notes, OWNED by this feature (Charter D6): the foundation
 * manufactures limiters but holds none, so each feature constructs its own with
 * its own points/duration. 30 writes / 60s per acting user.
 */
const notesWriteLimiter = createRateLimiter({ points: 30, duration: 60 });

/**
 * The note body, validated at the action boundary. A blank or oversized body is
 * rejected before it can reach the insert; the messages are surfaced to the
 * caller verbatim.
 */
const bodySchema = z
  .string()
  .min(1, 'Note body is required')
  .max(2000, 'Note body too long');

export type NoteRow = {
  id: string;
  createdBy: string;
  body: string;
  createdAt: Date;
};

/**
 * Read the caller's visible notes, newest first. Guarded by CASL
 * (`read Note` via the registered contributor) AND scoped by Postgres RLS (the
 * `app.user_*` GUCs `withUserContext` publishes): a member sees only their own
 * rows, an owner sees all. Both layers must pass to return a row.
 */
export async function getNotes(): Promise<NoteRow[]> {
  return withPermission('read', 'Note', (ctx) =>
    withUserContext(ctx, (tx) =>
      tx.select().from(notes).orderBy(desc(notes.createdAt)),
    ),
  );
}

/**
 * Create a note owned by the acting user.
 *
 * Pipeline order is CONTRACTUAL: guard → limiter → validate → context, and only
 * then revalidate.
 *   - guard FIRST: an unauthenticated/unauthorized caller is rejected before any
 *     work (fail closed); the guard also yields the identity the insert uses.
 *   - limiter SECOND, validation INSIDE it: abusive callers spamming invalid
 *     bodies still consume budget, so validation cannot be a free bypass of the
 *     throttle.
 *   - validate THIRD: a blank/oversized body throws the schema's message before
 *     touching the database.
 *   - context FOURTH: the insert runs RLS-scoped, writing `createdBy = ctx.userId`
 *     (the RLS WITH CHECK independently forbids forging another creator).
 * `revalidatePath('/notes')` runs ONLY after the whole guard chain resolves —
 * never on a denied, throttled, or invalid call.
 */
export async function createNote(formData: FormData): Promise<void> {
  await withPermission('create', 'Note', (ctx) =>
    withRateLimit(notesWriteLimiter, `notes:create:${ctx.userId}`, async () => {
      const body = bodySchema.parse(String(formData.get('body') ?? ''));
      await withUserContext(ctx, (tx) =>
        tx.insert(notes).values({ createdBy: ctx.userId, body }),
      );
    }),
  );

  revalidatePath('/notes');
}
