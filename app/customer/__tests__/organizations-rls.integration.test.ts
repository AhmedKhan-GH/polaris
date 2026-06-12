import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from '@/lib/db/__tests__/rls-test-db';

/**
 * organizations creator-read RLS, against a throwaway testcontainer.
 *
 * Until memberships exist, an organization is visible only to the user who
 * created it. The suite seeds through the privileged pool, then reads through
 * the real app_user Drizzle connection with app.user_id set by withUserContext.
 */
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

describe('organizations creator-read RLS (testcontainer)', (): void => {
  let rls: Awaited<ReturnType<typeof startRlsTestDb>> | undefined;
  let withUserContext: typeof import('@/lib/db/with-user-context').withUserContext;
  let db: typeof import('@/lib/db/client').db | undefined;
  let organizations: typeof import('@/lib/db/schema').organizations;

  beforeAll(async (): Promise<void> => {
    rls = await startRlsTestDb();
    process.env.DATABASE_URL = rls.appConnUri;
    // Dynamic import AFTER env is set: the client binds to DATABASE_URL on load.
    ({ withUserContext } = await import('@/lib/db/with-user-context'));
    ({ db } = await import('@/lib/db/client'));
    ({ organizations } = await import('@/lib/db/schema'));

    await rls.admin.query(
      'insert into organizations (name, created_by) values ($1, $2), ($3, $4)',
      ['Org A', USER_A, 'Org B', USER_B],
    );
  });

  afterAll(async (): Promise<void> => {
    await db?.$client.end();
    await rls?.cleanup();
  });

  it("shows USER_A their organization but not USER_B's", async (): Promise<void> => {
    const rows = await withUserContext({ userId: USER_A, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    expect(rows.map((r): string => r.name)).toEqual(['Org A']);
    expect(rows.map((r): string => r.createdBy)).toEqual([USER_A]);
  });

  it("hides USER_A's organization from USER_B", async (): Promise<void> => {
    const rows = await withUserContext({ userId: USER_B, roles: [] }, (tx) =>
      tx.select().from(organizations),
    );

    expect(rows.map((r): string => r.name)).toEqual(['Org B']);
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Org A', createdBy: USER_A }),
      ]),
    );
  });
});
