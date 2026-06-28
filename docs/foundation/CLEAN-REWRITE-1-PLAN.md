> ⚠️ **SUPERSEDED — the *original* (pre-`clean-rewrite-2`) plan.** The Supabase-Auth-era roadmap, two generations old: superseded first by the Keycloak detour, then by `clean-rewrite-2` ([`CLEAN-REWRITE-2-PLAN.md`](CLEAN-REWRITE-2-PLAN.md)). Kept for the full genesis lineage; the current system is the `-2` foundation + [`HANDBOOK.md`](../../HANDBOOK.md).

# Clean Rewrite Plan

## Branch Strategy

- Feature branches off `clean-rewrite`
- Incremental commits on feature branches
- Squash merge into `clean-rewrite` when feature is complete

---

## Feature 1: Auth (feature/auth) — DONE

Packages: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `@playwright/test`

### Playwright setup

- [x] Playwright config + test setup
- [x] Test user seeding for Supabase

### Login (done)

- [x] signInAction — Zod validation, returns errors on invalid input
- [x] signInAction — returns error on invalid credentials
- [x] signInAction — redirects on successful login
- [x] Supabase browser client (`lib/supabase/browser.ts`)
- [x] LoginForm component + component tests (`app/_features/auth/LoginForm.tsx`)
- [x] Login page (`app/(landing)/login/page.tsx`) — renders LoginForm
- [x] Proxy (formerly middleware) — session validation, redirect unauthenticated to /login
- [x] Landing page — introduce Polaris with auth-aware buttons (log in / dashboard + log out)
- [x] signOutAction — clear session, redirect to /login
- [x] Dashboard layout — shell with log out button and back link to landing
- [x] Login page — back link to landing page, consistent "Log in" naming
- [x] signInAction — redirect to /dashboard on successful login
- [x] E2E: login with valid credentials → redirect to /dashboard
- [x] E2E: login with invalid credentials → error displayed
- [x] E2E: login with empty fields → validation errors
- [x] E2E: unauthenticated visit to /dashboard → redirect to /login
- [x] E2E: authenticated user visiting /login → redirect to /dashboard

### Logout

- [x] E2E: log out clears session and redirects to landing page
- [x] E2E: authenticated user sees "Log out" in header

### Landing page

- [x] E2E: unauthenticated user sees "Log in" in the header
- [x] E2E: authenticated user sees "Dashboard" link on landing

PR: squash merge into `main` as `feat: add email/password auth with E2E tests`

---

## Feature 2: Permissions — CASL + RLS (feature/permissions)

Packages: `@casl/ability`, `drizzle-orm`, `drizzle-kit`, `pg`, `@types/pg`, `pino`
Dev packages: `testcontainers`, `@testcontainers/postgresql`, `pino-pretty`
CI: Add Postgres service container + migration step

### Database foundation

- [ ] Drizzle config + db client (`lib/db.ts`, `lib/schema.ts`)
- [ ] First migration infrastructure
- [ ] Migration integration test (Testcontainers — empty Postgres, run migrations, assert tables)

### App roles and profiles

- [ ] Profiles table + migration (id, role, linked to auth.users)
- [ ] Roles enum (`owner`, `admin`, `member`, `guest`)
- [ ] Supabase access token hook — embed `user_role` in JWT claims
- [ ] Seed default role on account creation (e.g. `member`)

### Event tracking (analytics layer)

Every user action produces an immutable event record. Analytics are derived queries on top.

- [ ] Events table + migration (`id`, `actor_id`, `action`, `resource_type`, `resource_id`, `metadata jsonb`, `created_at`)
- [ ] `trackEvent()` helper (`lib/events/track.ts`) — called from server actions
- [ ] RLS: events are insert-only for authenticated users, select for admins
- [ ] Instrument existing auth actions (login, logout) with event tracking
- [ ] Unit tests for `trackEvent()`
- [ ] Integration test: events written to real database

### Structured logging (Pino)

Operational logs — errors, request timing, debugging. Separate from event tracking.

- [ ] Pino config (`lib/logger.ts`)
- [ ] Request logging in proxy/middleware
- [ ] Structured error logging in server actions

### Permission schema (CASL)

- [ ] Permission schema (`lib/permissions/schema.ts`) — subjects and actions per role
- [ ] `defineAbilityFor` — derive CASL abilities from schema (`lib/permissions/abilities.ts`)
- [ ] Permission subjects per domain entity (`lib/permissions/subjects/`)
- [ ] `withPermission()` server action guard (`lib/permissions/guard.ts`)

### Row-Level Security (RLS)

- [ ] Enable RLS on all tables
- [ ] SELECT/INSERT/UPDATE/DELETE policies per table using `auth.jwt() ->> 'user_role'`
- [ ] Block `anon` role on all tables
- [ ] Ownership checks where applicable (`created_by = auth.uid()`)

### Client integration

- [ ] `lib/permissions/hooks.tsx` — client-side permission checks
- [ ] `lib/permissions/routes.ts` — route access derivation from schema
- [ ] Gate UI elements (buttons, links, pages) behind permission checks

### Testing

- [ ] Unit tests for CASL ability derivation per role
- [ ] Unit tests for `withPermission()` guard
- [ ] Integration tests for RLS policies (real database via Testcontainers)
- [ ] E2E tests for role-based UI visibility

Squash merge as: `feat: add database foundation, permissions, and event tracking`

---

## Feature 3: Orders Domain

Depends on: Feature 2 (database, permissions, events already in place)

- [ ] Orders table schema + migration
- [ ] Order domain model (`lib/domain/order.ts`) — type, toOrder mapper
- [ ] Domain unit tests — toOrder, validation, edge cases
- [ ] Order repository (`lib/db/orderRepository.ts`) — insert, findById, findAll
- [ ] Repository integration tests against real Postgres
- [ ] Order service (`lib/services/orderService.ts`) — createOrder
- [ ] Service unit tests
- [ ] RLS policies for orders table
- [ ] Event tracking for order actions (created, updated, transitioned)

Squash merge as: `feat: add orders domain with repository and service layer`

---

## Feature 4: Orders UI

Packages: `@tanstack/react-query`

- [ ] QueryClient provider setup
- [ ] Orders server actions (`app/_features/orders/data/actions.ts`)
- [ ] useOrders hook — fetch, paginate, cache
- [ ] OrdersShell / OrdersPage component
- [ ] Kanban view
- [ ] List view
- [ ] View switcher
- [ ] Component tests for views and hooks

Squash merge as: `feat: add orders UI with kanban and list views`

---

## Feature 5: Settings + UI Polish

Packages: `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `@radix-ui/react-slot`

- [ ] Settings page — account management
- [ ] Invite codes (admin creates invite → new user registers with code → assigned role)
- [ ] Password reset
- [ ] App shell — top bar, navigation
- [ ] Shared UI primitives (as needed)

Squash merge as: `feat: add settings and app shell`

---

## Shelved

Features intentionally deferred. Revisit when core flows are stable.

### User-facing registration

- "Sign up" button on landing page for unauthenticated users
- "Sign up" link in PageHeader alongside "Log in"
- `/register` route with registration form (email, password, confirm password)
- signUpAction — Zod validation, create user via Supabase Auth
- Email verification handling (Supabase confirmation flow)
- Validation and error feedback on registration form
- Redirect to /dashboard on successful registration
- Cross-links between login and register pages
- E2E tests for registration flows

**Why shelved:** Internal tool — accounts created by admins, not self-service. User-facing registration adds complexity without immediate value.

**Revisit when:** The tool becomes external-facing or onboarding volume justifies self-service.

### OAuth (Google / GitHub login)

- Google OAuth provider setup in Supabase
- GitHub OAuth provider setup in Supabase
- OAuth callback route (`/auth/callback`)
- "Sign in with Google/GitHub" buttons on login page
- Link OAuth accounts to existing email accounts

**Why shelved:** Single auth path (email/password) is simpler to maintain and test. OAuth adds provider config complexity.

**Revisit when:** Users request it or SSO becomes a requirement.

---

## CI Pipeline Growth

| Feature landed | CI step added |
|---|---|
| Auth (Feature 1) | npm ci, tsc, lint, test, build, Playwright E2E |
| Permissions (Feature 2) | Postgres service container + drizzle-kit migrate + test:integration |
| Database (Feature 3) | Migration integration tests run under test:integration |
| Orders UI (Feature 4) | Component tests run under existing npm test |
