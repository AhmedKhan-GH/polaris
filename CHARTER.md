# Polaris Domain Charter

**Status:** v1.0 — adopted (clean-rewrite-2, commit 3) · **Date:** 2026-06-09
**Audience:** every human and agent who writes code in this repo.
**Purpose:** the constitution of domain boundaries. Each domain below is *ironclad*: it owns named files, exposes a named contract, and has explicit "never" rules. Anything that violates a "never" is a bug, even if it works.

This document owns **boundaries only**. Security mechanics live in `SECURITY.md`; roadmap and decision history live in the project handbook. One fact, one home — this charter cites, it does not restate.

**Change control:** changing a domain boundary, an iron rule, or a contract signature requires an ADR (`docs/adr/`) in the same PR as the change, and the import-boundary enforcement config must be updated in that same PR. Law and enforcement never drift apart.

---

## 1. The Iron Rules (dependency law)

Directory vocabulary, target layout of `clean-rewrite-2`:

- **Foundation contracts:** `lib/**` *except* `lib/registry/**`
- **Composition roots:** `lib/registry/**` plus the schema/config aggregation points enumerated in §3
- **Foundation surfaces:** `app/_features/{auth,shell,activity}/**` — UI/action surfaces of foundation domains
- **Business features:** every other `app/_features/<name>/**` (the exemplar `notes` is the reference one)

The rules:

1. **Foundation never imports features.** No file in `lib/**` (outside `lib/registry/**`) may import from `app/**`.
2. **Features never import each other.** `app/_features/<a>/**` may not import from `app/_features/<b>/**` when `a ≠ b`. (Foundation *surfaces* may depend on each other only through the contracts declared in §2 — e.g. shell renders auth's `signOutAction`.)
3. **Composition roots are the only wiring points.** Only files in §3 may import business-feature manifests, and they may import *manifests only* (`schema.ts`, `permissions.ts`, `nav.ts`) — never actions or components. A composition root is a flat list with zero logic.
4. **One reader / one resolver / one authority.** Exactly one `process.env` reader (D1), one identity resolver (D3's `getSessionUser`), one migration authority (D2: drizzle-kit; `supabase/migrations/` must not exist).
5. **Server actions self-guard.** Next 16 `proxy.ts` matchers do not see Server Action POSTs to excluded paths; the proxy is route hygiene, never an authorization layer. Every action wraps `withPermission` (D4) and reaches data only through `withUserContext` (D2).
6. **Two RLS identity paths, never mixed.** Tables read via Drizzle/`app_user` get GUC policies (`app.user_id` / `app.user_roles`); tables read via the Supabase client get `auth.uid()` policies. A policy written for one path is blind to the other (see `SECURITY.md` → RLS model).
7. **Streamed data is gated at the channel layer.** Never row-RLS on the streamed table for delivery filtering — the 0021 scar (`SECURITY.md` → RLS model; realtime identity context cannot see app GUCs and does not reliably resolve `auth.uid()` row-by-row).
8. **Features expose a dev API.** Outsiders import `app/_features/<name>` (the feature's `index.ts`) and nothing deeper; anything not exported from the index is private to the feature. The index never re-exports manifests — manifests remain the registry-only seam (rule 3). Exemptions: intra-feature imports, registry→manifest edges. "Dev API" is the TypeScript import surface, not a web API (ADR-0005).

**Enforcement is mechanical, not cultural:** the ESLint import-boundary zone encodes rule 1 as editor-time feedback; the Verification-domain test (D9) walks the import graph (all of `app/` and `lib/`) and fails on violations of rules 1–3 and 8. The exemplar's feature-confinement test (§4) proves rule 1 continuously.

---

## 2. Domain registry

Format per domain: **Mission** (the one question it answers) · **Owns** (files, target layout) · **Provides** (the public contract others may import) · **Never** (leakage tripwires) · **Proven by** (its test surface).

### D1 — Environment & Configuration
- **Mission:** "What configuration exists, and is it valid?"
- **Owns:** `lib/env/index.ts` (t3-env, Zod-validated, edge-safe `runtimeEnv`).
- **Provides:** the `env` object. Nothing else.
- **Never:** `process.env` read anywhere else (build-time exceptions: `next.config.ts`, `drizzle.config.ts`, CI's `SKIP_ENV_VALIDATION`). Never secrets in code or fixtures; `.env*` stays gitignored.
- **Proven by:** unit tests for parse failure = boot failure (fail closed).

### D2 — Persistence
- **Mission:** "How is data stored, and which rows exist for whom?"
- **Owns:** `lib/db/client.ts` (Drizzle, connects as non-superuser `app_user` via `DATABASE_URL`), `lib/db/with-user-context.ts` (per-transaction `set_config` of `app.user_id` + JSON-encoded `app.user_roles`; fail-closed UUID validation), `drizzle/` migrations + `drizzle.config.ts` (privileged `MIGRATE_DATABASE_URL`; `entities.roles` managed), the schema *conventions* (pgPolicy patterns, JSONB `@>` role checks, `timestamptz` always), and the `app_user` role definition.
- **Provides:** `db`, `withUserContext(identity, fn)`, the migration pipeline (`db:generate` / `db:migrate`), and the slice convention every table owner follows.
- **Never:** a business table in a foundation slice. Never connect as superuser at runtime. Never a comma-joined role string (JSON only — delimiter injection). Never hand-rolled SQL outside generated/`--custom` migrations.
- **Proven by:** Testcontainers migration smoke test (fresh-clone proof) + the non-superuser RLS harness (`rls-test-db.ts`) running as the real `app_user`.

### D3 — Identity
- **Mission:** "Who is this?"
- **Owns:** `lib/supabase/server.ts` (cookie-bound SSR client) + `lib/supabase/browser.ts` (singleton; realtime transport), `lib/auth/session.ts` (`getSessionUser`), `lib/auth/user.ts` (`AuthUser` type, provider-decoupled), `lib/db/schema/identity.ts` (`profiles` table: role source of truth, self-read RLS, write grants revoked from `authenticated`/`anon`), `app/_features/auth/` (sign-in/sign-out actions, `LoginForm`), `app/login/page.tsx`.
- **Provides:** `getSessionUser()` — the **only** identity resolver in the codebase; `signInAction` / `signOutAction` (consumed by D8's shell); the Supabase client factories (consumed by D7 transport and D8 proxy refresh).
- **Never:** permission decisions (that's D4). Never public self-registration (provisioning is out-of-band until F9 invite codes). Never another module reading the Supabase session directly.
- **Proven by:** unit tests on session resolution; live-Supabase integration tests on `profiles` RLS + write-lock (role self-escalation must fail loudly); login/logout/failure E2E.

### D4 — Authorization
- **Mission:** "May this role do this action on this subject?"
- **Owns:** `lib/permissions/ability.ts` (`buildAbility` — composes CASL rules from the registry's contributors; **owns no feature subjects itself**), `lib/permissions/guard.ts` (`withPermission(action, subject, fn)` — resolves identity once via D3, throws fail-closed, logs denials via D5), `lib/permissions/routes.ts` (public-path policy consumed by D8's proxy).
- **Provides:** `withPermission`, the `AbilityContributor` type (the seam every feature implements), route policy predicates.
- **Never:** a feature subject named in foundation code — `'Note'`, `'Order'` etc. arrive only via contributors (this inverts clean-rewrite's #1 weld). Never authorize without a session (no anonymous ability). Never trust the proxy for authz (Iron Rule 5).
- **Proven by:** unit tests for fail-closed behavior, denial logging, and contributor composition; integration tests proving CASL and RLS agree (defense in depth, two layers — `SECURITY.md` → the defense-in-depth stack).

### D5 — Observability & Audit
- **Mission:** "What happened?"
- **Owns:** `lib/logger.ts` (Pino; ops events and authz denials), `lib/db/schema/audit.ts` (`sign_in_log`: one row per successful sign-in; owner-only read via role-based RLS — the deliberate PII exception), the best-effort sign-in recorder used by D3's action, `app/_features/activity/` (owner-only viewer).
- **Provides:** `logger`; `recordSignIn` (best-effort: a DB outage must never block login); the activity surface.
- **Never:** audit *facts* that exist only in process logs (facts go to the database; Pino is operational). Never a blocking write in an auth flow. Business-data change audit is F10 (`supa_audit`) — reserved, not improvised per-feature.
- **Proven by:** unit tests on best-effort semantics; integration tests on `sign_in_log` RLS (member denied, owner reads); activity E2E.

### D6 — Abuse Resistance
- **Mission:** "How often may they?"
- **Owns:** `lib/rate-limit.ts` — the **factory only**: `createRateLimiter(opts)` + `withRateLimit(limiter, key, fn)` (rate-limiter-flexible; in-memory now, Redis at scale).
- **Provides:** the factory. Features instantiate and own their limiters in their own folder (this inverts clean-rewrite's `orderWriteLimiter` weld).
- **Never:** a named feature limiter in foundation code. Never a write action without a limiter decision (the decision may be "none", but it must be visible in the action).
- **Proven by:** unit tests on the factory (allow under, deny over, per-key isolation).

### D7 — Realtime Delivery
- **Mission:** "Who gets told about changes, live?"
- **Owns:** `lib/realtime/topics.ts` (topic grammar: `{domain}:{userId}` private, `{domain}:all` owner firehose; types), `lib/realtime/use-topic.ts` (client subscription hook over D3's browser client), and the two SQL templates features copy into `--custom` migrations: the `AFTER INSERT/UPDATE/DELETE` → `realtime.broadcast_changes()` trigger, and the `realtime.messages` RLS policy (subscriber locked to own topic; `owner` role additionally reads `:all`).
- **Provides:** the topic grammar, the hook, the templates.
- **Never:** delivery filtering via row-RLS on the streamed table (Iron Rule 7 / 0021 scar). Never a GUC-based policy in a realtime context (Realtime never sets app GUCs). Never an unauthenticated topic.
- **Proven by:** live-Supabase integration test on `realtime.messages` topic isolation; cross-user E2E (user A's change reaches A and owner, never B) — exercised through the exemplar.

### D8 — Shell & Routing
- **Mission:** "Where do things live on screen and URL?"
- **Owns:** `proxy.ts` (Next 16 proxy: Supabase session refresh + public-vs-authed gate using D4's route policy; Node runtime; named `proxy` export), `app/layout.tsx`, `app/page.tsx`, `app/(dashboard)/layout.tsx` + `app/(dashboard)/dashboard/page.tsx` (nav rendered from the registry — no hardcoded feature links), `app/_features/shell/` (`PageHeader`, `ChunkErrorReloader`), `lib/branding.ts` (product name, logos, copy — tenant strings appear nowhere else), security headers + CSP in `next.config.ts`.
- **Provides:** the authed shell, the nav seam (consumes `lib/registry/nav.ts`), branding tokens, stale-chunk recovery.
- **Never:** a feature link hardcoded in shell or dashboard. Never tenant branding inside components. Never authz in the proxy beyond public/authed (Iron Rule 5). Never real metadata left as scaffold defaults.
- **Proven by:** shell unit tests (header states, chunk reloader), security-headers E2E, landing E2E.

### D9 — Verification
- **Mission:** "How do we prove all of the above?"
- **Owns:** `vitest.config.mts` (unit: jsdom, fully mocked), `vitest.integration.config.mts` (Testcontainers postgres:17 + live-Supabase suites), `vitest.setup.ts`, `lib/db/__tests__/rls-test-db.ts`, `lib/db/__tests__/live-db.ts` (`liveDbGate`: self-skip locally, **hard-fail under `CI_REQUIRE_LIVE_DB=1`** — suites must never silently skip in CI), `playwright.config.ts` + `e2e/` harness (global setup seeds owner/member via GoTrue admin; truncates between runs), and the **import-boundary and feature-confinement tests** that enforce §1 and §4 mechanically.
- **Provides:** the three-tier harness every feature plugs into; the boundary law's teeth.
- **Never:** a superuser test connection (tests mirror prod). Never a security suite that can skip in CI. Never E2E against a shared mutable environment.
- **Proven by:** it is the proof. Its own gate logic (`liveDbGate`) is unit-tested.

### D10 — Delivery
- **Mission:** "How does code ship?"
- **Owns:** `.github/workflows/ci.yml` (fresh-clone `npm ci`; parallel build + e2e jobs; `npm audit --audit-level=high` gate; tsc, lint, unit, integration, `supabase start` (trimmed services) + migrations + live-RLS + E2E; Docker/Playwright caching), `.github/dependabot.yml`, `package.json` scripts, Node version pin (24).
- **Provides:** the green gate. A fresh clone + `npm ci` + the documented commands reproduce CI exactly.
- **Never:** a merge with a red or skipped-security gate. Never lockfile drift (dependency changes regenerate `node_modules` + lockfile from scratch). Never CI-only magic that local commands can't reproduce.
- **Proven by:** CI itself, plus the Testcontainers migration smoke test guarding the fresh-clone path.

### D11 — Governance
- **Mission:** "What are the rules, and how do they change?"
- **Owns:** this charter, the tracked handbook (single source of truth — **tracked**, ending the gitignored-canon scar), `docs/adr/` (one ADR per irreversible decision; the first ADRs record: Supabase-not-Keycloak with full rationale, the 0021 scar + channel-layer fix, login-only provisioning), the feature playbook (§5), commit/branch conventions.
- **Provides:** change control (§ header), conventions: Conventional Commits with scopes; **TDD scaled to altitude** (ADR-0010) — test-first for behavior that branches, transforms, or enforces a rule and for anything security/data/money-bearing (Tiers A/B, red → green → commit); design tokens, config, copy, and one-line stdlib wrappers are not red-green subjects (Tier C); linear trunk — feature branches rebase onto tip and fast-forward merge, preserving the TDD commit story without merge knots.
- **Never:** normative content duplicated across documents (cite, don't restate). Never a gitignored source of truth. Never a superseded spec left without a banner.
- **Proven by:** doc-drift review at each feature's close; ADR presence checked in PR review.

---

## 3. Composition roots (the only wiring points)

| Root | Aggregates | Consumed by |
|---|---|---|
| `lib/registry/abilities.ts` | each feature's `permissions.ts` (`AbilityContributor`) | D4 `buildAbility` |
| `lib/registry/nav.ts` | each feature's `nav.ts` (label, href, required permission) | D8 dashboard/shell |
| `lib/db/schema/index.ts` | foundation slices (`roles.ts`, `identity.ts`, `audit.ts`) + each feature's `schema.ts` | D2 client (relational queries) |
| `drizzle.config.ts` schema globs | `lib/db/schema/*.ts` + `app/_features/*/schema.ts` | drizzle-kit |

Adding a feature touches exactly these files plus the feature's own folder — nothing else in foundation. Removing a feature is the same diff in reverse.

---

## 4. The exemplar: `notes`

`app/_features/notes/` is a deliberately boring domain whose only job is to prove every seam and serve as the copy-paste template for real features (F6 orders onward). It must exercise:

1. **Schema slice** (`schema.ts`): `notes` table (uuid, `created_by`, `body`, `timestamptz`), GUC ownership RLS (`created_by = app.user_id` or owner role via JSONB `@>`), grants to `app_user` — through D2's conventions.
2. **Ability contribution** (`permissions.ts`): create/read-own/owner-reads-all — through D4's contributor seam.
3. **Actions** (`actions.ts`): `withPermission` → rate limiter (its own instance from D6's factory) → Zod input validation → `withUserContext`.
4. **Realtime** (`use-notes-realtime.ts` + live island): broadcast trigger + `realtime.messages` policy from D7's templates; topics `notes:{userId}` / `notes:all`.
5. **Nav registration** (`nav.ts`) and a `(dashboard)/notes` page.
6. **Dev API** (`index.ts`): the declared import surface (Iron Rule 8) — exports exactly what the route page consumes; internals like `use-notes-realtime.ts` stay private.
7. **All three test tiers**: unit (mocked), integration (RLS under real `app_user`; topic isolation on live Supabase), E2E (create, isolation between member A/B, owner sees all, live update delivery).

**Disposability is an acceptance criterion:** delete `app/_features/notes/`, remove its lines from the §3 roots, drop its migrations — the foundation must build green with the full suite passing. Enforced two ways: a one-time deletion rehearsal during construction (recorded in ADR-0004), and a continuous **feature-confinement test** (D9) asserting `notes` is referenced only in its own folder, the §3 registry lines, and its migrations.

---

## 5. Adding a feature (the playbook interns/agents follow)

1. Read this charter and the exemplar.
2. Copy `app/_features/notes/` → `app/_features/<name>/`; rename subjects, tables, topics — and the exports in `index.ts`, your dev API (outsiders import nothing else; Iron Rule 8).
3. Write the failing test first for behavior with logic or stakes (ADR-0010 Tiers A/B) — red → green → commit. Design tokens, copy, config, and trivial stdlib wrappers (Tier C) are not red-green subjects; guard them once in CI if regression risk is real (e.g. a11y contrast), never per edit.
4. Register manifests in the §3 roots (the only foundation files you touch).
5. Tables via D2 conventions (`db:generate`, hand-edit only for guards/casts, `--custom` for triggers); policies on the correct identity path (Iron Rule 6).
6. Actions self-guard (Iron Rule 5): `withPermission` + limiter decision + Zod + `withUserContext`.
7. Realtime only via D7 templates (Iron Rule 7).
8. Branch `feature/<name>` off the trunk; Conventional Commits; rebase + fast-forward merge when CI is green.
9. If you need to change anything in `lib/**` outside the registries: stop — that is a charter conversation, not a feature PR.

---

## 6. Security-layer ↔ domain cross-reference

The 14-layer security model (table in `HANDBOOK.md` §3; diagrams in `SECURITY.md`) maps onto domains as:

| Layers | Owner |
|---|---|
| 1 Authentication, 2 Session integrity | D3 |
| 3 Coarse authz | D4 |
| 4 Data isolation (RLS), 5 Least privilege | D2 (feature policies live in feature slices) |
| 6 Input validation | every boundary (Zod), enforced in actions |
| 7 Config & secrets | D1 |
| 8 Transport/browser hardening | D8 |
| 9 Abuse resistance | D6 |
| 10 Observability & audit | D5 |
| 11 Supply chain, 12 Resilience | D10, D8 |
| 13 Verification | D9 |
| 14 Structure | this charter |
