import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * THE provisioning verb: brings a database from any state (vanilla container,
 * fresh `supabase start`, already-provisioned stack) to app-connectable.
 * Idempotent — safe to re-run.
 *
 * Two halves, deliberately one call:
 *   1. Schema — apply `drizzle/` under the privileged role. Migrations create
 *      `app_user` with NOLOGIN and no password, because…
 *   2. Environment — LOGIN + password are environment, not schema, so they can
 *      never live in a migration. Parsed from the URL the app will actually
 *      use, keeping env the single source of truth.
 *
 * Before this existed, half 2 lived only in the test harnesses (each test
 * environment provisioned itself) and the dev path provisioned nothing — a
 * fresh clone's first query died with `password authentication failed for
 * user "app_user"`. Every environment now calls this one function: the dev
 * Quickstart and CI via `npm run db:setup`, the e2e harness via import.
 */
export async function setupDb(adminUrl: string, appUrl: string): Promise<void> {
  const admin = new pg.Pool({ connectionString: adminUrl });
  try {
    await migrate(drizzle(admin), { migrationsFolder: './drizzle' });

    const parsed = new URL(appUrl);
    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    await admin.query(
      `ALTER ROLE "${username}" WITH LOGIN PASSWORD '${password}'`,
    );
  } finally {
    await admin.end();
  }
}

/**
 * CLI body, kept out of module top level: top-level await would make this an
 * ESM-with-TLA graph, which Playwright's CJS transpilation of the e2e
 * global-setup (an importer of `setupDb`) cannot `require()`.
 */
async function cli(): Promise<void> {
  // CLI-only env handling (Charter D1 exception, same class as
  // drizzle.config.ts): `.env.local` first — dotenv never overwrites, so dev
  // overrides win — then the committed `.env.test` so a fresh clone works
  // before any `cp`. In CI the job env is already set and wins over both.
  loadEnv({ path: '.env.local' });
  loadEnv({ path: '.env.test' });

  const adminUrl = process.env.MIGRATE_DATABASE_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error(
      'MIGRATE_DATABASE_URL is not set — db:setup needs the privileged ' +
        'connection string (check .env.local / .env.test).',
    );
  }
  if (!appUrl) {
    throw new Error(
      'DATABASE_URL is not set — db:setup needs the app connection string ' +
        'whose role it provisions (check .env.local / .env.test).',
    );
  }

  await setupDb(adminUrl, appUrl);

  // Self-verify the postcondition through the app's own URL: this line is the
  // fresh-clone regression probe — in CI it fails the build if provisioning
  // ever regresses to the state that broke fresh clones.
  const expected = decodeURIComponent(new URL(appUrl).username);
  const probe = new pg.Client({ connectionString: appUrl });
  await probe.connect();
  try {
    const { rows } = await probe.query('select current_user as who');
    if (rows[0].who !== expected) {
      throw new Error(
        `db:setup verification failed: connected as "${rows[0].who}", expected "${expected}"`,
      );
    }
    console.log(`db:setup ✓ migrations applied; ${expected} loginable`);
  } finally {
    await probe.end();
  }
}

// Entry detection without `import.meta` (ESM-only syntax would force Node's
// native ESM loader onto a file Playwright transpiles to CJS for the e2e
// global-setup import — the two regimes conflict). argv[1] is this file only
// when run via `npm run db:setup`; under vitest/playwright it is their binary.
const isCliEntry = process.argv[1]?.endsWith('scripts/db-setup.ts') ?? false;

if (isCliEntry) {
  cli().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
