import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * setPreferences against a throwaway testcontainer. The session and revalidatePath
 * are mocked (no request context); the upsert is REAL and RLS-scoped. Covers the
 * insert-then-update upsert, fail-closed auth, and boundary validation of the
 * timezone. Module-load order is the contract — DATABASE_URL before the imports.
 */
const USER = '11111111-1111-1111-1111-111111111111';

const sessionUser = vi.fn();
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => sessionUser() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

describe('setPreferences (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let db: typeof import('@/lib/db/client').db;
  let setPreferences: typeof import('@/app/_features/shell/actions').setPreferences;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ db } = await import('@/lib/db/client'));
    ({ setPreferences } = await import('@/app/_features/shell/actions'));
    sessionUser.mockResolvedValue({ userId: USER, email: null, roles: ['member'] });
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it('inserts a new row for the acting user', async () => {
    await setPreferences({ timezone: 'America/New_York', hour12: true });
    const { rows } = await rls.admin.query(
      'select timezone, hour12 from user_preferences where user_id = $1',
      [USER],
    );
    expect(rows).toEqual([{ timezone: 'America/New_York', hour12: true }]);
  });

  it('updates the same row on a second call (upsert, one row per user)', async () => {
    await setPreferences({ timezone: 'Asia/Tokyo', hour12: false });
    const { rows } = await rls.admin.query(
      'select timezone, hour12 from user_preferences where user_id = $1',
      [USER],
    );
    expect(rows).toEqual([{ timezone: 'Asia/Tokyo', hour12: false }]);
  });

  it('rejects an unknown timezone before touching the database', async () => {
    const err = await setPreferences({ timezone: 'Mars/Olympus', hour12: false }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).not.toBeNull();
    const { rows } = await rls.admin.query(
      'select timezone from user_preferences where user_id = $1',
      [USER],
    );
    expect(rows).toEqual([{ timezone: 'Asia/Tokyo' }]); // unchanged
  });

  it('refuses an unauthenticated caller (guard fails closed)', async () => {
    sessionUser.mockResolvedValueOnce(null);
    const err = await setPreferences({ timezone: 'UTC', hour12: false }).then(
      () => null,
      (e: unknown) => e as Error,
    );
    expect(err?.message).toBe('Not authenticated');
  });

  it('persists the chosen theme when provided', async () => {
    await setPreferences({ timezone: 'Asia/Tokyo', hour12: false, theme: 'dark' });
    const { rows } = await rls.admin.query(
      'select timezone, hour12, theme from user_preferences where user_id = $1',
      [USER],
    );
    expect(rows).toEqual([{ timezone: 'Asia/Tokyo', hour12: false, theme: 'dark' }]);
  });
});
