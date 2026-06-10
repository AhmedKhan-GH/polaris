import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startRlsTestDb } from './rls-test-db';

describe('Testcontainers RLS harness (smoke)', () => {
  let db: Awaited<ReturnType<typeof startRlsTestDb>>;

  beforeAll(async () => {
    db = await startRlsTestDb();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('boots a Postgres container the admin pool can query', async () => {
    const { rows } = await db.admin.query('select 1 as ok');
    expect(rows).toEqual([{ ok: 1 }]);
  });

  it('connects the admin pool as a superuser (bypasses RLS)', async () => {
    // The container superuser bypasses RLS by design. This is why a separate,
    // non-superuser app connection arrives in Task 9 to actually exercise policies.
    const { rows } = await db.admin.query(
      "select current_setting('is_superuser') as is_superuser",
    );
    expect(rows[0].is_superuser).toBe('on');
  });
});
