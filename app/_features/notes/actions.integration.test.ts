// notes actions through the REAL pipeline, minus session.
//
// Mocks EXACTLY ONE behavioural seam — `@/lib/auth/session` getSessionUser — and
// runs everything else for real: the registry-backed CASL ability, the real
// `withPermission` guard, the real feature-owned rate limiter, the real
// `withUserContext` GUC plumbing, the real `notes` schema, and the real Drizzle
// client against a throwaway Postgres testcontainer. End-to-end proof that the
// action pipeline + Postgres RLS agree on who can see and write what.
//
// Module-load order is the contract: point `DATABASE_URL` at the `app_user`
// connection string BEFORE dynamically importing the actions module.
//
// `next/navigation` redirect is stubbed to a no-op: createNote redirects on
// success, which would otherwise throw NEXT_REDIRECT outside the framework. The
// session mock is the only BEHAVIOURAL double.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const session = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: session.getSessionUser }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

/** Build a FormData carrying `body` and a `title` (required on create; defaulted). */
function fd(body: string, title = 'Note'): FormData {
  const f = new FormData();
  f.set('body', body);
  f.set('title', title);
  return f;
}

describe('notes actions through the real pipeline (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let createNote: typeof import('./actions').createNote;
  let getNotes: typeof import('./actions').getNotes;
  let db: typeof import('@/lib/db/client').db;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ createNote, getNotes } = await import('./actions'));
    ({ db } = await import('@/lib/db/client'));
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  beforeEach(async () => {
    session.getSessionUser.mockReset();
    // Isolate each cycle: superuser truncate bypasses RLS.
    await rls.admin.query('truncate table notes');
  });

  it('USER_A (member) creates a note, then reads it back as their own', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });

    await createNote(fd('hello', 'Greeting'));
    const rows = await getNotes();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ createdBy: USER_A, title: 'Greeting', body: 'hello' });
  });

  it('USER_B (member) sees only their own notes — USER_A’s are invisible (RLS)', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });
    await createNote(fd('from A'));

    session.getSessionUser.mockResolvedValue({ userId: USER_B, email: 'b@example.com', roles: ['member'] });
    await createNote(fd('from B'));

    const rows = await getNotes();
    expect(rows.map((r) => r.body)).toEqual(['from B']);
    expect(rows.map((r) => r.createdBy)).toEqual([USER_B]);
  });

  it('USER_B with the owner role sees ALL notes (owner read-all branch)', async () => {
    session.getSessionUser.mockResolvedValue({ userId: USER_A, email: 'a@example.com', roles: ['member'] });
    await createNote(fd('from A'));

    session.getSessionUser.mockResolvedValue({ userId: USER_B, email: 'b@example.com', roles: ['member'] });
    await createNote(fd('from B'));

    session.getSessionUser.mockResolvedValue({ userId: USER_B, email: 'b@example.com', roles: ['owner'] });
    const rows = await getNotes();
    expect(rows.map((r) => r.body).sort()).toEqual(['from A', 'from B']);
  });

  it('rejects createNote with Not authenticated when there is no session (real guard, fail closed)', async () => {
    session.getSessionUser.mockResolvedValue(null);

    await expect(createNote(fd('nope'))).rejects.toThrow('Not authenticated');

    const { rows } = await rls.admin.query('select count(*)::int as n from notes');
    expect(rows[0].n).toBe(0);
  });
});
