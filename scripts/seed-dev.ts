import { config as loadEnv } from 'dotenv';

import { createUser } from './db-setup';
import { seedDummyProducts } from './seed-dummy-products';

/**
 * THE dummy-data origin (`npm run db:seed-dev`). Everything here is DEV/TEST only
 * and never runs in a deploy or provisioning path: `db:setup` provisions schema +
 * `app_user` and knows nothing about these accounts, so production can never push
 * them. A real environment's first owner comes from `db:create-user` instead.
 *
 * Seeds two things:
 *   - the three demo logins below (there is no sign-up page — ADR-0003), and
 *   - the dummy product catalog (`seedDummyProducts`).
 *
 * `seedDemoUsers` is also imported by the e2e global-setup (its login fixtures),
 * so this file is BOTH a library and a CLI — the argv guard keeps an import from
 * running the full seed.
 */
const DEMO_USERS = [
  { email: 'owner@example.com', role: 'owner' },
  { email: 'member@example.com', role: 'member' },
  { email: 'admin@example.com', role: 'admin' },
] as const;

/**
 * Create (or reconcile) the three canonical demo accounts and mirror their roles
 * into `profiles`. Idempotent — each `createUser` tolerates an existing email.
 * Returns the owner's user id so the caller can stamp owner-managed seed data
 * (e.g. the dummy catalog's `created_by`).
 */
export async function seedDemoUsers(opts: {
  adminUrl: string;
  supabaseUrl: string;
  serviceKey: string;
  password: string;
}): Promise<{ ownerId: string }> {
  let ownerId = '';
  for (const u of DEMO_USERS) {
    const id = await createUser({ ...opts, email: u.email, role: u.role });
    if (u.role === 'owner') ownerId = id;
  }
  return { ownerId };
}

/** True only when this file is the process entry (`npm run db:seed-dev`), not
 *  when imported (by the e2e global-setup) — same argv guard db-setup uses. */
export function isSeedDevCliEntry(argv1: string | undefined): boolean {
  return argv1?.replaceAll('\\', '/').endsWith('scripts/seed-dev.ts') ?? false;
}

async function cli(): Promise<void> {
  // Same env precedence as db:setup: `.env.local` first (dev overrides win), then
  // the committed `.env.test`. In CI the job env already wins over both.
  loadEnv({ path: '.env.local' });
  loadEnv({ path: '.env.test' });

  const adminUrl = process.env.MIGRATE_DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.TEST_USER_PASSWORD;
  if (!adminUrl || !supabaseUrl || !serviceKey || !password) {
    throw new Error(
      'db:seed-dev needs MIGRATE_DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, ' +
        'SUPABASE_SERVICE_ROLE_KEY and TEST_USER_PASSWORD (check .env.local / .env.test).',
    );
  }

  const { ownerId } = await seedDemoUsers({ adminUrl, supabaseUrl, serviceKey, password });
  console.log(
    'db:seed-dev ✓ demo users seeded: owner@example.com, member@example.com, admin@example.com (password: TEST_USER_PASSWORD)',
  );

  const total = await seedDummyProducts(adminUrl, ownerId);
  console.log(`db:seed-dev ✓ dummy SKUs seeded; products now has ${total} rows`);
}

if (isSeedDevCliEntry(process.argv[1])) {
  cli().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
