# Non-superuser runtime role (align tests with prod)

**Branch:** `feature/nonsuperuser-runtime-role` (off `clean-rewrite`)
**Status:** planned — supersedes the level-2 harness (`test/rls-nonsuperuser-harness`, PR #138)

## Problem

Even after the harness, the app's **runtime** connection is a **superuser** in dev (Supabase `postgres`), E2E, and CI (`DATABASE_URL=postgres@…`). A superuser bypasses RLS and can `SET ROLE` freely, so:

- **E2E never exercises real RLS enforcement** — the membership/privilege requirements are masked.
- The harness made *integration* tests non-superuser, but with a **test-invented role (`app_conn`)** — still not the role prod uses. Tests and prod don't actually align.
- `withUserContext` relies on `SET LOCAL ROLE app_user`, which needs membership grants — the fragile bit that crashed Supabase via `GRANT … TO CURRENT_USER` and varies per environment.

**Goal:** the app connects as **one non-superuser role, `app_user`, in every environment** (dev, test, E2E, CI, prod). Migrations run as a privileged role. No `SET ROLE`. Tests and prod run the identical code path and role — masking becomes impossible by construction.

## Design

### Two roles, two connections
- **Privileged owner** (migrations): creates tables, policies, roles, grants. Dev = Supabase `postgres`; test/CI = container superuser; prod = a privileged owner.
- **`app_user`** = the application **LOGIN** role (non-superuser, the existing RLS policy target). The app connects **as** `app_user`, so `current_user = app_user` and the `TO app_user` policy applies **natively** — no `SET ROLE`.

Two env vars:
- `DATABASE_URL` → **`app_user`** (the app / `lib/db/client`).
- `MIGRATE_DATABASE_URL` (admin) → drizzle-kit migrate + `drizzle.config`.

### `withUserContext` simplifies
Drop `SET LOCAL ROLE app_user` (the connection already *is* `app_user`); keep only:
```sql
SET LOCAL app.user_id = …; SET LOCAL app.user_roles = …;
```
RLS applies because `current_user = app_user`. This removes membership grants, the Supabase `CURRENT_USER` crash, and all `SET ROLE` permission concerns at once.

### `app_user` login + password = env setup (not a migration)
The role + policy + table grants stay in migrations. Making `app_user` a LOGIN role with a password is per-environment setup (`ALTER ROLE app_user LOGIN PASSWORD …`) — secrets don't belong in migrations.

### Per environment
- **Integration tests:** rework `startRlsTestDb` — `ALTER ROLE app_user LOGIN PASSWORD` after migrate; the app connects as `app_user`; `admin` pool migrates/seeds. (The `app_conn` test-only role is gone — tests use the real `app_user`.)
- **E2E ephemeral DB (`global-setup`):** after migrate, `ALTER ROLE app_user LOGIN PASSWORD`; `.env.test` `DATABASE_URL = app_user@…`; migrate via the admin URL.
- **CI:** same shape against the Postgres service.
- **Dev (Supabase):** `ALTER ROLE app_user LOGIN PASSWORD`; `.env.local` `DATABASE_URL = app_user@…`; `MIGRATE_DATABASE_URL = postgres@…`.
- **Prod:** documented — create `app_user` (LOGIN, non-superuser, member-free), grant it the table privileges (migration already does), set `DATABASE_URL`; migrate with the owner.

## How this "undoes" the harness
It reworks, not reverts: `app_conn` (test-only) → `app_user` (real role, = prod); `withUserContext` loses `SET ROLE`; `startRlsTestDb` stays but provisions `app_user` as login. Net: the level-2 partial is replaced by the real alignment.

## Commits (TDD)
| # | Commit | Test |
|---|--------|------|
| 1 | `withUserContext`: drop `SET LOCAL ROLE` (GUCs only); rework `startRlsTestDb` to connect as `app_user` (login); update `with-user-context` + `actions` tests | integration (still: user sees own; owner all — now as the real role) |
| 2 | E2E/dev/CI: `global-setup` + `.env.test` + `ci.yml` + `drizzle.config` split (`DATABASE_URL`=app_user, `MIGRATE_DATABASE_URL`=admin); dev setup documented | E2E (app runs as `app_user`; RLS real end-to-end) |
| 3 | Remove now-dead `SET ROLE`/membership remnants; update CASL doc + `supabase-dev-db-quirks` memory | — |

**Fidelity check:** with `app_user` as the app connection, an RLS bug (or a missing GUC) surfaces in *both* integration and E2E — no superuser anywhere to mask it.

## Eliminates
`SET ROLE`, membership grants (`GRANT app_user TO …`), the `GRANT … TO CURRENT_USER` Supabase crash, and superuser masking in **every** environment.

## Caveats / not in scope
- `app_user` needs a password per environment (a managed secret).
- Two connection URLs (app vs migrate) — a small operational addition.
- Prod is **documented**, not implemented (no prod yet).
