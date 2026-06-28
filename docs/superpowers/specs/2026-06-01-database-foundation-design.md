# Feature: Database Foundation with Sign-In Log

**Branch:** `feature/database`
**Issue:** [#119](https://github.com/AhmedKhan-GH/polaris/issues/119)
**Merges into:** `clean-rewrite`

## Overview

Set up Drizzle ORM, migration infrastructure, and the first table (`sign_in_log`) to permanently record sign-in events. Includes a Testcontainers integration test to guarantee migrations work on a fresh Postgres — preventing the fresh-clone problem that triggered the clean rewrite.

## Packages

**Dependencies:**
- `drizzle-orm` — ORM and query builder
- `pg` — PostgreSQL driver
- `@types/pg` — TypeScript types for pg

**Dev dependencies:**
- `drizzle-kit` — migration generation and tooling
- `testcontainers` — throwaway Docker containers for testing
- `@testcontainers/postgresql` — Postgres-specific Testcontainers helper

## 1. Drizzle Config + Client

### `drizzle.config.ts` (project root)

- Schema path: `./lib/db/schema.ts`
- Migration output: `./drizzle/`
- Driver: `pg`
- Connection: `DATABASE_URL` env var

### `lib/db/client.ts`

- Creates a `pg` Pool using `DATABASE_URL`
- Exports a Drizzle instance wrapping that pool
- Single connection — no pooling configuration yet

### `lib/db/schema.ts`

- Exports all table definitions
- Starts with `signInLog` table only

## 2. Migration Infrastructure

### Generated output

- Migrations live in `./drizzle/` as numbered `.sql` files
- Example: `0000_create_sign_in_log.sql`

### Package.json scripts

| Script | Command | Purpose |
|---|---|---|
| `db:generate` | `drizzle-kit generate` | Generate migration from schema changes |
| `db:migrate` | `drizzle-kit migrate` | Run pending migrations |
| `db:studio` | `drizzle-kit studio` | Browse data in Drizzle Studio |

## 3. `sign_in_log` Table

### Schema

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | Primary key, `gen_random_uuid()` |
| `user_id` | uuid | Not null, references `auth.users(id)` |
| `created_at` | bigint | Not null, defaults to `extract(epoch from now())` |

Every row = one sign-in event. No action column — sign-outs are not logged (token expiry is silent and unreliable).

### RLS

- Enable RLS on `sign_in_log`
- One policy: authenticated users can insert where `auth.uid() = user_id`
- No select policy yet — admin read access comes with the permissions branch

### RLS in migrations

RLS policies are written as raw SQL appended to the generated migration file, since Drizzle does not generate RLS statements. The migration will include:

```sql
ALTER TABLE sign_in_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own sign-in logs"
  ON sign_in_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

## 4. Instrument Auth

### `signInAction` (`app/_features/auth/actions.ts`)

After a successful `signInWithPassword` call, insert a row into `sign_in_log`:
- `user_id` from the authenticated user
- `created_at` as `Math.floor(Date.now() / 1000)`

Wrapped in `try/catch` — if the insert fails, the login still succeeds. Signing in is more important than logging it.

### `signOutAction`

Untouched. No logging on sign-out.

## 5. Testcontainers Smoke Test

### `lib/db/__tests__/migrations.integration.test.ts`

1. Start a throwaway Postgres container via `@testcontainers/postgresql`
2. Run all Drizzle migrations against it
3. Assert `sign_in_log` table exists with expected columns (`id`, `user_id`, `created_at`)
4. Container is destroyed after the test

### Package.json script

| Script | Command | Purpose |
|---|---|---|
| `test:integration` | `vitest run --project integration` | Run only Testcontainers tests |

Vitest project configuration separates integration tests from unit tests so CI can add a Docker/Postgres step for integration only.

### CI update

Add `test:integration` step to `.github/workflows/ci.yml` after the existing `npm test` step. Requires Docker in the CI runner (GitHub Actions runners have Docker pre-installed).

## File Map

```
drizzle.config.ts                              (new) Drizzle Kit config
lib/db/client.ts                               (new) Drizzle client instance
lib/db/schema.ts                               (new) Table definitions
lib/db/__tests__/migrations.integration.test.ts (new) Testcontainers smoke test
drizzle/0000_create_sign_in_log.sql            (new) Generated migration
app/_features/auth/actions.ts                  (edit) Add sign-in log insert
.github/workflows/ci.yml                       (edit) Add test:integration step
package.json                                   (edit) Add db scripts, new deps
vitest.config.mts                              (edit) Add integration project config
```

## Not in scope

- **CASL / full permissions** — no resources to protect yet
- **Profiles table / roles** — comes with the vehicles + permissions branch
- **Generic `trackEvent()` helper** — direct insert until a second event type justifies abstraction
- **Pino logging** — deferred until debugging at scale justifies it
- **Connection pooling** — add when traffic justifies it
- **Select policy on `sign_in_log`** — admin read access comes with permissions branch
