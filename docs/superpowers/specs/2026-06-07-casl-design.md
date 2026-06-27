# Feature: CASL authorization + Pino logging (owner sign-in-log viewer)

**Branch:** `feature/casl`
**Merges into:** `clean-rewrite`
**Depends on:** Keycloak auth (merged) — identity + the `sign_in_log` table already exist.

> **Scope discipline.** This is the *minimal* introduction of app-layer authorization, anchored to a single real feature. It deliberately does **not** add RLS, orgs, customers, or multiple roles. Deferred items are listed in "Not in scope" (with triggers) and indexed in `00-permissions-roadmap.md`.

## Overview

Introduce **CASL** (app-layer "what can this role do") and **Pino** (operational logging), proving both against one concrete feature: an **owner-only in-app view of the sign-in log**. One role (`owner`), one resource (`SignInLog`), one guarded action, one log point. RLS is **not** included — a role-based RLS policy here would just duplicate CASL (see "Why no RLS yet").

## Core Use Case (the vertical slice)

> **An `owner` opens `/admin/activity` and sees the sign-in log. A non-owner can't reach the page and `getSignInLog()` refuses.**

**Acceptance demo:** log in as the owner test user → `/admin/activity` shows the sign-in rows. Log in as the non-owner test user → redirected/forbidden, and the action returns an authorization error (logged via Pino).

*(`owner` = the highest, platform-level role — the people running the business. `/admin/activity` is just the management-area route; the role gating it is `owner`.)*

## Why no RLS yet

RLS earns its place on **row-ownership** scoping (`org_id`/`user_id` on rows → per-row filtering). `sign_in_log` is a global table gated by *role* only — a role-based RLS policy (`owner can SELECT`) would re-check the same boolean CASL already enforces, adding redundancy, not protection. **Trigger to add RLS:** the first table with an owner column (the future `information.org_id`) — add the policy *in that same commit*.

## Packages
- `@casl/ability` — permission rule engine
- `pino`, `pino-pretty` (dev) — structured operational logging

## Roles
A single **Keycloak realm role `owner`**, delivered in the token (no app roles/profiles tables). Multiple users may hold `owner` (it's a role, not a singleton). Everyone else is unprivileged for this feature.

## Implementation (TDD, one feature per commit, always-green)

Each commit: failing test first (🔴), minimal code to pass (🟢). **State after** is the invariant each commit preserves (the app keeps working).

### Commit 1 — Keycloak `owner` role surfaced in the session · *red→green (unit) + realm config* · ✅ DONE (`6f18e5b`)

- Realm (`keycloak/realm-export.json`): added realm role `owner` + a roles protocol mapper; owner test user **`owner@example.com`** holds it; non-owner **`member@example.com`** for the deny path. Recreated Keycloak; verified via admin API the role/mapper/users imported (token-carries-roles proven later by Commit 5 E2E — direct grants are off).
- 🔴 `lib/auth.test.ts`: the `jwt`/`session` callbacks map the `roles` claim → `session.roles`.
- 🟢 added the callbacks in `lib/auth.config.ts` (`token.roles` from `profile.roles`; `session.roles`).
- **State after:** app works; `auth()` exposes `session.roles`. Test users: `owner@example.com` (owner) / `member@example.com` (non-owner), both `test-password-123`; `TEST_USER_EMAIL=owner@example.com`.

### Commit 2 — CASL abilities · *red→green (unit)* · ✅ DONE (`784f4bf`)

- 🔴 `lib/permissions/ability.test.ts`: `defineAbilityFor(['owner'])` → `can('read','SignInLog')`; `defineAbilityFor([])` → cannot.
- 🟢 `lib/permissions/ability.ts`: install `@casl/ability`; `defineAbilityFor(roles)`.
- **State after:** ability derivable from roles; nothing gated yet.

### Commit 3 — Concrete `member` role (the denied non-owner) · *realm setup + regression test* · ✅ DONE (`ea9b540`)

Makes the deny path a **real, named role** instead of "absence of owner," so the login demo (Commit 6) shows *owner role → can* vs *member role → can't* — two concrete logins.

- Realm (`keycloak/realm-export.json`): add realm role `member`; assign it to `member@example.com`. Recreate Keycloak; verify `member@example.com` holds `member`.
- ✅ `lib/permissions/ability.test.ts` (extend): `defineAbilityFor(['member'])` → **cannot** `read SignInLog`. Passes against the owner-only rule — a **regression guard** that fails if `member` ever accidentally gains access. (Not red→green: it asserts the concrete deny stays denied.)
- **State after:** `member` is a first-class role on `member@example.com`; CASL concretely denies it reading the log.

### Commit 4 — Pino logger + fix the silent sign-in-log write · *red→green (unit)* · ✅ DONE (`d1bcabf`)

- 🔴 `lib/auth-events.test.ts` (extend): when the `sign_in_log` insert throws, `recordSignIn` **logs a warning** (and still doesn't throw — best-effort preserved).
- 🟢 `lib/logger.ts` (Pino; `pino-pretty` when `NODE_ENV !== 'production'`); replace the empty `catch` in `recordSignIn` with `logger.warn({ sub, err }, 'failed to write sign_in_log')`.
- **State after:** the previously-silent best-effort write failure is now visible in logs.

### Commit 5 — `withPermission` guard (CASL + Pino) · *red→green (unit)* · ✅ DONE (`a141344`)

- 🔴 `lib/permissions/guard.test.ts`: `withPermission(action, subject, fn)` runs `fn` when the session's roles allow it; when denied, returns/throws an authorization error **and** logs a denial via Pino (mock `@/lib/auth` + logger).
- 🟢 `lib/permissions/guard.ts`: resolve `auth()` → `session.roles` → `defineAbilityFor` → check; on deny, `logger.warn({ sub, roles, action, subject }, 'authorization denied')`.
- **State after:** reusable guard; nothing user-facing gated yet.

### Commit 6 — Owner-vs-member sign-in-log viewer · *red→green (E2E)* · ✅ DONE (`c63a6cb`)

The visible demo of role-based access: **two concrete logins, opposite outcomes.** Route is **`/activity`**.

- 🔴 `e2e/activity.spec.ts`: **`owner@example.com`** sees the sign-in-log table at `/activity`; **`member@example.com`** is redirected/forbidden.
- 🟢 `getSignInLog()` server action wrapped in `withPermission('read','SignInLog', …)`; `app/(dashboard)/activity/page.tsx`. **No `proxy.ts` change** — `/activity` is already session-protected by the existing proxy (non-public routes require login); the **owner** check is enforced in the page (`auth()` + ability, redirect non-owners).
- **State after:** **core use case delivered** — `owner` can view the log, `member` cannot.

### Commit 7 — Owner-only Activity link on the dashboard · *red→green (E2E)* · ✅ DONE (`5802f45`)

Off-plan UX addition: a way to *reach* `/activity` without typing the URL.

- 🔴 `e2e/activity.spec.ts`: owner sees an **Activity** link on `/dashboard` that opens `/activity`; member doesn't see it.
- 🟢 `app/(dashboard)/dashboard/page.tsx` renders the link only when `defineAbilityFor(roles).can('read','SignInLog')` (owner).
- **State after:** owners get a visible entry point; the link is hidden from non-owners (UI mirrors the CASL rule).

### Commit 8 — Isolated ephemeral E2E database + non-destructive log test · ✅ DONE (`eadb67d`)

Fixes a test-isolation smell: E2E previously shared the **dev** DB and one spec did `DELETE FROM sign_in_log`, so running tests wiped the dev log.

- **Ephemeral E2E DB:** `e2e/global-setup.ts` spins a fresh `postgres:17` on the `DATABASE_URL` port (local) and migrates it; `e2e/global-teardown.ts` removes it. In **CI** the provided postgres service is used (container mgmt skipped). The E2E DB is always built from the same migrations as prod → no schema drift.
- **`.env.test` → port 54399** (isolated), not the dev DB (54322). `reuseExistingServer: false` so Playwright always launches an app instance bound to the E2E DB (never a stray dev server).
- **Non-destructive `sign-in-log.spec`:** removed the `DELETE`; now asserts an invariant over the owner's own rows (one distinct, non-null `user_id`) — proves the stable-`sub` bug class without touching the table.
- **Verified:** 13 E2E green; dev DB row count unchanged before/after; ephemeral container created + torn down.
- **Workflow note:** stop any manual `npm run dev` (on :3000) before running E2E, since Playwright now starts its own instance.

## File Map
```
keycloak/realm-export.json            (edit) owner + member roles, owner + member users, roles mapper
lib/auth.config.ts                    (edit) jwt/session callbacks → session.roles
lib/auth.test.ts                      (edit) roles-claim test
lib/permissions/ability.ts            (new)  defineAbilityFor(roles)
lib/permissions/ability.test.ts       (new)
lib/permissions/guard.ts              (new)  withPermission()
lib/permissions/guard.test.ts         (new)
lib/logger.ts                         (new)  Pino
lib/auth-events.ts                    (edit) log write-failure (was silent catch)
lib/auth-events.test.ts               (edit) assert write-failure logs
app/_features/activity/getSignInLog.ts (new)  guarded server action
app/(dashboard)/activity/page.tsx     (new)  viewer page (/activity), owner-gated
e2e/activity.spec.ts                  (new)  owner sees / member blocked
.env.test / realm                     (edit) owner + non-owner test users
package.json                          (edit) +@casl/ability, +pino, +pino-pretty
```

## Testing
- **Unit:** CASL rules — `owner` allowed, `[]`/non-owner denied, and **`member` concretely denied** (regression guard); `withPermission` allow/deny + denial logging; `recordSignIn` write-failure logging; roles-claim mapping.
- **E2E:** **`owner@example.com` sees `/activity`; `member@example.com` blocked** (two concrete role logins, opposite outcomes) + the owner-only dashboard link.
- **Isolation:** E2E runs against an **ephemeral, migrated Postgres** (own port), separate from the dev DB; the sign-in-log spec is non-destructive. Unit tests are fully mocked; integration tests use Testcontainers. (No RLS/DB policy in this branch.)

## Not in scope (deferred, with triggers)

Also indexed in `00-permissions-roadmap.md`.

- **RLS** → **now in scope** — Part 2 below (user-scoped posts, commits 9–15): first owner-column table (`posts.author_id`), declared via Drizzle `pgPolicy`/`pgRole`.
- **`sign_in_log` → Keycloak-events viewer swap** → a **later branch** (after posts), so removing `sign_in_log` orphans nothing. Until then `/activity` reads `sign_in_log`; Keycloak's console already logs failures for free.
- **In-app owner management** (grant/revoke `owner`) **+ last-owner protection** → one later feature. Last-owner protection is a *guard inside* the revoke action, so it cannot exist before owner management does. Until then, `owner` is assigned manually in the Keycloak console (operational care: don't strip the last owner).
- **Orgs / customers / `org_admin` / `org_member` / served-to link** → the info-serving feature.
- **Extra roles (`editor`, etc.) / role hierarchies** → as the role matrix grows (CASL already structured for it).
- **Keycloak Authorization Services / dynamic permissions** → when permissions must be runtime-configurable by non-developers.
- **Permanent denial-audit table** → denials stay ephemeral (Pino) until a compliance need makes them permanent.

---

## Part 2 — user-scoped orders (the RLS debut) · branch `feature/orders`

Built on `feature/orders` (cut from the updated `clean-rewrite` after Part 1 merged). The first feature with an **owner column** (`orders.created_by`) → brings RLS in for real. Scoping is the **rich case**: a user sees **their own** orders, and the **`owner` role sees all** — i.e. *ownership **OR** role*, which is RLS's genuine, non-redundant use (not the trivial own-only case).

> Reuses the archived "base order" shape, **minus order numbers** — UUIDs only for now (`order_number` bigint sequence starting 1,000,000 comes later; see `docs/archive/order-numbers.md`). **Order line items** (project #2) and the **order state machine** (archived plan) are deferred.
>
> **Ordering note:** orders ship **before** the `sign_in_log` → Keycloak-events swap, so the DB always has a consumer (orders) and the swap never orphans the DB layer (no dead code).

### Core use case
> **A signed-in user creates orders and sees only their own at `/orders`. The `owner` sees *all* orders. A non-owner cannot see another user's orders — enforced at the DB by RLS.**

### Model (minimal — UUIDs only)
`orders`: `id` (uuid pk), `created_by` (uuid = Keycloak `sub`), `created_at` (**timestamptz**, DB default `now()`). **No `order_number` yet.** (Other order fields, line items, and status/state arrive with later order features.)

### What each layer does (all genuinely used)
- **DB:** `orders` (`created_by` = the Keycloak `sub`).
- **Identity:** `sub` **and** `roles` surfaced into the session and into the DB-session GUCs.
- **CASL:** `can('create','Order')`; `can('read','Order',{ createdBy: me })`; **`owner` → `can('read','Order')` (all)**.
- **RLS (the rich case):** `created_by = current_setting('app.user_id')::uuid OR 'owner' = ANY(string_to_array(current_setting('app.user_roles', true), ','))`. `withUserContext` sets **both** GUCs from the session.

### RLS is declared in Drizzle (`pgPolicy`/`pgRole`), generated — not hand-written
Policies + the restricted role live in the schema; `drizzle-kit generate` emits the migration SQL. Set `drizzle.config` `entities: { roles: true }`. **Caveat:** table `GRANT`s to `app_user` are appended to the generated migration (Drizzle doesn't fully manage grants).

### Connection role — the app connects AS `app_user`
**Resolved in `feature/nonsuperuser-runtime-role`.** The app connects as the non-superuser `app_user` role itself in every environment (`DATABASE_URL`), so `current_user = app_user` and the policy applies natively — `withUserContext` no longer does `SET ROLE`. Migrations use a separate privileged connection (`MIGRATE_DATABASE_URL`). Per-env, `app_user` is made a LOGIN role (`ALTER ROLE app_user WITH LOGIN PASSWORD …`) — env setup, not a migration. This removed the `SET ROLE` membership grants and the `GRANT … TO CURRENT_USER` Supabase crash entirely. Tests connect as `app_user` too (`startRlsTestDb`), so tests and prod align — no superuser anywhere in the app path.

### Commits (TDD, one feature each)
| # | Commit | Test |
|---|--------|------|
| 9 | Surface the user `sub` in the session (`session.userId`); confirm `roles` available · ✅ DONE (`2ce7ca8`) | unit |
| 10 | `orders` table (Drizzle `pgTable`: `id`, `created_by`, `created_at`) + generated migration · ✅ DONE (`8db17c3`) | integration (Testcontainers: columns) |
| 11 | `pgRole('app_user')` + `orders` RLS via `pgPolicy` (`created_by = app.user_id` **OR** `owner` in `app.user_roles`) + `enableRLS()`; generated migration (+ grant) · ✅ DONE (`e7e9014`) | integration (user sees only own; another user's hidden; **owner sees all**; owner/migration conn bypasses) |
| 12 | `withUserContext` (SET LOCAL ROLE `app_user` + `app.user_id` = `sub`, `app.user_roles` = roles) · ✅ DONE (`207a5f9`) | integration |
| 13 | CASL `Order` rules (`create`; `read` own; `owner` reads all) · ✅ DONE (`396dcf6`) | unit |
| 14 | `createOrder` / `getOrders` server actions (`withPermission` + `withUserContext`) · ✅ DONE (`a0490dd`) | integration |
| 15 | `/orders` page (create + list) · ✅ DONE (`e3d59ca`) | E2E (user A sees own; user B can't see A's; **owner sees both**) |
| 16 | Orders link on the dashboard for **all** signed-in users (Activity stays owner-only) · ✅ DONE (`284242b`) | E2E (non-owner sees Orders link → `/orders`) |
| 17 | `created_at` → **timestamptz** + DB default `now()` (both tables) · ✅ DONE (`3720808`) | integration (column type) |

### Still NOT in scope
- **`order_number`** (bigint sequence starting 1,000,000) — later; see `docs/archive/order-numbers.md`.
- **Order line items** (project #2), **order state machine** (archived plan), other order fields/status.
- **Customer/org scoping** — swap `app.user_id` for `app.org_id` (Keycloak groups) when orders become customer-specific; reuses this exact plumbing.
- Edit/delete UI, pagination.

---

## Part 3 — orders domain + UI (future · separate branches)

Builds on the Part 2 scoping foundation. The bare order (`id`, `created_by`, `created_at`) is enriched into a real domain entity, then gets the rich UI. **Two branches** (mirrors `CLEAN_REWRITE_PLAN.md` Features 3 & 4). **Outline only — not yet scoped to TDD commits** (those come when each branch starts, after the domain decisions are made).

### 3a — Order domain · branch `feature/orders-domain`
Flesh out the order beyond the bare base:
- **`order_number`** (bigint sequence starting 1,000,000, DB-generated) — `docs/archive/order-numbers.md`
- **status / state machine** (e.g. drafted → submitted → in-transit → delivered) — archived plan `docs/archive/superpowers/plans/2026-05-28-order-state-machine-refactor.md`
- **line items** — the **Order Line Items** project (#2)
- domain fields (customer/destination, dates, etc. — per the real spec)
- **Scoping carries over unchanged:** `created_by` stays; owner-sees-all stays; new fields just ride along under the existing CASL/RLS.
- *Reference:* archived `toOrder` / `parseOrderRow` domain helpers.

### 3b — Orders UI · branch `feature/orders-ui`
The visual layer designed earlier — replaces the bare Part 2 `/orders` scaffold:
- list view, **kanban board** (by status), order detail
- gated by the same CASL (create/manage own; owner sees all)
- **depends on 3a** (kanban needs status; detail needs fields)
- *Reference:* `CLEAN_REWRITE_PLAN.md` "Feature 4: Orders UI" + archived UI designs.

### Dependency order
Part 2 (scoping foundation) → **3a** (domain: fields / status / line items) → **3b** (UI). Don't build the rich UI before the domain — you'd rebuild it as fields/status land.

### Why it's not in Part 2
Part 2's job is the **RLS debut** on a real entity; a 3-field order is enough to prove scoping. Enriching the domain and building kanban/detail are separate concerns that need the order model settled first — hence their own branches.
