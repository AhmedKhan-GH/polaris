import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * getPreferences() against a throwaway testcontainer. The session is mocked (it
 * resolves Supabase cookies, which a container has none of); the DB read is REAL,
 * scoped to the caller by RLS. Three cases: stored row, no row → defaults, and no
 * session → defaults. Module-load order is the contract — set DATABASE_URL to the
 * app_user URI BEFORE dynamic-importing getPreferences.
 */
const USER = '11111111-1111-1111-1111-111111111111';
const NO_PREFS_USER = '22222222-2222-2222-2222-222222222222';

const sessionUser = vi.fn();
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => sessionUser() }));

describe('getPreferences (testcontainer)', () => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>>;
  let db: typeof import('@/lib/db/client').db;
  let getPreferences: typeof import('@/lib/preferences').getPreferences;

  beforeAll(async () => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    ({ db } = await import('@/lib/db/client'));
    ({ getPreferences } = await import('@/lib/preferences'));

    await rls.admin.query(
      `insert into user_preferences (user_id, timezone, hour12, theme) values ($1, 'America/New_York', true, 'dark')`,
      [USER],
    );
  });

  afterAll(async () => {
    await db.$client.end();
    await rls.cleanup();
  });

  it("returns the user's stored preferences", async () => {
    sessionUser.mockResolvedValue({ userId: USER, email: null, roles: ['member'] });
    expect(await getPreferences()).toEqual({
      timezone: 'America/New_York',
      hour12: true,
      theme: 'dark',
    });
  });

  it('falls back to UTC + 24h + light theme when the user has no row', async () => {
    sessionUser.mockResolvedValue({
      userId: NO_PREFS_USER,
      email: null,
      roles: ['member'],
    });
    expect(await getPreferences()).toEqual({ timezone: 'UTC', hour12: false, theme: 'light' });
  });

  it('falls back to defaults when there is no session', async () => {
    sessionUser.mockResolvedValue(null);
    expect(await getPreferences()).toEqual({ timezone: 'UTC', hour12: false, theme: 'light' });
  });
});
