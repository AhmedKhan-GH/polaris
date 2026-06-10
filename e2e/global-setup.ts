import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * One-time setup for the whole E2E run, against the LIVE local Supabase stack
 * (not a throwaway container). It is idempotent: safe to re-run between sessions.
 *
 * Sequence:
 *   1. Apply Drizzle migrations under the privileged migrate role.
 *   2. Make `app_user` loginable on this DB (LOGIN + password) — the app connects
 *      as that non-superuser role, so it must be able to authenticate.
 *   3. Truncate only the test-owned table (`sign_in_log`); auth.users + profiles
 *      persist across runs and are reconciled by `seedUser` below.
 *   4./5. Seed the two GoTrue users (owner, member) and mirror their roles into
 *      `profiles`.
 *
 * Every required env var is asserted up front with a clear message so a missing
 * `.env.test` fails loudly rather than deep inside a pg/GoTrue call.
 */
export default async function globalSetup(): Promise<void> {
  const adminUrl = process.env.MIGRATE_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    // 1. Apply migrations programmatically (same path the integration harness
    //    uses): the privileged role can CREATE ROLE / GRANT / define policies.
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });

    // 2. LOGIN + password for app_user is environment, not schema, so it lives
    //    here rather than in a migration. Parse the app URL to recover the role
    //    name and password the app will actually use.
    const parsed = new URL(appUrl);
    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    await pool.query(
      `ALTER ROLE "${username}" WITH LOGIN PASSWORD '${password}'`,
    );

    // 3. Reset only the test-owned table. auth.users + profiles persist (they
    //    are reconciled by seedUser), so we never truncate them here.
    await pool.query('TRUNCATE sign_in_log');
  } finally {
    await pool.end();
  }

  // 4. GoTrue admin client. No session persistence/refresh — this is a one-shot
  //    admin client, not a logged-in user.
  const admin = createSupabaseAdmin(supabaseUrl, serviceKey);

  // 5. Seed both fixtures. Roles are mirrored into `profiles` (the app's role
  //    source of truth) keyed by the GoTrue user id.
  await seedUser(admin, adminUrl, 'owner@example.com', 'owner');
  await seedUser(admin, adminUrl, 'member@example.com', 'member');
}

/**
 * The service-role GoTrue client used for seeding. Built through one factory so
 * its (heavily generic) type flows to `seedUser` by inference — re-deriving it
 * via a bare `ReturnType<typeof createClient>` would default the schema generics
 * to `never` and not match this configured instance.
 */
function createSupabaseAdmin(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

/**
 * Create (or reconcile) a single GoTrue user and mirror its role into
 * `profiles`. Idempotent across runs:
 *  - createUser tolerates an already-registered email (any other error rethrows);
 *  - the user id is resolved via `listUsers()` when createUser does not return it
 *    (i.e. the user already existed);
 *  - the profile row is upserted, refreshing the role on conflict.
 */
async function seedUser(
  admin: SupabaseAdmin,
  adminUrl: string,
  email: string,
  role: string,
): Promise<void> {
  const password = process.env.TEST_USER_PASSWORD!;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error && !/already.*registered|exists/i.test(error.message)) {
    throw error;
  }

  let userId = data?.user?.id ?? null;
  if (!userId) {
    // Already existed: resolve the id by listing users and matching the email.
    const { data: list, error: listError } =
      await admin.auth.admin.listUsers();
    if (listError) throw listError;
    userId = list.users.find((u) => u.email === email)?.id ?? null;
  }
  if (!userId) {
    throw new Error(`Could not resolve a GoTrue user id for ${email}`);
  }

  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    await pool.query(
      `insert into profiles (id, email, role) values ($1, $2, $3)
         on conflict (id) do update set role = excluded.role`,
      [userId, email, role],
    );
  } finally {
    await pool.end();
  }
}
