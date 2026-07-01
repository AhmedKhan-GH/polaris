// notes actions through the REAL pipeline, minus session.
//
// This suite mocks EXACTLY ONE seam — `@/lib/auth/session` getSessionUser — and
// runs everything else for real: the registry-backed CASL ability, the real
// `withPermission` guard, the real feature-owned rate limiter, the real
// `withUserContext` GUC plumbing, the real `notes` schema, and the real Drizzle
// client against a throwaway Postgres testcontainer. It is the end-to-end proof
// that the action pipeline + Postgres RLS agree on who can see and write what;
// only the request's identity is stubbed (there is no HTTP layer here to carry a
// Supabase token).
//
// Module-load order is the contract: `lib/db/client` reads `DATABASE_URL` at
// import time, so we boot the container, point `DATABASE_URL` at the `app_user`
// connection string, and only THEN dynamically import the actions module (which
// transitively imports the client). Importing earlier would bind the client to
// the wrong (or missing) URL.
//
// `next/cache` revalidatePath is also stubbed: it is a Next-runtime-only call
// with no meaning (and would throw) outside the framework, and it is irrelevant
// to what this suite proves. The session mock is the only BEHAVIOURAL double.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

// The single behavioural double: the guard resolves identity through this.
const session = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
}));
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: session.getSessionUser,
}));
// Next-runtime-only no-op outside the framework; irrelevant to this suite.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Build a FormData carrying `body` (and an optional `title`). */
function fd(body: string, title = ''): FormData {
  const f = new FormData();
  f.set('body', body);
  f.set('title', title);
  return f;
}

describe('notes actions through the real pipeline (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let createNote: typeof import('./actions').createNote;
  let getNotes: typeof import('./actions').getNotes;
  let editNote: typeof import('./actions').editNote;
  let getNoteHistory: typeof import('./actions').getNoteHistory;
  let db: typeof import('@/lib/db/client').db;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    // Dynamic import AFTER env is set: the client binds to DATABASE_URL on load.
    ({ createNote, getNotes, editNote, getNoteHistory } = await import('./actions'));
    ({ db } = await import('@/lib/db/client'));
  });

  afterAll(async () => {
    // End the app pool the client opened so it does not hold the event loop,
    // then tear the container down.
    await db.$client.end();
    await rls.cleanup();
  });

  beforeEach(async () => {
    session.getSessionUser.mockReset();
    // Isolate each cycle: superuser truncate bypasses RLS. CASCADE also clears
    // note_versions (FK child) so the append-only child never blocks the truncate.
    await rls.admin.query('truncate table notes cascade');
  });

  it('USER_A (member) creates a note, then reads it back as their own', async () => {
    session.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: 'a@example.com',
      roles: ['member'],
    });

    await createNote(fd('hello'));
    const rows = await getNotes();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdBy).toBe(USER_A);
    expect(rows[0]?.body).toBe('hello');
  });

  it('USER_B (member) sees only their own notes — USER_A’s are invisible (RLS)', async () => {
    // Seed one note per user as USER_A then USER_B.
    session.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: 'a@example.com',
      roles: ['member'],
    });
    await createNote(fd('from A'));

    session.getSessionUser.mockResolvedValue({
      userId: USER_B,
      email: 'b@example.com',
      roles: ['member'],
    });
    await createNote(fd('from B'));

    const rows = await getNotes();
    expect(rows.map((r) => r.body)).toEqual(['from B']);
    expect(rows.map((r) => r.createdBy)).toEqual([USER_B]);
  });

  it('USER_B with the owner role sees ALL notes (owner read-all branch)', async () => {
    session.getSessionUser.mockResolvedValue({
      userId: USER_A,
      email: 'a@example.com',
      roles: ['member'],
    });
    await createNote(fd('from A'));

    session.getSessionUser.mockResolvedValue({
      userId: USER_B,
      email: 'b@example.com',
      roles: ['member'],
    });
    await createNote(fd('from B'));

    session.getSessionUser.mockResolvedValue({
      userId: USER_B,
      email: 'b@example.com',
      roles: ['owner'],
    });
    const rows = await getNotes();
    expect(rows.map((r) => r.body).sort()).toEqual(['from A', 'from B']);
  });

  it('rejects createNote with Not authenticated when there is no session (real guard, fail closed)', async () => {
    session.getSessionUser.mockResolvedValue(null);

    await expect(createNote(fd('nope'))).rejects.toThrow('Not authenticated');

    // Nothing was written: a superuser probe sees an empty table.
    const { rows } = await rls.admin.query('select count(*)::int as n from notes');
    expect(rows[0].n).toBe(0);
  });

  it('createNote writes a genesis version (seq 1) snapshotting title + body', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });

    await createNote(fd('v1 body', 'V1 title'));
    const noteId = (await getNotes())[0]!.id;
    const history = await getNoteHistory(noteId);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ seq: 1, title: 'V1 title', body: 'v1 body', editedBy: USER_A });
  });

  it('editNote appends a version (title + body) and updates the current projection', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });
    await createNote(fd('original')); // title ''
    const noteId = (await getNotes())[0]!.id;

    await editNote(noteId, 'Renamed', 'edited');

    const now = (await getNotes())[0]!;
    expect([now.title, now.body]).toEqual(['Renamed', 'edited']); // projection updated
    const history = await getNoteHistory(noteId); // append-only, newest first
    expect(history.map((v) => [v.seq, v.title, v.body])).toEqual([
      [2, 'Renamed', 'edited'],
      [1, '', 'original'],
    ]);
  });

  it('editNote cannot touch another user’s note (RLS fails closed)', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });
    await createNote(fd('A owns this'));
    const noteId = (await getNotes())[0]!.id;

    session.getSessionUser.mockResolvedValue({ userId: USER_B, email: 'b@example.com', roles: ['member'] });
    await expect(editNote(noteId, '', 'hacked')).rejects.toThrow();

    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });
    expect((await getNotes())[0]!.body).toBe('A owns this'); // unchanged
  });
});
