import { config as loadEnv } from 'dotenv';

import { createUser } from './db-setup';

/**
 * One verb for "make me a login": the scripted replacement for the README's
 * manual two-step — `curl` the GoTrue admin API to mint the auth user, then
 * `psql` upsert its role into `profiles`. There is no sign-up page by design
 * (ADR-0003), and roles are write-locked against every logged-in user, so the
 * only sanctioned way to add an account is out-of-band with privileged creds —
 * which is exactly what this script holds in one place.
 *
 *   npm run db:create-user -- --email you@example.com --password choose-one --role owner
 */

export interface CreateUserArgs {
  email: string;
  password: string;
  role: string;
}

/**
 * Parse the CLI flags into the three inputs createUser() needs. `--role`
 * defaults to the least-privilege `member` so an unqualified invocation can
 * never silently mint an owner; `--email` and `--password` are mandatory and
 * raise a usage error naming the missing flag.
 */
export function parseCreateUserArgs(argv: string[]): CreateUserArgs {
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    if (!flag.startsWith('--')) {
      throw new Error(`Unexpected argument "${flag}" — expected a --flag`);
    }
    const value = argv[i + 1];
    if (value === undefined) {
      throw new Error(`Flag ${flag} is missing its value`);
    }
    values[flag.slice(2)] = value;
  }

  const email = values.email;
  const password = values.password;
  if (!email) {
    throw new Error('--email is required (the account to create)');
  }
  if (!password) {
    throw new Error('--password is required (the account password)');
  }
  return { email, password, role: values.role ?? 'member' };
}

/**
 * CLI body, kept out of module top level for the same reason db-setup.ts does:
 * no top-level await, so the module stays trivially importable by the unit
 * test that exercises parseCreateUserArgs in isolation.
 */
async function cli(): Promise<void> {
  // Same env precedence as db:setup: `.env.local` first (dev overrides win —
  // dotenv never overwrites), then committed `.env.test` so a fresh clone
  // works before any `cp`; in CI the job env wins over both.
  loadEnv({ path: '.env.local' });
  loadEnv({ path: '.env.test' });

  const { email, password, role } = parseCreateUserArgs(process.argv.slice(2));

  const adminUrl = process.env.MIGRATE_DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl) {
    throw new Error(
      'MIGRATE_DATABASE_URL is not set — create-user upserts the role under ' +
        'the privileged connection (check .env.local / .env.test).',
    );
  }
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — ' +
        'create-user calls the GoTrue admin API (check .env.local / .env.test).',
    );
  }

  const id = await createUser({
    adminUrl,
    supabaseUrl,
    serviceKey,
    email,
    password,
    role,
  });
  console.log(`create-user ✓ ${email} (role: ${role}) — id ${id}`);
}

/**
 * argv[1] is this file only when run via `npm run db:create-user`. Mirrors
 * db-setup.ts's detection (no `import.meta`, Windows-safe) so the unit test can
 * import this module without the CLI firing.
 */
export function isCreateUserCliEntry(argv1: string | undefined): boolean {
  return argv1?.replaceAll('\\', '/').endsWith('scripts/create-user.ts') ?? false;
}

if (isCreateUserCliEntry(process.argv[1])) {
  cli().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
