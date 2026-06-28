> ⚠️ **F9 permissions-design reference — not as-built.** Kept for the *fuller* role model (six roles, last-owner protection, role-change action) that lands when **F9 (settings + owner role management)** is built. The 2-role slice that actually **shipped** is [`2026-06-07-casl-design.md`](2026-06-07-casl-design.md) (roadmap line: [`HANDBOOK.md`](../../../HANDBOOK.md) §6, F9).
>
> **As-built caveat:** the auth mechanism described below — Keycloak `sub` + a session GUC, no `auth.users`/`auth.uid()` — is **superseded**. Polaris runs on **Supabase Auth** (ADR-0001); F9 derives identity from the `app.user_id` GUC + `profiles.role`, not the Keycloak `sub`. The role *model* here is the keeper; the Keycloak wiring is not.

# Feature: Profiles, Roles, and Permissions

**Branch:** `feature/permissions`
**Merges into:** `clean-rewrite`

> **Split 2026-06-07 into two use-case-anchored branch docs:**
> `2026-06-07-permissions-casl-design.md` (CASL — the admin sign-in-log viewer) and
> `2026-06-07-rls-hardening-design.md` (RLS — DB-enforced admin-only `sign_in_log`).
> Those are the docs to execute from. This doc is retained as the **reference** for
> the fuller model (all six roles, last-owner protection, role-change action, Pino)
> that lands as those areas are built.
>
> **Revised 2026-06-07 for Keycloak.** This doc originally assumed Supabase Auth
> (`auth.users`, `auth.uid()`, profile creation in `signInAction`). Authentication
> is now Keycloak (see `2026-06-06-keycloak-auth-design.md`). The identity is the
> Keycloak `sub` claim, the app connects to Postgres via Drizzle, and there is no
> `auth.users` table or `auth.uid()`. Sections 2, 3, and 7 have been rewritten;
> RLS is reworked to derive the current user from a session GUC populated with the
> Keycloak `sub` instead of `auth.uid()`.

## Overview

Establish who can do what in Polaris. Add a roles table, profiles table linking users to roles, CASL permission rules in code, RLS on database tables (Keycloak-`sub`-driven, as defense-in-depth under CASL), and Pino for logging rejected operations. First user bootstraps as owner with last-owner protection.

## Packages

**Dependencies:**
- `@casl/ability` — permission rule engine
- `pino` — structured operational logging

**Dev dependencies:**
- `pino-pretty` — human-readable log output in development

## 1. Roles Table

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | Primary key, `gen_random_uuid()` |
| `name` | text | Not null, unique |
| `description` | text | Nullable |

Seeded with initial roles:

| name | description |
|---|---|
| `owner` | Full access, manages company and all users |
| `admin` | Manages fleet, orders, and users — cannot remove owners |
| `dispatcher` | Assigns drivers to deliveries, manages routes |
| `driver` | Views own assignments, updates delivery status |
| `warehouse` | Manages inventory, loading/unloading, temperature logs |
| `customer` | Views own orders and delivery status |

All six roles are seeded in the migration. Only `owner` and `admin` get CASL rules on this branch — the rest get rules when their domain features land.

## 2. Profiles Table

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | Primary key — the Keycloak user id (`sub` claim) |
| `roleId` | uuid | Not null, references `roles(id)` |
| `displayName` | text | Not null |
| `createdAt` | bigint | Not null, Unix epoch seconds |

Every Keycloak user gets a profile. The `id` **equals the Keycloak `sub`** (a UUID), not auto-generated. There is **no foreign key** to an `auth.users` table — that table existed only under Supabase. The identity is owned by Keycloak; `profiles.id` is the local mirror of the `sub`, and is what every other table references as the user key (same as `sign_in_log.userId`).

## 3. Profile Creation

A profile must exist for every Keycloak user, created on first sign-in with the default role (`member`).

Under Keycloak there is no `auth.users` table to trigger on, and `signInAction` is now just a redirect to Keycloak (it never sees a "successful login" moment). The hook is therefore **Auth.js's `events.signIn` callback** in `lib/auth.ts` — the same place `sign_in_log` is written (see Keycloak Commit 5).

**Chosen: Application-level in `events.signIn`.** On each successful sign-in, look up a profile by the Keycloak `sub`. If none exists, create one (`id = sub`) with the `member` role (or `owner` for the first user — see §4). All logic stays in TypeScript, testable with Vitest by invoking the callback with a stub token.

## 4. First User Bootstrap

The first user to sign in when no profiles exist is automatically assigned the `owner` role instead of `member`. This avoids needing manual SQL to promote the initial user.

Logic: if the `profiles` table has zero rows, the new profile gets `owner`. Otherwise, `member`.

## 5. Last-Owner Protection

The system must always have at least one owner. Before any role change that would remove an owner:

1. Count current owners: `SELECT COUNT(*) FROM profiles WHERE role_id = (SELECT id FROM roles WHERE name = 'owner')`
2. If count is 1 and the target user is that owner, reject the operation

This check lives in the `changeRoleAction` server action, not in RLS — it's business logic, not a database constraint.

## 6. CASL Rules (`lib/permissions/rules.ts`)

Permissions defined in code, keyed by role name:

**owner:**
- Can manage all resources (full access)
- Can change any user's role
- Cannot be demoted if they are the last owner (enforced in action, not CASL)

**admin:**
- Can read and update all profiles
- Can change roles for non-owner users
- Cannot promote to owner
- Cannot demote an owner

**All other roles (dispatcher, driver, warehouse, customer):**
- Can read their own profile
- No other permissions until their domain features are built

### `defineAbilityFor(role: string)`

Returns a CASL `Ability` instance with the rules for that role. Called in server actions and (later) in client components.

### `withPermission(action, subject, serverAction)`

A wrapper for server actions that checks CASL before executing. If the user lacks permission, returns an error. If RLS also rejects, Pino logs the rejection.

## 7. RLS Policies (Keycloak-driven)

RLS here is **defense-in-depth under CASL**, not the primary authorization layer. CASL (§6) is what gates server actions; RLS is a database backstop so a missing `WHERE` clause or future direct-DB access path cannot leak rows. It is **optional hardening** — the app is correct without it, but RLS guarantees the database itself enforces row ownership.

### Why this needs new plumbing under Keycloak

Supabase RLS read the user from `auth.uid()`, a function backed by the Supabase JWT on the connection. With Keycloak there is no `auth.uid()` and no JWT on the Postgres connection — the app connects via Drizzle. Two problems must be solved:

1. **The owner/superuser connection bypasses RLS.** Table owners and superusers skip all policies. So RLS is meaningless until queries run as a *non-owner* role.
2. **The current user must reach the database session.** We propagate the Keycloak `sub` into a session GUC and write policies against it.

### 7a. Restricted database role

Introduce a dedicated role that is **subject to** RLS (no `BYPASSRLS`, not the table owner):

```sql
CREATE ROLE app_user NOLOGIN;
GRANT app_user TO <connection_role>;            -- the role Drizzle connects as
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

- **`DATABASE_URL`** (app runtime) connects as a role that has `app_user`'s privileges and is **not** a table owner / superuser → RLS applies.
- **`MIGRATION_DATABASE_URL`** (drizzle-kit, seeds, admin tasks) connects as the owner → bypasses RLS, as migrations must.

### 7b. Propagating the Keycloak `sub`

User-scoped queries run inside a transaction that first sets the identity from the Auth.js session. A helper in `lib/db/with-user-context.ts`:

```ts
export async function withUserContext<T>(
  ctx: { userId: string; role: string },
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${ctx.userId}, true)`)
    await tx.execute(sql`SELECT set_config('app.user_role', ${ctx.role}, true)`)
    return fn(tx)
  })
}
```

- `set_config(..., true)` = `SET LOCAL` — scoped to the transaction, auto-cleared at commit. No leakage across pooled connections.
- `ctx` is derived from the Auth.js session (`auth()`): `userId = session.user.id` (the Keycloak `sub`), `role` from the user's profile.
- **All RLS-protected reads/writes must go through `withUserContext`** — a query outside it has no `app.user_id` set and its policies fail closed.

### 7c. Policies (against the GUC, not `auth.uid()`)

Read the GUC with `missing_ok = true` so non-user contexts (migrations on the owner role) don't error:

```sql
-- helper expressions
--   current user id:   current_setting('app.user_id', true)::uuid
--   current user role: current_setting('app.user_role', true)
```

**profiles** — RLS enabled, `FORCE` so the owner is also subject when testing:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- read own profile, or any profile if owner/admin
CREATE POLICY profiles_select ON profiles FOR SELECT TO app_user
USING (
  id = current_setting('app.user_id', true)::uuid
  OR current_setting('app.user_role', true) IN ('owner', 'admin')
);

-- update only own display name (role_id changes go through changeRoleAction)
CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO app_user
USING (id = current_setting('app.user_id', true)::uuid)
WITH CHECK (id = current_setting('app.user_id', true)::uuid);
```

Role changes are **not** done via direct UPDATE — they go through `changeRoleAction`, which runs under `withUserContext` for an owner/admin and is additionally gated by CASL + last-owner protection. No INSERT/DELETE policy: profile creation happens in `events.signIn` under the migration/owner connection (bypasses RLS).

**roles**
```sql
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON roles FOR SELECT TO app_user USING (true);
```
- SELECT for all (roles aren't secret). No INSERT/UPDATE/DELETE — seeded in migrations only (owner connection).

**sign_in_log**
- No RLS. Written from `events.signIn` on the owner connection; not read in user-scoped paths. (Admin read access gets a role-gated policy when an admin audit view is built.)

### 7d. Trade-offs / notes

- Adds a second connection role and forces user-scoped DB access through `withUserContext`. That's the cost of a real DB-level backstop; without it RLS is decorative (as it was before).
- If RLS is judged not worth the plumbing for now, it can be deferred entirely and CASL alone enforces authorization (see Keycloak design doc, "Not in scope"). This section is the blueprint for when it *is* turned on.

## 8. Pino Logger (`lib/logger.ts`)

Structured JSON logger for operational events. Use cases on this branch:

- `withPermission()` guard rejects an operation — log the user, role, attempted action, and subject
- RLS rejects a database operation — log the error in the catch block
- Profile creation fails — log the error

Not used for business events (those go in database tables like `sign_in_log`).

Configuration:
- `LOG_LEVEL` env var (defaults to `info`)
- `pino-pretty` in development via `pino-pretty` transport when `NODE_ENV !== 'production'`

## 9. Server Actions

### `changeRoleAction(targetUserId, newRoleName)`
- Resolve the current user from the Auth.js session (`auth()`) → `sub` + role
- Check CASL: does the current user have permission to change roles?
- Check last-owner protection: if demoting an owner, ensure at least one other owner exists
- Update the profile's `roleId` **inside `withUserContext`** (so RLS applies)
- Log the role change to Pino

### Profile creation in `events.signIn` (`lib/auth.ts`)
- Replaces the old `signInAction` hook (which is now just a Keycloak redirect).
- On successful sign-in, the callback receives the Keycloak token; read `sub`.
- Look up a profile by `id = sub`. If none exists, create one (owner if first user, member otherwise). Runs on the migration/owner connection (bypasses RLS for the insert).
- Same callback also writes `sign_in_log` (Keycloak design doc, Commit 5).

## 10. Testing

**Unit tests (Vitest):**
- CASL rules: owner can manage all, admin can manage non-owners, member can only read own profile
- `withPermission()` guard: blocks unauthorized actions, allows authorized ones
- Last-owner protection: blocks demoting the only owner, allows demoting one of multiple owners
- Profile creation on sign-in: first user gets owner, subsequent users get member

**Integration tests (Testcontainers):**
- Migration creates `roles` and `profiles` tables with expected columns
- Roles table is seeded with all six roles
- RLS works under the `app_user` role: connect as `app_user`, `SET LOCAL app.user_id` to one profile's id, and assert it can SELECT its own row but **not** another user's row; with `app.user_role = 'admin'`, it can read all. (The owner connection bypasses RLS — verify that too, so migrations/seeds still work.)

## 11. CI Updates

No changes needed — integration tests already run in CI. The existing Testcontainers step will pick up the new migration tests.

## File Map

```
lib/db/schema.ts                               (edit) Add roles and profiles tables (id = Keycloak sub)
lib/db/with-user-context.ts                     (new)  Transaction wrapper that SET LOCALs app.user_id / app.user_role
lib/permissions/rules.ts                        (new)  CASL ability definitions per role
lib/permissions/guard.ts                        (new)  withPermission() server action wrapper
lib/logger.ts                                   (new)  Pino logger instance
lib/auth.ts                                     (edit) events.signIn: create profile (first user = owner) + sign_in_log
drizzle/0001_*.sql                              (new)  Migration: roles + profiles + RLS (app_user role, GUC policies) + seed
lib/db/__tests__/migrations.integration.test.ts (edit) Assert tables, seed, and RLS (app_user sees own row, not others)
package.json                                    (edit) Add @casl/ability, pino, pino-pretty
.env.local / .env.test / .env.test.example      (edit) Add MIGRATION_DATABASE_URL (owner); DATABASE_URL connects as app_user
```

**Connection roles:** `DATABASE_URL` → restricted role with `app_user` privileges (RLS applies). `MIGRATION_DATABASE_URL` → owner (migrations, seeds, `events.signIn` profile insert; bypasses RLS).

## Not in Scope

- **Domain resources** (vehicles, orders) — permissions for those come with their feature branches
- **Permission management UI** — role changes happen via server actions; UI comes with the settings feature
- **Dispatcher/driver/warehouse/customer CASL rules** — rules added when their domain features land
- **Database trigger for profile creation** — handled in application code instead
- **Role CRUD through the app** — roles are seeded in migrations, not managed through UI
