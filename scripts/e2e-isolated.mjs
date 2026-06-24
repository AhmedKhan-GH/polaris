// Ephemeral, fully-isolated E2E run.
//
// Boots a THROWAWAY Supabase stack (its own project id `polaris-e2e`, every port
// shifted +100 so 5432x → 5442x), provisions it, runs the Playwright suite
// against it, then tears it down — leaving your dev stack on 54321/54322 (and the
// data you manually seeded there) completely untouched.
//
// Why a whole stack and not just a second database: the Supabase service layer
// (PostgREST/Auth/Realtime) is bound to its database, and the app reads roles via
// the Supabase client — so isolating the data means isolating the services too.
//
// The e2e stack's endpoints + keys are passed to db:setup and test:e2e as real
// env vars. Playwright's own `dotenv` load of the committed `.env.test` becomes a
// no-op (dotenv never overrides already-set vars), so nothing here mutates a
// tracked file. The dev server Playwright boots inherits these env vars, and
// Next preserves real env over `.env.local`, so the app-under-test hits the
// isolated stack.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mirror CI's trimmed service set — keep db/auth/rest/realtime, drop the rest.
const TRIM = 'studio,imgproxy,inbucket,edge-runtime,functions,vector,analytics,meta,storage';

const work = mkdtempSync(join(tmpdir(), 'polaris-e2e-'));
let started = false;

function supabase(args, capture = false) {
  return execFileSync('npx', ['supabase', ...args, '--workdir', work], {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
}

function cleanup() {
  if (started) {
    try {
      console.log('\n▶ tearing down ephemeral e2e stack…');
      supabase(['stop', '--no-backup']);
    } catch (err) {
      console.error('  (stop failed — you may need: npx supabase stop --project-id polaris-e2e)', err.message);
    }
    started = false;
  }
  try {
    rmSync(work, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

function run(cmd, args, env, allowFail = false) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  }
  return r.status ?? 1;
}

// Pull the demo creds from the committed .env.test so they match what the specs
// expect; everything else comes from the freshly-booted stack.
function readCreds() {
  const txt = readFileSync('.env.test', 'utf8');
  const pick = (k, fallback) =>
    (txt.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim() || fallback;
  return {
    email: pick('TEST_USER_EMAIL', 'owner@example.com'),
    password: pick('TEST_USER_PASSWORD', 'test-password-123'),
  };
}

try {
  // 1. Port-shifted copy of the supabase project config.
  cpSync('supabase', join(work, 'supabase'), { recursive: true });
  const cfgPath = join(work, 'supabase', 'config.toml');
  const cfg = readFileSync(cfgPath, 'utf8')
    .replace(/project_id\s*=\s*"[^"]*"/, 'project_id = "polaris-e2e"')
    .replace(/\b5432(\d)\b/g, '5442$1'); // 54321→54421, 54322→54422, …
  writeFileSync(cfgPath, cfg);

  // 2. Boot the throwaway stack (separate ports + project → no collision with dev).
  console.log('▶ booting ephemeral e2e stack (project polaris-e2e, ports 5442x)…');
  supabase(['start', '-x', TRIM]);
  started = true;

  // 3. Read its endpoints + keys.
  const status = supabase(['status', '-o', 'env'], true);
  const get = (k) => (status.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm')) || [])[1];
  const apiUrl = get('API_URL');
  const anonKey = get('ANON_KEY');
  const serviceKey = get('SERVICE_ROLE_KEY');
  const dbUrl = get('DB_URL'); // postgres superuser on the e2e db port
  if (!apiUrl || !anonKey || !serviceKey || !dbUrl) {
    throw new Error('could not read endpoints from `supabase status` for the e2e stack');
  }
  const appUrl = dbUrl.replace(/\/\/postgres:[^@]*@/, '//app_user:apppw@');
  const { email, password } = readCreds();

  const env = {
    ...process.env,
    TEST_USER_EMAIL: email,
    TEST_USER_PASSWORD: password,
    DATABASE_URL: appUrl,
    MIGRATE_DATABASE_URL: dbUrl,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  };

  // 4. Provision the e2e db exactly as a fresh clone would (migrations + app_user
  //    login + demo users).
  console.log('▶ provisioning the isolated db (db:setup)…');
  run('npm', ['run', 'db:setup'], env);

  // 5. Run the suite against the isolated stack.
  console.log('▶ running E2E against the isolated stack…');
  process.exitCode = run('npm', ['run', 'test:e2e'], env, true);
} finally {
  cleanup();
}
