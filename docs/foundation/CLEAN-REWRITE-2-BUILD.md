# Clean-Rewrite-2 Build Instructions

> **Historical foundation record** — the task-by-task build of `clean-rewrite-2` (33 TDD commits, completed ~2026-06-10), the foundation the current system stands on. Kept as genesis; the *as-built* reality is the code + [`HANDBOOK.md`](../../HANDBOOK.md) / [`CHARTER.md`](../../CHARTER.md) / [`docs/adr/`](../adr/).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construct branch `clean-rewrite-2` — 33 linear, every-commit-green, strictly TDD commits building the Polaris foundation per `CHARTER.md` and `CLEAN-REWRITE-2-PLAN.md`.

**Architecture:** Next.js 16 App Router monolith; Supabase Auth + Realtime; Drizzle-managed Postgres with two RLS identity paths (`app_user` GUC path, `auth.uid()` path); CASL-over-registry authorization; feature folders wired through four composition roots; disposable `notes` exemplar.

**Tech Stack:** Next 16.2.x, React 19.2, TS 5, Tailwind 4, Vitest 4 + Testing Library, Testcontainers (postgres:17), Playwright, Drizzle ORM/Kit, @supabase/ssr + supabase-js, CASL 7, Zod 4, t3-env, Pino, rate-limiter-flexible.

**⚠ Format adaptation (deliberate, per PLAN §2):** production implementation code is **intentionally absent** from this document — pre-writing it would be copying with extra steps. Each task supplies: exact files, public **contracts** (signatures), a numbered **behavior checklist** (each item = one red→green→refactor micro-cycle with exact expected values), exact commands, and the commit. Test code is written fresh at build time from these checklists. Configuration content (configs, YAML, SQL guard skeletons, exact strings) IS given literally — configs are TDD-exempt and these values are contractual.

---

## Protocol (applies to every task)

**Prerequisites:** Node 24 (`.nvmrc` added in Task 1), Docker running, Supabase CLI ≥ 2.x, repo at `/Users/ahmed/WebstormProjects/polaris`.

**Start:** `git switch -c clean-rewrite-2 bd8da074`

**The micro-cycle (PLAN §2):** per checklist item: write ONE failing test → `run` and observe red *for the right reason* → minimal code → observe green (whole suite) → refactor while green. Item already green before implementation = sequencing defect: stop, fix the plan.

**Reference firewall:** `clean-rewrite` stays closed during implementation. Everything needed from it is already distilled into this document. If something is genuinely missing, consult old code *between* cycles, then record the fact here in words before continuing.

**Gate per commit** (run all that exist at that point, from Task N's gate line):
- `G1` = `npm run lint && npx tsc --noEmit && npm test`
- `G2` = G1 + `npm run test:integration`
- `G3` = G2 with local `supabase start` running (live suites execute instead of skipping)
- `G4` = G3 + `npm run test:e2e`

**Review cadence:** pause after staging each commit for Ahmed's review; commit only after approval. Commit messages exactly as given, ending with:
`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

**Asset/doc exception:** brand SVGs and markdown docs may be carried over from `clean-rewrite` (assets and prose are not production code).

---

## Phase 0 — Root & hygiene

### Task 1 — `chore: pin toolchain and refresh scaffold`
**Files:** Modify `package.json`; create `.nvmrc`; modify `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `app/globals.css`.
- [ ] Set dependencies: `next ^16.2.6`, `react ^19.2.0`, `react-dom ^19.2.0`; devDeps: `typescript ^5`, `tailwindcss ^4` + `@tailwindcss/postcss ^4`, `eslint ^9`, `eslint-config-next ^16`, `@types/node`, `@types/react`, `@types/react-dom`. Add `"engines": { "node": ">=24" }`. Scripts baseline: `dev`=`next dev`, `build`=`next build`, `start`=`next start`, `lint`=`eslint`.
- [ ] `.nvmrc` content: `24`
- [ ] Verify `tsconfig.json` has `"strict": true`, `"paths": { "@/*": ["./*"] }`, `"moduleResolution": "bundler"`.
- [ ] Lockfile rule: `rm -rf node_modules package-lock.json && npm install`
- [ ] Verify: `npm run lint && npx tsc --noEmit && npm run build` → all pass (scaffold builds).
- [ ] Commit: `chore: pin toolchain and refresh scaffold`

### Task 2 — `chore: repo hygiene`
**Files:** Modify `.gitignore`; delete tracked `.idea/**`; delete `public/{next,vercel,file,globe,window}.svg`; add `public/zeefoods_logo.svg`, `public/zeefoods_letters.svg`.
- [ ] `.gitignore`: ensure NO `/docs` line ever enters; add `.idea/`; keep `.env*` ignored except add `!.env.test` and `!.env.test.example` (committed test env, demo keys only).
- [ ] `git rm -r --cached .idea` (files stay local, leave tracking).
- [ ] Remove scaffold SVGs; carry over the two Zee Foods SVGs: `git checkout clean-rewrite -- public/zeefoods_logo.svg public/zeefoods_letters.svg` (asset exception).
- [ ] Verify: `git status` shows expected deletions/additions only; `npm run build` still green.
- [ ] Commit: `chore: repo hygiene — untrack .idea, keep docs tracked, scrub scaffold assets`

### Task 3 — `docs(governance): adopt DOMAIN-CHARTER and founding ADRs`
**Files:** Create `CHARTER.md` (carry over from `clean-rewrite` working tree — doc exception), `docs/adr/template.md`, `docs/adr/0001-supabase-auth-not-keycloak.md`, `docs/adr/0002-channel-layer-realtime.md`, `docs/adr/0003-login-only-provisioning.md`, `docs/adr/0004-fresh-derivation.md`.
- [ ] ADR template sections: Status / Context / Decision / Consequences.
- [ ] 0001 content: Keycloak's justifying capabilities (multi-app SSO, federation, UMA, IdP tenancy) unused; it broke Supabase Realtime (forced a Centrifugo plan), added two containers, two-step logout, claims validation, CI flakes; Supabase Auth covers login + brute-force + role source AND restores native Realtime. Decision: Supabase Auth permanently; revisit only if multi-app SSO becomes real.
- [ ] 0002 content: the 0021 scar — Supabase Realtime's Postgres-Changes row authorizer does not reliably resolve `auth.uid()` and can never see `app.*` GUCs, so row-RLS on a streamed table silently drops all events. Decision: per-user delivery is enforced at the channel layer — DB trigger calls `realtime.broadcast_changes()` to `{domain}:{userId}` + `{domain}:all`; an RLS policy on `realtime.messages` (where subscription auth runs with the subscriber's JWT) gates topics. Never row-RLS for delivery.
- [ ] 0003 content: no public self-registration; accounts provisioned out-of-band (Supabase Studio/CLI now, invite codes at F9); `SUPABASE_SERVICE_ROLE_KEY` deliberately absent from t3-env until F9.
- [ ] 0004 content: `clean-rewrite-2` is a fresh TDD derivation; `clean-rewrite` (HEAD `96f0480`, audited 0 crit/high, ~91 tests) serves as behavioral specification and decision record; no production code copied; deletion-rehearsal record appended at Task 30.
- [ ] Commit: `docs(governance): adopt DOMAIN-CHARTER and founding ADRs`

---

## Phase 1 — Verification skeleton + CI

### Task 4 — `test(verification): vitest harness + import-boundary law`
**Files:** Create `vitest.config.mts`, `vitest.setup.ts`, `lib/verification/import-boundaries.test.ts`; modify `eslint.config.mjs`, `package.json` (scripts + devDeps).
**New deps:** `vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `eslint-plugin-import-x` (regenerate lockfile).
- [ ] `vitest.config.mts` (literal contract): plugins `[react()]`; `resolve.tsconfigPaths: true`; `test: { environment: 'jsdom', exclude: ['node_modules', 'docs', '.next', 'e2e', '**/*.integration.test.ts'], passWithNoTests: true, setupFiles: ['./vitest.setup.ts'] }`.
- [ ] `vitest.setup.ts`: single line `import '@testing-library/jest-dom/vitest'`.
- [ ] Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] Boundary scanner test (test-infra, ~50 lines, node `fs` + import-regex over `lib/**/*.ts{,x}` and `app/_features/**/*.ts{,x}`): Rule A — no file under `lib/` (except `lib/registry/`) imports `@/app/` or relative path escaping into `app/`; Rule B — no file under `app/_features/<a>/` imports from `app/_features/<b>/` (`a ≠ b`), with declared foundation-surface exceptions: `shell → auth` (signOutAction) only; Rule C — files under `lib/registry/` may import only paths matching `app/_features/*/{schema,permissions,nav}.ts`. Scanner test has `// @vitest-environment node`.
- [ ] RED: create fixture `lib/_violation-fixture.ts` containing `import '@/app/page'` → `npm test` → scanner FAILS naming `lib/_violation-fixture.ts`. Delete fixture → PASS over real tree.
- [ ] ESLint zones (lint-time mirror): add `eslint-plugin-import-x` flat-config entry with `'import-x/no-restricted-paths': ['error', { zones: [ { target: './lib', from: './app', message: 'Foundation must not import features (Charter §1.1)' }, { target: './app/_features', from: './app/_features', except: ['./'], message: 'Cross-feature import (Charter §1.2)' } ] }]` — registry exception: add `files: ['lib/registry/**']` override disabling the first zone.
- [ ] Gate: G1. Commit: `test(verification): vitest harness + import-boundary law`

### Task 5 — `ci: fresh-clone gate`
**Files:** Create `.github/workflows/ci.yml`, `.github/dependabot.yml`.
- [ ] `ci.yml`: name `CI`; on push+pull_request to `[clean-rewrite-2]` + `workflow_dispatch`. Job `build` ("Clone & Build", ubuntu-latest): checkout@v4 → setup-node@v4 `{ node-version: 24, cache: npm }` → `npm ci` → `npm audit --audit-level=high` → `npx tsc --noEmit` → `npm run lint` → `npm test --if-present` → `npm run build` with `env: { SKIP_ENV_VALIDATION: '1' }`.
- [ ] `dependabot.yml`: version 2; npm weekly, open-pull-requests-limit 5, group `minor-and-patch` (`minor`,`patch`); github-actions weekly.
- [ ] Verify locally: each step's command passes from a clean checkout (`git stash -u` discipline or scratch clone).
- [ ] Gate: G1. Commit: `ci: fresh-clone gate`

---

## Phase 2 — Environment & logger

### Task 6 — `feat(env): t3-env validated environment`
**Files:** Create `lib/env/index.ts`, `lib/env/index.test.ts`. **New deps:** `@t3-oss/env-nextjs`, `zod`.
**Contract:** `export const env: { LOG_LEVEL?: 'fatal'|'error'|'warn'|'info'|'debug'|'trace' }` via `createEnv` — `emptyStringAsUndefined: true`, `skipValidation: !!process.env.SKIP_ENV_VALIDATION`, every key wired in `runtimeEnv` explicitly.
**Test mechanics:** `// @vitest-environment node` pragma; snapshot `process.env` in `beforeEach`/restore in `afterEach`; `vi.resetModules()` + dynamic `await import('./index')` per cycle.
- [ ] Cycle 1: `LOG_LEVEL` unset → import succeeds, `env.LOG_LEVEL === undefined`. (RED: module doesn't exist — `Cannot find module`.)
- [ ] Cycle 2: `LOG_LEVEL='debug'` → `env.LOG_LEVEL === 'debug'`.
- [ ] Cycle 3 (fail-closed): `LOG_LEVEL='banana'` → import **rejects** (zod enum). Divergence note: old branch used plain optional string; enum is deliberately stronger.
- [ ] Cycle 4: `LOG_LEVEL=''` → `undefined` (emptyStringAsUndefined).
- [ ] Cycle 5: `SKIP_ENV_VALIDATION='1'` + `LOG_LEVEL='banana'` → import succeeds (escape hatch for `next build`).
- [ ] Gate: G1. Commit: `feat(env): t3-env validated environment`

### Task 7 — `feat(observability): pino logger`
**Files:** Create `lib/logger.ts`, `lib/logger.test.ts`. **New deps:** `pino`, `pino-pretty` (dev).
**Contract:** `export const logger: pino.Logger` — level `env.LOG_LEVEL ?? 'info'`; `transport: { target: 'pino-pretty' }` only when `NODE_ENV !== 'production'`; no redaction. Purpose boundary comment: ops/denials only — audit facts go to the DB.
**Test mechanics:** node environment; `vi.resetModules()` + mock `@/lib/env` per cycle.
- [ ] Cycle 1: env without LOG_LEVEL → `logger.level === 'info'`.
- [ ] Cycle 2: env `LOG_LEVEL:'debug'` → `logger.level === 'debug'`.
- [ ] Cycle 3: `typeof logger.child === 'function'` (real pino instance).
- [ ] Gate: G1. Commit: `feat(observability): pino logger`

---

## Phase 3 — Persistence

### Task 8 — `test(verification): Testcontainers integration harness`
**Files:** Create `vitest.integration.config.mts`, `lib/db/__tests__/rls-test-db.ts`, `lib/db/__tests__/harness.integration.test.ts`; modify `package.json`. **New deps:** `@testcontainers/postgresql`, `testcontainers`, `pg`, `@types/pg`.
- [ ] `vitest.integration.config.mts` (literal): `resolve.tsconfigPaths: true`; `test: { include: ['**/*.integration.test.ts'], testTimeout: 60_000, hookTimeout: 60_000, passWithNoTests: true, env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key' } }` (does NOT load `.env`).
- [ ] Script: `"test:integration": "vitest run --config vitest.integration.config.mts"`.
- [ ] Harness contract (`rls-test-db.ts`): `startRlsTestDb(): Promise<{ container, admin: pg.Pool, cleanup(): Promise<void> }>` — boots `new PostgreSqlContainer('postgres:17')`, admin pool on `container.getConnectionUri()` (superuser), cleanup = `admin.end()` then `container.stop()`. (`appConnUri` + migrate arrive Task 9.)
- [ ] Smoke test: harness boots; `admin.query('select 1')` returns; cleanup stops container without error. (RED: helper module missing.)
- [ ] Gate: G2. Commit: `test(verification): Testcontainers integration harness`

### Task 9 — `feat(db): drizzle pipeline + app_user runtime role`
**Files:** Create `drizzle.config.ts`, `lib/db/schema/roles.ts`, `lib/db/schema/index.ts`, `lib/db/client.ts`, `lib/db/__tests__/migrations.integration.test.ts`, migration `drizzle/0000_*` (M0); modify `lib/env/index.ts` + test, `lib/db/__tests__/rls-test-db.ts`, `package.json`. **New deps:** `drizzle-orm`, `drizzle-kit`.
- [ ] Env cycles first: add server var `DATABASE_URL: z.string().min(1)` — Cycle: unset `DATABASE_URL` → import rejects (true fail-closed red); set → value exposed. `MIGRATE_DATABASE_URL` stays `process.env`-only (consumed by `drizzle.config.ts` at CLI time — Charter D1 build-time exception).
- [ ] `drizzle.config.ts` (literal contract): dotenv `.env.local`; `dialect: 'postgresql'`; `schema: ['./lib/db/schema/*.ts', './app/_features/*/schema.ts']`; `out: './drizzle'`; `dbCredentials.url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL!`; `entities: { roles: true }`.
- [ ] `schema/roles.ts`: `export const appUser = pgRole('app_user')`. `schema/index.ts`: re-exports all foundation slices (Composition root — Charter §3).
- [ ] `lib/db/client.ts` contract: `export const db = drizzle(env.DATABASE_URL, { schema })` (node-postgres; pool exposed as `db.$client`). Connects as **app_user** at runtime.
- [ ] Generate M0: `npm run db:generate` → emits `CREATE ROLE "app_user";` — hand-append `GRANT USAGE ON SCHEMA "public" TO "app_user";`. Role is NOLOGIN/INHERIT/no-BYPASSRLS — LOGIN is harness/env concern, never schema.
- [ ] Harness extension: after migrate (programmatic `migrate(drizzle(admin), { migrationsFolder: './drizzle' })` — add to `startRlsTestDb`), run `ALTER ROLE app_user WITH LOGIN PASSWORD 'apppw'`; expose `appConnUri = postgresql://app_user:apppw@<host>:<port>/<db>`.
- [ ] Migration smoke cycles (RED first — no migration applied yet): role `app_user` exists with `rolcanlogin=false`, `rolsuper=false`; `has_schema_privilege('app_user','public','USAGE')` is true.
- [ ] Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`, `"db:studio": "drizzle-kit studio"`.
- [ ] Gate: G2. Commit: `feat(db): drizzle pipeline + app_user runtime role`

### Task 10 — `feat(db): withUserContext GUC plumbing`
**Files:** Create `lib/db/with-user-context.ts`, `lib/db/with-user-context.test.ts`, `lib/db/__tests__/with-user-context.integration.test.ts`.
**Contract:** `export async function withUserContext<T>(ctx: { userId: string; roles: string[] }, fn: (tx) => Promise<T>): Promise<T>` — Zod-validates ctx (`userId` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`, message `'userId must be a UUID'`; `roles: string[]`), then `db.transaction` running `select set_config('app.user_id', <userId>, true)` and `select set_config('app.user_roles', <JSON.stringify(roles)>, true)` before `fn(tx)`. `true` = transaction-scoped (pool-safe). No `SET ROLE` ever.
**Unit mocks:** `@/lib/db/client` → `{ db: { transaction: vi.fn(async cb => cb({ execute: vi.fn() })) } }`.
- [ ] Cycle 1: `userId: ''` → rejects; `db.transaction` never called.
- [ ] Cycle 2: `userId: 'not-a-uuid'` → rejects with message containing `userId must be a UUID`; no transaction.
- [ ] Cycle 3: valid UUID `'11111111-1111-1111-1111-111111111111'` → `fn` runs, returns `'ok'`; transaction called exactly once.
- [ ] Cycle 4 (integration, via `appConnUri` import-order trick: set `process.env.DATABASE_URL = appConnUri` **before** `await import('@/lib/db/client')`): inside `withUserContext({ userId: A, roles: ['owner'] })`, `select current_setting('app.user_id', true)` returns A and `current_setting('app.user_roles', true)` returns `'["owner"]'`; outside the transaction both come back empty/NULL.
- [ ] Gate: G2. Commit: `feat(db): withUserContext GUC plumbing`

### Task 11 — `ci: integration tests in pipeline`
**Files:** Modify `.github/workflows/ci.yml`.
- [ ] Append to `build` job after unit tests: cache step `actions/cache@v4` `{ path: ~/.cache/tc-images.tar, key: tc-images-${{ runner.os }}-postgres17-ryuk }` (id `tc-images`) → `if cache-hit == 'true'`: `docker load -i ~/.cache/tc-images.tar` → `npm run test:integration` → `if cache-hit != 'true'`: `mkdir -p ~/.cache && docker save -o ~/.cache/tc-images.tar $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -vi '<none>')`. Build step stays last.
- [ ] Gate: G2. Commit: `ci: integration tests in pipeline`

---

## Phase 4 — Identity (+ audit table)

### Task 12 — `feat(identity): supabase server + browser clients`
**Files:** Create `lib/supabase/server.ts`, `lib/supabase/server.test.ts`, `lib/supabase/browser.ts`, `lib/supabase/browser.test.ts`; modify `lib/env/index.ts` + test. **New deps:** `@supabase/ssr`, `@supabase/supabase-js`.
- [ ] Env cycles: add client vars `NEXT_PUBLIC_SUPABASE_URL: z.string().url()` (RED: invalid URL rejects) and `NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)`; both wired in `runtimeEnv`.
**Contracts:** `getServerSupabase(): Promise<SupabaseClient>` (cookie-bound via `await cookies()`, anon key — RLS applies); `getSupabaseClient(): SupabaseClient` (module-singleton browser client, `realtime: { params: { eventsPerSecond: 10 } }`).
**Mocks:** `vi.hoisted` factories — `@supabase/ssr` → `{ createServerClient, createBrowserClient }`; `next/headers` → `{ cookies: async () => ({ getAll: () => [], set: () => {} }) }`; `@/lib/env` → fixed values `http://127.0.0.1:54321` / `'anon-key'`.
- [ ] Cycle 1: `getServerSupabase()` calls `createServerClient` exactly once; arg1 contains `54321`, arg2 === `'anon-key'`.
- [ ] Cycle 2: cookie wiring — provided `cookies.getAll` delegates to the store; `setAll` loops `store.set(name, value, options)` and **swallows** store errors (Server Components throw on cookie writes; proxy owns refresh).
- [ ] Cycle 3: `getSupabaseClient() === getSupabaseClient()` (singleton); `createBrowserClient` called once with realtime params `eventsPerSecond: 10`.
- [ ] Gate: G2. Commit: `feat(identity): supabase server + browser clients`

### Task 13 — `feat(identity): profiles — role source of truth`
**Files:** Create `lib/db/schema/identity.ts`, migration M1, `lib/db/__tests__/live-db.ts`, `lib/db/__tests__/live-db.test.ts`, `lib/db/__tests__/profiles-rls.integration.test.ts`, `supabase/config.toml` (`supabase init`; commit config.toml, gitignore `supabase/.temp`); modify `lib/db/schema/index.ts`, migrations smoke test.
- [ ] `identity.ts` slice: table `profiles` — `id uuid PRIMARY KEY` (no default, **no FK to auth.users** — testcontainer portability), `email text`, `role text NOT NULL DEFAULT 'member'`, `created_at timestamptz NOT NULL DEFAULT now()`; RLS enabled; policy `profiles_select_self` FOR SELECT TO `authenticated` USING `id = auth.uid()`.
- [ ] Generate M1 + hand-edit: wrap policy + `GRANT SELECT ON profiles TO authenticated` in the auth guard, and add the guarded revoke (both skeletons verbatim):
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    GRANT SELECT ON "profiles" TO "authenticated";
    CREATE POLICY "profiles_select_self" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = auth.uid());
  END IF;
END $$;
```
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON "profiles" FROM "authenticated", "anon";
  END IF;
END $$;
```
  `CREATE TABLE` + `ENABLE ROW LEVEL SECURITY` stay outside the guard (portable; RLS-without-policy = deny-all in the harness — safe default).
- [ ] `liveDbGate` cycles (pure unit, RED first): `(true,false)→'run'`; `(true,true)→'run'`; `(false,false)→'skip'`; `(false,true)` throws matching `/CI_REQUIRE_LIVE_DB/` (message names `supabase start` and `:54322`). Live connection constant: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `connectionTimeoutMillis: 1500`; `reachable` = `select 1` in `beforeAll`; `requireLive = !!process.env.CI_REQUIRE_LIVE_DB`.
- [ ] Live-suite cycles (**run with local `supabase start` up**; simulate the authenticated path inside a rolled-back txn: `BEGIN; SET LOCAL ROLE authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`; seed 3 profiles MEMBER_A/MEMBER_B/OWNER as superuser, upsert, cleanup in afterAll):
  1. As MEMBER_A: `select id from profiles` contains only MEMBER_A.
  2. As OWNER: sees only OWNER (owner-reads-all deliberately deferred to F9 — recursion hazard).
  3. As MEMBER_A: `update profiles set role='owner' where id=MEMBER_A` rejects `/permission denied/i`; role still `'member'` on re-read (write-lock fails **loudly**).
- [ ] Migration smoke extension: `profiles` columns exactly `(id uuid, email text, role text, created_at timestamptz)`; `relrowsecurity = true` — on the plain container (guarded blocks no-op).
- [ ] Gate: G3. Commit: `feat(identity): profiles — role source of truth`

### Task 14 — `feat(identity): getSessionUser resolver`
**Files:** Create `lib/auth/session.ts`, `lib/auth/session.test.ts`, `lib/auth/user.ts`.
**Contracts:** `export type SessionUser = { userId: string; email: string | null; roles: string[] }`; `getSessionUser(): Promise<SessionUser | null>` — the ONLY identity resolver; reads `supabase.auth.getUser()`, then own `profiles` row via `.from('profiles').select('role').eq('id', user.id).single()` (authenticated client → `profiles_select_self` applies); `roles` = `[role]` wrapped as array (CASL/GUC parity). `user.ts`: `export type AuthUser = { name?: string|null; email?: string|null; image?: string|null }`.
**Mocks:** `@/lib/supabase/server` hoisted; helper `supabaseWith(user, role)` builds `{ auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: role ? { role } : null }) }) }) }) }`.
- [ ] Cycle 1: no user → resolves `null`; `from('profiles')` never called.
- [ ] Cycle 2: user `{id:'u1',email:'a@b.com'}` + profile `'owner'` → exactly `{ userId:'u1', email:'a@b.com', roles:['owner'] }`.
- [ ] Cycle 3: user with no profile row → `roles: []`.
- [ ] Cycle 4: user with `email: undefined` → `email: null`.
- [ ] Gate: G2. Commit: `feat(identity): getSessionUser resolver`

### Task 15 — `feat(observability): sign_in_log audit table`
**Files:** Create `lib/db/schema/audit.ts`, migration M2, `lib/audit/record-sign-in.ts`, `lib/audit/record-sign-in.test.ts`, `lib/db/__tests__/sign-in-log-rls.integration.test.ts`; modify `lib/db/schema/index.ts`, migrations smoke test.
- [ ] `audit.ts` slice: table `sign_in_log` — `id uuid PK DEFAULT gen_random_uuid()`, `user_id uuid` (nullable), `email text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`. **No `success` column — ever** (rows are successful logins by definition). Policy `sign_in_log_owner_read` FOR ALL TO `app_user`: USING `coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)` (missing GUC ⇒ deny); WITH CHECK `true` (recorder inserts without a session).
- [ ] Generate M2 + hand-append: `GRANT SELECT, INSERT ON "sign_in_log" TO "app_user";` (no UPDATE/DELETE).
- [ ] `recordSignIn` contract: `recordSignIn(entry: { userId: string | null; email: string }): Promise<void>` — best-effort: insert via `db`; on ANY failure, `logger.warn('failed to write sign_in_log', …)` and return normally.
- [ ] Unit cycles: insert called with `{ userId:'u1', email:'a@b.com' }`; DB rejection → resolves anyway + `logger.warn` called; never throws.
- [ ] Integration cycles (superuser client + `set role app_user`, session-scoped `set_config(…, false)`, seed 1 row as superuser): member roles `['member']` → select returns `[]`; `['owner']` → returns the seeded email; roles `[]` → INSERT succeeds (WITH CHECK true), re-read as superuser confirms.
- [ ] Migration smoke: columns exactly `(id uuid, user_id uuid, email text, created_at timestamptz)`.
- [ ] Gate: G2. Commit: `feat(observability): sign_in_log audit table`

### Task 16 — `feat(identity): sign-in/out actions + login page`
**Files:** Create `app/_features/auth/actions.ts` (`'use server'`), `app/_features/auth/actions.test.ts`, `app/_features/auth/LoginForm.tsx` (`'use client'`), `app/_features/auth/LoginForm.test.tsx`, `app/login/page.tsx`.
**Contracts:** `interface LoginState { error?: string }`; `signInAction(_prev: LoginState, formData: FormData): Promise<LoginState>`; `signOutAction(): Promise<void>`. Input schema exact: `z.object({ email: z.string().email(), password: z.string().min(1) })`; on parse failure return `{ error: issues[0].message }`. **No registration path — do not create one (ADR-0003).**
**Mocks (vi.hoisted):** `@/lib/supabase/server`, `@/lib/audit/record-sign-in`, `@/lib/logger`, `next/navigation` → `{ redirect: vi.fn() }`.
- [ ] Cycle 1: valid creds → `signInWithPassword({ email, password })` called; `recordSignIn({ userId: 'u1', email })` called; `logger.info` 'login succeeded'; `redirect('/dashboard')`.
- [ ] Cycle 2: GoTrue error `{ message: 'Invalid login credentials' }` → returns exactly `{ error: 'Invalid login credentials' }`; no redirect; no recordSignIn; `logger.warn` 'login failed'.
- [ ] Cycle 3: `email='not-an-email'` → `{ error: <zod message> }`; Supabase never called.
- [ ] Cycle 4: `signOutAction` → `supabase.auth.signOut()` then `redirect('/')`.
- [ ] LoginForm cycles (jsdom): renders `aria-hidden` skeleton pre-mount, then (after effect) inputs `name="email"` (type email, required) + `name="password"` (type password, required, autoComplete current-password) and submit button `Sign in`; `useActionState(signInAction, {})`; `state.error` rendered above the form. (Hydration quirk: password managers mutate DOM pre-hydration — mounted-deferral is load-bearing.)
- [ ] `app/login/page.tsx`: server component — if `getServerSupabase().auth.getUser()` has a user → `redirect('/dashboard')` (behavioral test lands in Task 23 E2E — recorded deviation); renders back-link `← Back` → `/`, h1 `Sign in`, `<LoginForm />`.
- [ ] Gate: G2. Commit: `feat(identity): sign-in/out actions + login page`

### Task 17 — `feat(shell): proxy + public-route policy`
**Files:** Create `lib/permissions/routes.ts`, `lib/permissions/routes.test.ts`, `proxy.ts`, `proxy.test.ts`.
**Contracts:** `isPublicPath(pathname: string): boolean` — true ONLY for `'/'` and `'/login'` (strict equality). **`canAccessRoute` is not built** (dropped stub — F9/F11). `proxy.ts`: `export async function proxy(request: NextRequest)` (named export, Node runtime — `runtime` cannot be configured) + `export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)'] }`.
- [ ] routes cycles: `'/'` true; `'/login'` true; `'/register'` false; `'/dashboard'` false; `'/orders'` false; prefix paths like `'/login/x'` false.
- [ ] proxy cycles (mock `@supabase/ssr` createServerClient + cookie plumbing): (1) every matched request calls `auth.getUser()` (session refresh); (2) public path + no user → pass-through; (3) protected path + no user → redirect `/login`; (4) protected + no user + error `refresh_token_not_found` → redirect `/login` AND every `sb-*` cookie deleted; (5) protected + user → pass-through (authorization is NOT proxy's job — Iron Rule 5; Server Action POSTs can bypass matchers).
- [ ] Gate: G2. Commit: `feat(shell): proxy + public-route policy`

---

## Phase 5 — Authorization seam

### Task 18 — `feat(authz): ability composition seam`
**Files:** Create `lib/permissions/ability.ts`, `lib/permissions/ability.test.ts`, `lib/registry/abilities.ts`. **New dep:** `@casl/ability`.
**Contracts:**
```ts
export type Identity = { userId?: string; roles: string[] }
export type AbilityContributor = (can: AbilityBuilder<MongoAbility>['can'], identity: Identity) => void
export function buildAbility(identity: Identity, contributors?: AbilityContributor[]): MongoAbility  // default: registry list
// lib/registry/abilities.ts (composition root — flat list, zero logic):
export const abilityContributors: AbilityContributor[] = []
```
- [ ] Cycle 1 (fail-closed): `buildAbility({ roles: ['owner'] }, [])` → `.can('read','SignInLog') === false` — empty registry grants nothing.
- [ ] Cycle 2: a test contributor `can('read','Thing')` → granted; unrelated actions still false.
- [ ] Cycle 3: two contributors compose (each grants a distinct subject; both granted).
- [ ] Cycle 4: contributor receives identity — a contributor granting `can('read','Thing', { createdBy: identity.userId })` matches `subject('Thing', { createdBy: 'u1' })` for `u1` and rejects for `u2` (CASL conditional rules need `subject()` instances — bare strings bypass conditions).
- [ ] Gate: G2. Commit: `feat(authz): ability composition seam`

### Task 19 — `feat(authz): withPermission guard`
**Files:** Create `lib/permissions/guard.ts`, `lib/permissions/guard.test.ts`.
**Contract:** `withPermission<T>(action: string, subject: string, fn: (ctx: { userId: string; roles: string[] }) => Promise<T>): Promise<T>` — resolves `getSessionUser()` ONCE; no session/userId → `logger.warn` + `throw new Error('Not authenticated')` **before** any CASL evaluation; ability via `buildAbility` (registry default); denial → `logger.warn({ email, userId, roles, action, subject }, 'authorization denied')` + `throw new Error('Not authorized')`; allowed → `fn({ userId, roles })`. `roles` defaults `[]`.
**Mocks:** `@/lib/auth/session`, `@/lib/logger`; registry stubbed with a test contributor granting `read Thing` to role `'reader'`.
- [ ] Cycle 1: allowed role → `fn` runs, value returned, `logger.warn` not called.
- [ ] Cycle 2: `fn` receives exactly `{ userId, roles }` from the session.
- [ ] Cycle 3: wrong role → throws `'Not authorized'`; `fn` not called; warn called with full payload.
- [ ] Cycle 4: `getSessionUser()` → `null` → throws `'Not authenticated'`; `fn` not called.
- [ ] Cycle 5: session without `userId` → throws `'Not authenticated'`.
- [ ] Gate: G2. Commit: `feat(authz): withPermission guard`

---

## Phase 6 — Shell, activity, abuse resistance

### Task 20 — `feat(shell): branding + layouts + nav registry`
**Files:** Create `lib/branding.ts`, `lib/registry/nav.ts`, `app/_features/landing/LandingPage.tsx` + test, `app/_features/shell/PageHeader.tsx` + test, `app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx` + test; modify `app/layout.tsx`, `app/page.tsx`.
**Contracts:**
```ts
// lib/branding.ts — the ONLY home of tenant strings:
export const branding = {
  productName: 'Polaris', tagline: 'Cold chain logistics platform.',
  logo: { src: '/zeefoods_logo.svg', alt: 'Zee Foods logo', width: 80, height: 80 },
  wordmark: { src: '/zeefoods_letters.svg', alt: 'Zee Foods', width: 200, height: 97 },
} as const
// lib/registry/nav.ts (composition root):
export type NavItem = { label: string; href: string; permission?: { action: string; subject: string } }
export const navItems: NavItem[] = []
```
- [ ] Cycle 1 (PageHeader): always a link `branding.productName` → `/`; anon → link `Log in` → `/login`; authed → submit button `Log out` inside `<form action={signOutAction}>` and NO `Log in` link. (Mock `../auth/actions` — the one sanctioned shell→auth edge.)
- [ ] Cycle 2 (LandingPage): anon → header has `Log in`, no Dashboard link; authed → `Log out` button + main link `Dashboard` → `/dashboard`; h1 = `branding.productName`; tagline rendered from config (assert via changing a test-scoped branding mock — strings must come from `lib/branding`, not literals).
- [ ] Cycle 3 (dashboard page): renders nav from `navItems` filtered by `buildAbility(session)` (`permission` absent ⇒ always shown) — with empty registry, **zero** feature links render (no hardcoded Orders/Notes/Activity).
- [ ] Cycle 4 (root layout): `metadata.title === branding.productName`, description = tagline (scaffold "Create Next App" gone); Geist fonts; `(dashboard)/layout.tsx` = `getSessionUser()` → `PageHeader` + `<main>` (redirect behavior covered in Task 23 E2E — recorded deviation).
- [ ] `app/page.tsx`: `getSessionUser()` → `<LandingPage user={session ? { email: session.email } : null} />`.
- [ ] Gate: G2. Commit: `feat(shell): branding + layouts + nav registry`

### Task 21 — `feat(shell): chunk-error auto-reload`
**Files:** Create `app/_features/shell/ChunkErrorReloader.tsx` + test; modify `app/layout.tsx` (mount it).
**Contract:** client component rendering `null`; window `error` + `unhandledrejection` listeners; pattern `/ChunkLoadError|Loading chunk [\w/-]+ failed|Failed to load chunk/i`; sessionStorage key `'chunk-reload-at'`; `COOLDOWN_MS = 10_000`; listeners removed on unmount.
**Test mechanics:** redefine `window.location` via `Object.defineProperty` with a `reload` spy; `sessionStorage.clear()` per test; dispatch `ErrorEvent('error', { message })` / `Event('unhandledrejection')` with `reason`.
- [ ] Cycle 1: chunk-pattern `error` event → `reload()` exactly once.
- [ ] Cycle 2: chunk-pattern rejection (`reason` Error) → reload once.
- [ ] Cycle 3: unrelated error (`'TypeError: x is not a function'`) → no reload.
- [ ] Cycle 4: two chunk errors back-to-back → still exactly one reload (cooldown via sessionStorage timestamp).
- [ ] Gate: G2. Commit: `feat(shell): chunk-error auto-reload`

### Task 22 — `feat(shell): security headers + report-only CSP`
**Files:** Create `lib/security-headers.ts` + test; modify `next.config.ts`.
**Contract:** `export const securityHeaders: { key: string; value: string }[]` consumed by `next.config.ts` `headers()` for `source: '/:path*'`; plus `poweredByHeader: false`. Exact pairs: `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`; `Permissions-Policy: camera=(), microphone=(), geolocation=()`; `Content-Security-Policy-Report-Only` = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` (report-only deliberately: realtime adds `connect-src wss://` later; enforce+nonce at deploy).
- [ ] Cycle 1: list contains exactly those 6 keys with exact values; no enforcing `Content-Security-Policy` key.
- [ ] Gate: G2. Commit: `feat(shell): security headers + report-only CSP`

### Task 23 — `test(e2e): playwright harness + auth journeys`
**Files:** Create `playwright.config.ts`, `e2e/global-setup.ts`, `e2e/global-teardown.ts` (no-op), `e2e/helpers.ts`, `e2e/landing.spec.ts`, `e2e/login.spec.ts`, `e2e/login-failure.spec.ts`, `e2e/logout.spec.ts`, `e2e/security-headers.spec.ts`, `.env.test`, `.env.test.example`; modify `package.json`. **New dep:** `@playwright/test`. **Requires local `supabase start`.**
- [ ] `playwright.config.ts` (literal): dotenv `.env.test`; `testDir './e2e'`; globalSetup/Teardown paths; `fullyParallel: false`; `forbidOnly: !!CI`; `retries: CI ? 2 : 0`; `workers: 1`; `reporter: 'html'`; `use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' }`; chromium project only; `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: false }`.
- [ ] `.env.test` (committed; local demo keys only): `TEST_USER_EMAIL=owner@example.com`, `TEST_USER_PASSWORD=test-password-123`, `DATABASE_URL=postgresql://app_user:apppw@127.0.0.1:54322/postgres`, `MIGRATE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (from `supabase status`).
- [ ] `global-setup` sequence: pg.Pool on MIGRATE_DATABASE_URL → programmatic `migrate(…, './drizzle')` → `ALTER ROLE "<user from DATABASE_URL>" WITH LOGIN PASSWORD '<password>'` → `TRUNCATE sign_in_log` → GoTrue admin client (`createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })`) → `seedUser(owner@example.com, 'owner')`, `seedUser('member@example.com', 'member')`. `seedUser` idempotent: `admin.auth.admin.createUser({ email, password, email_confirm: true })`; on "already registered" fall back to `listUsers()` lookup; then SQL upsert `insert into profiles (id,email,role) values ($1,$2,$3) on conflict (id) do update set role = excluded.role`.
- [ ] `helpers.ts`: `loginViaSupabase(page, email = process.env.TEST_USER_EMAIL!)` — real UI flow: goto `/login`, fill `input[name="email"]` / `input[name="password"]` (shared `TEST_USER_PASSWORD`), click button `Sign in`, expect URL `/dashboard`.
- [ ] Journeys (exact selectors/asserts): **landing** — anon header `Log in` link → `/login`; authed landing shows `Dashboard` link. **login** — valid creds → `Log out` button visible; anon `goto('/dashboard')` → URL `/login`. **login-failure** — `nobody@example.com`/`wrong-password` → stays `/login`, `text=/invalid/i` visible. **logout** — `Log out` → URL `/`; then `/dashboard` → `/login`; password input visible again (no lingering session). **security-headers** — response headers: `x-frame-options=DENY`, `x-content-type-options=nosniff`, `referrer-policy=strict-origin-when-cross-origin`, `permissions-policy` contains `geolocation=()`, `x-powered-by` undefined; `content-security-policy-report-only` contains `default-src 'self'` and `frame-ancestors 'none'`; enforcing CSP undefined.
- [ ] Script: `"test:e2e": "playwright test"`; `npx playwright install chromium` once.
- [ ] Gate: G4. Commit: `test(e2e): playwright harness + auth journeys`

### Task 24 — `feat(observability): activity viewer`
**Files:** Create `app/_features/activity/permissions.ts` + test, `app/_features/activity/nav.ts`, `app/_features/activity/getSignInLog.ts` + test, `app/(dashboard)/activity/page.tsx`, `e2e/activity.spec.ts`; modify `lib/registry/abilities.ts`, `lib/registry/nav.ts` (first real entries).
**Contracts:** contributor — `roles.includes('owner')` ⇒ `can('read','SignInLog')`; nav — `{ label: 'Activity', href: '/activity', permission: { action: 'read', subject: 'SignInLog' } }`; `getSignInLog(): Promise<SignInLogRow[]>` = `withPermission('read','SignInLog', ctx => withUserContext(ctx, tx => select … orderBy desc(created_at) limit 100))`.
- [ ] Cycle 1 (contributor): `buildAbility({roles:['owner']})` can read SignInLog; `['member']` and `[]` cannot (registry now wired — Cycle re-runs against real registry).
- [ ] Cycle 2 (getSignInLog): guard denial propagates (`'Not authorized'` for member — mock session); owner path calls `withUserContext` and returns mapped rows.
- [ ] Cycle 3 (page): owner renders h1 `Sign-in log` + table headers `Email / User / When (UTC)`, empty-state row `No sign-ins recorded yet.`; non-owner → `redirect('/dashboard')`.
- [ ] Cycle 4 (dashboard nav): owner sees `Activity` link; member does not (registry + ability filter — proves the seam end-to-end).
- [ ] E2E (4): owner `/activity` → heading + table visible; member `/activity` → redirected `/dashboard`, table count 0; owner dashboard `Activity` link → `/activity`; member dashboard has no `Activity` link.
- [ ] Gate: G4. Commit: `feat(observability): activity viewer`

### Task 25 — `feat(abuse): rate-limiter factory`
**Files:** Create `lib/rate-limit.ts`, `lib/rate-limit.test.ts`. **New dep:** `rate-limiter-flexible`.
**Contract:** `createRateLimiter(opts: { points: number; duration: number }): RateLimiterMemory`; `withRateLimit<T>(limiter: RateLimiterAbstract, key: string, fn: () => Promise<T>): Promise<T>` — consume before `fn`; on rejection: `instanceof Error` ⇒ rethrow unchanged (store failure); else (RateLimiterRes) ⇒ throw `` `Rate limit exceeded. Retry in ${Math.ceil(msBeforeNext/1000)}s` ``. **No feature limiter instances in this module — ever** (Charter D6).
- [ ] Cycle 1: under limit → `fn` runs, value returned.
- [ ] Cycle 2: exactly `points` allowed; next call rejects matching `/rate limit/i`; `fn` not invoked on the rejected call.
- [ ] Cycle 3: keys independent — exhausting `'a'` doesn't block `'b'`; `'a'` still blocked.
- [ ] Cycle 4: store failure (`consume` rejecting with `Error`) → that exact Error rethrown, not the throttle message.
- [ ] Gate: G2. Commit: `feat(abuse): rate-limiter factory`

---

## Phase 7 — Realtime plumbing

### Task 26 — `feat(realtime): topic grammar + hook + SQL templates`
**Files:** Create `lib/realtime/topics.ts` + test, `lib/realtime/use-topic.ts` + test, `lib/realtime/templates/broadcast-trigger.sql`, `lib/realtime/templates/realtime-messages-policy.sql`, `lib/realtime/templates/README.md`.
**Contracts:** `topicFor(domain: string, userId: string): string` → `` `${domain}:${userId}` ``; `topicAll(domain: string): string` → `` `${domain}:all` ``; `useTopic(topic: string, opts: { event: string; onMessage: (payload: unknown) => void }): void` — on mount: `await client.realtime.setAuth()` (private channels need the session token on the socket), `client.channel(topic, { config: { private: true } }).on('broadcast', { event: opts.event }, handler).subscribe()`; cleanup `client.removeChannel(channel)`.
- [ ] Cycle 1: `topicFor('notes','u1') === 'notes:u1'`; `topicAll('notes') === 'notes:all'`.
- [ ] Cycle 2 (mocked browser client): hook calls `setAuth` before `channel()`; channel created with `{ config: { private: true } }`; `.on('broadcast', { event }, …)` wired; unmount → `removeChannel(channel)`.
- [ ] Templates (documentation artifacts — executable red arrives in Task 29): trigger template = `$DOMAIN`-parameterized SECURITY DEFINER plpgsql function (`SET search_path = public, realtime`) computing `owner_id := coalesce(NEW.created_by, OLD.created_by)` and calling `realtime.broadcast_changes('<domain>:' || owner_id::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD)` then the same to `'<domain>:all'`, `RETURN NULL`; `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW` trigger with `DROP TRIGGER IF EXISTS` first. Policy template = `FOR SELECT TO authenticated USING (realtime.topic() = '<domain>:' || (select auth.uid())::text OR (realtime.topic() = '<domain>:all' AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'owner')))`. Both wrapped in the realtime guard:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'realtime') THEN
    -- template body here
  END IF;
END $$;
```
  README: copy into a `drizzle-kit generate --custom` migration, replace `$DOMAIN`, never row-RLS the streamed table for delivery (ADR-0002).
- [ ] Gate: G2. Commit: `feat(realtime): topic grammar + subscription hook + SQL templates`

---

## Phase 8 — The `notes` exemplar

### Task 27 — `feat(notes): schema slice + ownership RLS`
**Files:** Create `app/_features/notes/schema.ts`, migration M3, `app/_features/notes/__tests__/notes-rls.integration.test.ts`; modify `lib/db/schema/index.ts` (registry line), migrations smoke test.
- [ ] Slice: table `notes` — `id uuid PK DEFAULT gen_random_uuid()`, `created_by uuid NOT NULL`, `body text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`. Policy `notes_owner_or_self` FOR ALL TO `app_user`: USING `created_by = current_setting('app.user_id', true)::uuid OR coalesce(nullif(current_setting('app.user_roles', true), '')::jsonb @> '["owner"]'::jsonb, false)`; WITH CHECK `created_by = current_setting('app.user_id', true)::uuid` (**no owner branch** — even owners only write rows as themselves).
- [ ] Generate M3 + hand-append `GRANT SELECT, INSERT, UPDATE, DELETE ON "notes" TO "app_user";`.
- [ ] Integration cycles (via `appConnUri` + real `withUserContext` — prod-shaped; seed via admin): A(`[]`) sees only A's note; B(`[]`) sees only B's; B(`['owner']`) sees both; delimiter guard — roles `['x,owner']` sees only own (JSONB `@>` matches whole elements, never comma-splits).
- [ ] Migration smoke: `notes` columns exact; `relrowsecurity` true.
- [ ] Gate: G2. Commit: `feat(notes): schema slice + ownership RLS`

### Task 28 — `feat(notes): ability contribution + actions`
**Files:** Create `app/_features/notes/permissions.ts` + test, `app/_features/notes/actions.ts` + test, `app/_features/notes/actions.integration.test.ts`; modify `lib/registry/abilities.ts` (registry line).
**Contracts:** contributor — always `can('create','Note')` and `can('read','Note', { createdBy: identity.userId })`; `roles.includes('owner')` ⇒ unconditional `can('read','Note')`. Actions (`'use server'`): `getNotes(): Promise<NoteRow[]>` = `withPermission('read','Note', ctx => withUserContext(ctx, tx => select … orderBy desc(created_at)))`; `createNote(formData: FormData): Promise<void>` = `withPermission('create','Note', ctx => withRateLimit(notesWriteLimiter, \`notes:create:${ctx.userId}\`, () => withUserContext(ctx, tx => insert { createdBy: ctx.userId, body })))` then `revalidatePath('/notes')`. `notesWriteLimiter = createRateLimiter({ points: 30, duration: 60 })` — owned HERE, in the feature. Body schema: `z.string().min(1).max(2000)`; invalid body → throw/return error before any DB call. Pipeline order is contractual: guard → limiter → validate → context.
- [ ] Cycle 1 (contributor): member reads own `subject('Note',{createdBy:me})` only; owner reads any; everyone can create.
- [ ] Cycle 2 (unit, mocks): empty body → no insert, validation error surfaced; limiter exhausted → throws `/rate limit/i`, no insert.
- [ ] Cycle 3 (integration, mocked session + real DB as `app_user`): A creates → `getNotes()` as A returns 1 row `createdBy = A`; as B returns only B's; as B+`['owner']` returns all.
- [ ] Gate: G2. Commit: `feat(notes): ability contribution + actions`

### Task 29 — `feat(notes): realtime + live island + page + e2e`
**Files:** Create migration M4 (from D7 templates, `$DOMAIN`→`notes`), `app/_features/notes/use-notes-realtime.ts` + test, `app/_features/notes/NotesLive.tsx` + test, `app/_features/notes/nav.ts`, `app/(dashboard)/notes/page.tsx`, `app/_features/notes/__tests__/notes-broadcast.integration.test.ts`, `e2e/notes.spec.ts`, `e2e/realtime-notes.spec.ts`; modify `lib/registry/nav.ts`, `e2e/global-setup.ts` (TRUNCATE adds `notes`). **Requires local `supabase start`.**
- [ ] M4 via `drizzle-kit generate --custom`: function `broadcast_note_change()` + trigger `notes_broadcast` + policy `notes_read_own_topic` — instantiate both templates exactly; realtime-guarded (no-op on plain Postgres).
- [ ] Hook cycles: `useNotesRealtime(userId, initial: NoteRow[]): NoteRow[]` — subscribes via `useTopic(topicFor('notes', userId), { event: 'INSERT', … })`; handler reads `payload.record` `{ id, created_by, body, created_at }`, dedups by id, **prepends** (newest-first, matches server `desc`).
- [ ] NotesLive cycles: empty → `<p data-testid="no-notes">No notes yet.</p>`; rows → table with `data-testid="note-row"` per row.
- [ ] Page: h1 `Notes`; form `action={createNote}` with `input name="body"` + submit button `New note`; `<NotesLive userId={session.userId} initial={rows} />`. Nav entry `{ label: 'Notes', href: '/notes' }` (no permission — all authed users).
- [ ] Live integration (gate via `liveDbGate`): insert as OWNER → `realtime.messages` count ≥ 1 for `notes:<OWNER>` AND for `notes:all`; channel-auth probe (`set local role authenticated` + `request.jwt.claims.sub` + `realtime.topic` GUC, rolled back): OWNER sees own topic ≥ 1; OTHER user sees OWNER's topic = 0.
- [ ] E2E (`notes.spec.ts`, order-dependent like the old orders suite): member A creates a note (fill body, click `New note`) → `note-row` count 1; member B sees 0 of A's notes, creates own → count 1; owner sees count 2; dashboard `Notes` link visible to any user and navigates to `/notes`.
- [ ] E2E (`realtime-notes.spec.ts`): two browser contexts — A (member) and B (second member), both on `/notes`; capture both counts; A clicks `New note`; A's count rises via `expect.poll` **without reload** (live delivery on A's private topic); B waits 2000ms and B's count is unchanged (cross-user isolation). The owner `notes:all` firehose is covered by the live integration topic probe, not E2E (the page subscribes only to the user's own topic).
- [ ] Gate: G4. Commit: `feat(notes): realtime + live island + page + e2e`

### Task 30 — `test(verification): feature-confinement check`
**Files:** Create `lib/verification/feature-confinement.test.ts`; append rehearsal record to `docs/adr/0004-fresh-derivation.md`.
- [ ] Confinement test (reuses Task 4 scanner core): the string/import `notes` may appear ONLY in: `app/_features/notes/**`, `lib/registry/abilities.ts`, `lib/registry/nav.ts`, `lib/db/schema/index.ts`, `drizzle/*notes*` migration files (M3/M4) + journal/snapshots, `e2e/notes.spec.ts`, `e2e/realtime-notes.spec.ts`, `e2e/global-setup.ts` (TRUNCATE line), and this test file. RED: plant `// notes` comment in `lib/rate-limit.ts` → test fails naming the file → remove → green.
- [ ] Manual deletion rehearsal (once): `git worktree add ../polaris-rehearsal clean-rewrite-2` → in worktree: delete `app/_features/notes/`, both e2e notes specs, the registry lines, M3/M4 files + journal entries; run `npm test && npm run test:integration` → expect green; `git worktree remove --force ../polaris-rehearsal`. Record outcome in ADR-0004.
- [ ] Gate: G4 (PLAN §4: E2E at every commit from 29 on). Commit: `test(verification): feature-confinement check`

---

## Phase 9 — Full pipeline

### Task 31 — `ci: full pipeline`
**Files:** Modify `.github/workflows/ci.yml`.
- [ ] Add job `e2e` ("E2E Tests", ubuntu-latest, parallel — no `needs`), job env `DATABASE_URL: postgresql://app_user:apppw@127.0.0.1:54322/postgres`, `MIGRATE_DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Steps: checkout → setup-node(24, npm cache) → `npm ci` → Playwright browser cache (`~/.cache/ms-playwright`, key `playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`) → `npx playwright install --with-deps chromium` (miss) / `install-deps` (hit) → Supabase image cache (`~/.cache/supabase-images.tar`, key `supabase-images-${{ runner.os }}-${{ hashFiles('supabase/config.toml') }}`) + load/save pattern → `npx supabase start -x studio,imgproxy,inbucket,edge-runtime,functions,vector,analytics,meta,storage` → `npm run db:migrate` → `npm run test:integration -- profiles-rls notes-broadcast` with `env: CI_REQUIRE_LIVE_DB: '1'` (hard-fail gate — the only place it's set) → generate `.env.test` (echo the 4 fixed lines; extract 3 keys from `npx supabase status -o env` via `sed -n 's/^API_URL=\"\?\([^\"]*\)\"\?/\1/p'` pattern for `API_URL`/`ANON_KEY`/`SERVICE_ROLE_KEY`) → `npm run test:e2e`.
- [ ] Gate: G4 locally + full CI green on pushed branch tip.
- [ ] Commit: `ci: full pipeline`

---

## Phase 10 — Governance close

### Task 32 — `docs(governance): HANDBOOK — single tracked source of truth`
**Files:** Create `HANDBOOK.md` (root, tracked).
- [ ] Sections: §1 Identity & product (Polaris, internal cold-chain order tool, owner/member roles); §2 Principles (cite DOMAIN-CHARTER — no duplication); §3 Security model: 14-layer table with control → **clean-rewrite-2 file** map (this repo's paths); §4 RLS model: the two identity paths + exact GUC names; **session cookie is deliberately NOT httpOnly** (browser client needs it for Realtime auth; XSS answered by CSP enforce+nonce at deploy) — state this correctly, it was drifted in old docs; §5 `profiles` write-lock documented (revoke set + loud-failure rationale); §6 Roadmap: F6 orders-domain next (copy `notes` per playbook), F8 UI, F9 settings/invites (+SERVICE_ROLE_KEY returns to env, owner-reads-all via SECURITY DEFINER), F10 supa_audit, F11 client CASL, F12 org model; §7 Decision log: table linking ADRs 0001–0004.
- [ ] Gate: G4. Commit: `docs(governance): HANDBOOK — single tracked source of truth`

### Task 33 — `docs(governance): feature playbook + PR conventions`
**Files:** Create `CONTRIBUTING.md`, `.github/pull_request_template.md`.
- [ ] CONTRIBUTING: Charter §5 expanded with commands — copy `app/_features/notes` → rename (subjects/tables/topics via checklist); `npm run db:generate` (+ `--custom` for triggers/policies, guard skeletons); the four registry files; gate commands G1–G4; TDD loop (cite PLAN §2); branch `feature/<name>`; Conventional Commits; rebase onto trunk + fast-forward merge (no merge commits, no squash — preserves the TDD story); lockfile rule (nuke + reinstall).
- [ ] PR template checkboxes: behaviors test-first (red observed)? · gates green? · no `lib/**` changes outside `lib/registry/**` (else ADR attached)? · migrations guarded for both DB targets? · no tenant strings outside `lib/branding.ts`?
- [ ] Gate: G4. Commit: `docs(governance): feature playbook + PR conventions`

---

## Completion checklist (PLAN §5 acceptance)
- [ ] `git log --oneline bd8da074..clean-rewrite-2` — linear, 33 commits, conventional.
- [ ] Fresh-clone CI fully green; live-RLS suites **executed** in CI (not skipped).
- [ ] Confinement test green; rehearsal recorded in ADR-0004.
- [ ] Boundary rules: zero violations (ESLint + scanner).
- [ ] No business vocabulary outside `app/_features/notes/`; no Keycloak/Centrifugo references anywhere.
- [ ] Behavior parity vs `clean-rewrite` HEAD (minus orders, plus notes) — walk this document's checklists once more as an audit.
