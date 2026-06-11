import pg from 'pg';

import { seedDemoUsers, setupDb } from '../scripts/db-setup';

/**
 * One-time setup for the whole E2E run, against the LIVE local Supabase stack
 * (not a throwaway container). It is idempotent: safe to re-run between sessions.
 *
 * Sequence:
 *   1. Provision via `setupDb` — the same verb the Quickstart and CI run
 *      (`npm run db:setup`): Drizzle migrations under the privileged role,
 *      then LOGIN + password for `app_user` parsed from the app URL.
 *   2. Truncate only the test-owned tables (`notes`, `sign_in_log`);
 *      auth.users + profiles persist across runs and are reconciled by
 *      `seedDemoUsers` below.
 *   3. Seed the two demo fixtures (owner, member) through `seedDemoUsers` —
 *      the same accounts a clean build gets, so the specs log in with exactly
 *      what the Quickstart produces.
 *
 * Every required env var is asserted up front with a clear message so a missing
 * `.env.test` fails loudly rather than deep inside a pg/GoTrue call.
 */
export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.MIGRATE_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const testPassword = process.env.TEST_USER_PASSWORD;

  if (!adminUrl) {
    throw new Error(
      'MIGRATE_DATABASE_URL is not set — E2E global-setup needs the privileged ' +
        'migrate connection string (check .env.test).',
    );
  }
  if (!appUrl) {
    throw new Error(
      'DATABASE_URL is not set — E2E global-setup needs the app connection ' +
        'string to make app_user loginable (check .env.test).',
    );
  }
  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set — E2E global-setup needs it to reach ' +
        'GoTrue for user seeding (check .env.test).',
    );
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — E2E global-setup needs the ' +
        'service-role key to seed auth users (check .env.test).',
    );
  }
  if (!testPassword) {
    throw new Error(
      'TEST_USER_PASSWORD is not set — E2E global-setup needs the demo ' +
        'password to seed the login fixtures (check .env.test).',
    );
  }

  // 1. Schema + app_user login through the one provisioning verb. Keeping this
  //    the same code path as `npm run db:setup` means E2E exercises exactly
  //    what a fresh clone runs.
  await setupDb(adminUrl, appUrl);

  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    // 2. Reset the test-owned tables. auth.users + profiles persist (they are
    //    reconciled by seedDemoUsers), so we never truncate them here.
    await pool.query('TRUNCATE notes, sign_in_log');
  } finally {
    await pool.end();
  }

  // 3. Seed both demo fixtures — owner/member in GoTrue, roles mirrored into
  //    `profiles` (the app's role source of truth) keyed by the GoTrue user id.
  await seedDemoUsers({
    adminUrl,
    supabaseUrl,
    serviceKey,
    password: testPassword,
  });
}
