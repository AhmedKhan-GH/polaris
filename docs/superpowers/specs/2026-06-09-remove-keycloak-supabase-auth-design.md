# Feature: Remove Keycloak — restore Supabase Auth + Supabase Realtime

> **Status:** Proposed. **Branch:** `feature/remove-keycloak` (off `clean-rewrite`).
> **Date:** 2026-06-09. **Type:** architecture migration (auth + realtime layer swap).
> Supersedes the Keycloak/Centrifugo direction in `docs/HANDBOOK.md` §1, §3 (layers
> 1–4, 9), §5, §8 (F2/F7). Resurrects the pre-Keycloak pattern from branch `main`
> (`lib/supabase/*`, `drizzle/0004_realtime_orders.sql`, `drizzle/0021_fix_rls_for_realtime.sql`).

## 1. Goal

Remove Keycloak "as if it never existed" and return identity + realtime to **core
Supabase features**:

- **Identity → Supabase Auth (GoTrue)** via `@supabase/ssr` (was: Keycloak OIDC via Auth.js).
- **Realtime → Supabase Realtime** via Broadcast-from-Database (was: deferred Centrifugo migration / F7).
- **Authorization → unchanged** (CASL, re-pointed to a `profiles.role` source).
- **Data access → unchanged** (Drizzle as non-superuser `app_user` + `withUserContext` GUC bridge).

**Rationale (settled in brainstorming 2026-06-09):** Keycloak's justifying
capabilities — multi-app SSO, enterprise federation, UMA Authorization Services,
IdP-level multi-tenancy — are **none of them used or needed**. The most Polaris
will ever have is *users and organizations*, which is application-level
multi-tenancy that lives in our own Postgres + RLS (handbook F12), not in the IdP.
Keycloak bought one real thing — an option on a multi-app/federated future we do
not have — paid for with: the realtime incompatibility (the entire Centrifugo
lift), a two-step end-session logout, Keycloak-claims validation, two extra Docker
containers, and CI image-pull flakes. Supabase Auth provides everything we
actually use (login, brute-force, a role claim) **and** makes Supabase Realtime
work natively. Reverting is cheapest now, before F6/F8 order code hardens around
the Keycloak-shaped session and before the Centrifugo work is sunk.

**Non-goals:** building the F6 orders domain (order_number, status machine, line
items) or F8 UI. Realtime scope is the bare `orders` table only; richer order
tables plug in at F6. No change to Zod boundaries, rate limiting, headers/CSP,
logging, `app_user` least-privilege, or dependency monitoring.

## 2. The two load-bearing decisions (from brainstorming)

### 2.1 Destination A — restore the Supabase platform (not a local-auth alternative)

"Remove Keycloak" has two destinations: (A) restore Supabase Auth **and** Supabase
Realtime, or (B) keep "just Postgres" with auth in our own DB. **We chose A**
because Supabase Realtime *is* the realtime arm of Supabase Auth — its row/channel
authorization only works against Supabase-shaped JWTs. Getting Realtime back
**requires** Supabase Auth; choosing A deletes the F7/Centrifugo line item
outright. The only cost is re-introducing the Supabase services (local self-hosted
via the Supabase CLI for dev; hosted-vs-self-hosted is a deploy-time decision).

### 2.2 Per-user realtime via channel authorization, not row RLS (the `0021` scar)

`drizzle/0021_fix_rls_for_realtime.sql` (from `main`) records a hard-won fact:
**Supabase Realtime's Postgres-Changes row authorizer does not reliably populate
`auth.uid()` / `request.jwt.claims`**, so ownership RLS (`created_by = auth.uid()`)
on a streamed table silently filters out *all* events. Our clean-rewrite is *more*
exposed: its `orders` policy depends on `current_setting('app.user_id')`, a GUC set
only by our own `withUserContext` — a separate Realtime process will never set it,
so every row is guaranteed-dropped in the Realtime context.

Therefore per-user realtime is **not** enforced on the table row. It is
reconstructed at the **channel layer**, the one place Realtime's identity context
*is* reliable (subscription auth runs with the subscriber's JWT loaded):

1. **Routing** — an `AFTER INSERT/UPDATE` trigger on `orders` runs in our normal
   transaction (full context) and calls `realtime.broadcast_changes()` to a topic
   derived from ownership: `orders:<created_by>` (and `orders:all`).
2. **Gating** — an RLS policy on `realtime.messages` (where `auth.uid()` *does*
   resolve) locks each user to their own topic; the `owner` role additionally gets
   `orders:all`.

This yields the same guarantee as ownership RLS (per-user rows + owner firehose),
relocated to the layer Realtime can honor. It is **strictly better than `main`**,
which broadcast all orders to all authenticated staff (no per-user filtering).

### 2.3 Table RLS — two policies, two roles (app keeps ownership)

The app (Drizzle) connects as `app_user`; Realtime evaluates as `authenticated`.
Because they are different DB roles, the `orders` table carries **two policies**:

```sql
-- App path (app_user, sets app.user_id via withUserContext): FULL ownership RLS — unchanged
CREATE POLICY orders_app ON orders TO app_user
  USING (created_by = current_setting('app.user_id', true)::uuid OR <owner-role>)
  WITH CHECK (created_by = current_setting('app.user_id', true)::uuid);

-- Realtime path (authenticated, cannot read app.user_id): coarse, anon still blocked
CREATE POLICY orders_realtime ON orders TO authenticated USING (true);
```

The app's ownership RLS (defense-in-depth, principle 2) is **fully preserved**.
The coarse `authenticated` policy never leaks, because realtime *delivery* goes
through the broadcast topics (§2.2), not Postgres-Changes on the table. Migrations
keep `main`'s `IF EXISTS (schema 'auth')` guard so they stay portable to vanilla
Postgres/CI where `authenticated`/`realtime` do not exist.

## 3. Architecture after

```
Browser ──login(email/pw)──▶ Supabase Auth (GoTrue) ──cookie session──▶ App
App reads/writes ──Drizzle as app_user (+ withUserContext GUC)──▶ Postgres (ownership RLS)
Live kanban  ──supabase-js private topic 'orders:<uid>'──▶ Realtime ──gated by realtime.messages RLS
order change ──AFTER trigger realtime.broadcast_changes──▶ topic 'orders:<created_by>' + 'orders:all'
Roles ──profiles.role──▶ CASL (withPermission) + withUserContext roles
```

## 4. Change inventory

| Action | Items |
|---|---|
| **Delete (Keycloak)** | `lib/auth/*` (NextAuth+Keycloak config/events/index/route-guard/user), `app/api/auth/[...nextauth]/route.ts`, `lib/env/auth.ts` (`AUTH_KEYCLOAK_*`, `AUTH_SECRET`), `keycloak/realm-export.json`, `keycloak`+`keycloak-db` Docker services, two-step end-session logout, Keycloak-claims Zod, `next-auth` dependency |
| **Resurrect (from `main`, adapted to clean-rewrite hardening)** | `lib/supabase/{browser,server}.ts` (`@supabase/ssr`); app-hosted `/login` + register forms & actions; `profiles` table; Supabase Realtime client; `supabase/config.toml` + local Supabase via CLI; E2E `realtime-orders.spec.ts`, `login-failure.spec.ts` |
| **Re-point, keep** | `withUserContext` (source `app.user_id` from Supabase `user.id`); `sign_in_log`/`recordSignIn` (fire on successful `signInWithPassword`, drop NextAuth event); route guard (Supabase session check); CASL `withPermission` (role from `profiles`) |
| **Untouched** | Zod boundaries, t3-env (non-auth half), rate-limiter-flexible, headers/CSP, Pino, `sign_in_log` schema + owner-RLS, dependency monitoring, chunk-reload, `app_user` least-privilege, Drizzle/migrations, `orders` app-path ownership policy |
| **New** | `realtime.messages` channel-auth policy; `orders` broadcast trigger; `orders_realtime` coarse policy; Supabase env (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) |

## 5. Components & boundaries

- **`lib/supabase/server.ts`** — `getServerSupabase()` (cookie-bound, anon key) +
  `getServiceRoleSupabase()` (admin, service-role key). Used by auth actions and
  the session/role resolver. Node-only.
- **`lib/supabase/browser.ts`** — singleton `getSupabaseClient()` for Realtime
  subscriptions in client components.
- **`profiles` table** — `id uuid PK` (= `auth.users.id`), `email text`, `role text
  not null default 'member'`. Single source of app role; feeds CASL + the
  `withUserContext` roles arg. Home for `org_id` at F12.
- **Session/role resolver** — server helper: `getServerSupabase().auth.getUser()`
  → `profiles` lookup → `{ userId, roles }`. Replaces `auth()` from NextAuth in
  `withPermission` and the route guard.
- **`withUserContext`** — unchanged mechanism; `userId` now the Supabase user id.
- **Realtime authz** — `realtime.messages` policy (channel gate) + `orders`
  broadcast trigger (routing). No app code owns row-level realtime filtering.

## 6. Error handling

- Login failure → typed `LoginState.error` returned to the form (no throw), Pino
  `warn` (port `main`'s `actions.ts`).
- Missing/invalid session at a guarded boundary → fail-closed: `withPermission`
  throws `Not authenticated` (unchanged contract); route guard redirects to `/`.
- `recordSignIn` stays best-effort — a DB outage must never block login (failures
  swallowed + Pino `warn`), same contract as today.
- `withUserContext` keeps its `.parse` fail-closed on a malformed `userId`.
- Migrations degrade on vanilla Postgres via the `IF EXISTS (schema 'auth')` guard.

## 7. Testing strategy (TDD — failing test first for every unit)

- **Unit:** Supabase client construction (env wiring); session/role resolver
  (mocked `getUser` + `profiles`); `withPermission` role-from-profiles; sign-out
  (no end-session URL); `withUserContext` userId sourcing.
- **Integration (under `app_user`, RLS harness in `lib/db/__tests__/`):** `orders`
  app-path ownership still holds (member can't read другой member's rows);
  `profiles` RLS; `sign_in_log` owner-RLS unchanged; the two-policy `orders` setup.
- **Realtime integration:** a member subscription to `orders:<other-uid>` is denied
  by the `realtime.messages` policy; an order insert broadcasts only to the owner
  topic; owner receives `orders:all`.
- **E2E (Playwright):** port `login-failure.spec.ts`, `realtime-orders.spec.ts`;
  update `login.spec.ts`/`logout.spec.ts` for app-hosted login + plain Supabase
  sign-out; keep `security-headers.spec.ts`, `sign-in-log.spec.ts`.
- **CI:** fresh-clone + local Supabase (`supabase start`) replaces the Keycloak
  service; non-superuser RLS harness preserved.

## 8. Risks

1. **Roles: JWT claim vs. lookup.** Default to a server-side `profiles` lookup
   (simple, TDD-able). A Supabase custom-access-token hook embedding `role` in the
   JWT is a later optimization — not in scope.
2. **`authenticated`/`anon`/`realtime` exist only under Supabase.** Keep the
   `IF EXISTS (schema 'auth')` migration guard for portability to CI/vanilla PG.
3. **`/login` returns.** Keycloak's hosted login is gone; we own the page again
   (deliberate reversal, already designed on `main` — `refactor/remove-login-page`
   is undone).
4. **Realtime scope.** Only the bare `orders` table now; `order_status_history` /
   counts (present on `main`, not yet on clean-rewrite) are F6 — the broadcast
   trigger pattern extends to them then.
5. **Local Supabase footprint.** The Supabase CLI stack is heavier than two
   Keycloak containers; mitigated because it replaces *both* Keycloak containers
   and the future Centrifugo service, and restores the integrated dev experience.

## 9. Handbook reconciliation (do as the final phase)

- §1 story: Keycloak/Centrifugo/just-Postgres → Supabase Auth + Realtime + Postgres.
- §3 layers 1–2 (Supabase Auth/session), 4 (RLS: add the two-policy + channel
  note), 9 (brute-force → Supabase, not Keycloak).
- §2 principle 2: amend — *streamed tables carry a coarse `authenticated` policy
  for the Realtime role and scope rows at the channel layer; non-streamed tables
  keep ownership/role RLS.*
- §8: drop **F7 (Centrifugo)**; mark **F2** as Supabase Auth; note F13 (Keycloak
  Authz Services) shelved.
- §10: mark `2026-06-07-centrifugo-realtime-design.md` and the Keycloak specs
  superseded by this document.
