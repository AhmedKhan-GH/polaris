# Clean-Rewrite-2 Construction Plan

> **Historical foundation record** — the construction plan for `clean-rewrite-2`, the TDD foundation the current system is built on (completed ~2026-06-10). Kept as genesis; the *as-built* reality is the code + [`HANDBOOK.md`](../../HANDBOOK.md) / [`CHARTER.md`](../../CHARTER.md) / [`docs/adr/`](../adr/). (The status line below is from when it was written.)

**Status:** draft, pending review · **Date:** 2026-06-09
**Companion to:** `CHARTER.md` (the boundaries this plan builds) · cites `SECURITY.md` for mechanics.
**Outcome:** branch `clean-rewrite-2` — a pure foundation with a linear, every-commit-green, TDD-per-commit history; no business vocabulary except the disposable `notes` exemplar.

---

## 1. Goal and non-goals

**Goal.** Re-derive the foundation fresh — ~33 strictly test-driven commits on a new branch. The audited end-state of `clean-rewrite` (HEAD `96f0480`: 0 critical/high security findings, ~91 tests) is the **behavioral specification and decision record, never a copy source**: no production file is transcribed; every implementation is written from its own failing tests, with the charter's seams built in from the start.

**Non-goals (explicitly out):**
- The orders domain and all F6+ business features — built later by feature teams following Charter §5.
- The IAM org model (`organizations`, `memberships`, `app.org_id`) — F12 / the IAM project.
- Public self-registration (login-only stands; provisioning out-of-band until F9 — ADR-0003).
- Enforcing CSP (stays report-only; enforce+nonce is a deploy-time task, tracked in HANDBOOK).

## 2. Construction method

- **Base:** `bd8da07` ("Initial commit from Create Next App", 2026-04-14) — the merge-base of `main` and `clean-rewrite`. Shared root keeps cross-branch diffs meaningful for behavior comparison and the final parity check. `git switch -c clean-rewrite-2 bd8da074`.
- **Reference, not source:** `clean-rewrite` HEAD (`96f0480`) supplies three things — the *decisions* (stack, architecture, security model), the *behavior inventory* (what its ~91 tests prove, distilled into per-commit checklists during detailed planning), and *platform notes* (hard-won quirks: auth-schema-guarded SQL, GoTrue admin seeding, the 0021 scar). **No code is copied.** Production code is written fresh from failing tests. Test infrastructure may mirror the old harness's approach (tests are not production code) but is typed fresh against the new structure.
- **The loop, every production-code commit** (strict micro-cycles — one test at a time):
  1. Take the next behavior from the commit's checklist. Write **one** failing test for it. Run. **Observe red — for the right reason** (feature missing, not a typo or broken import). A behavior that is already green belongs to an earlier commit or is redundant: stop and fix the plan, never the test.
  2. Write the **minimal** code to pass. Run. **Observe green with pristine output** — the whole suite, not just the new test.
  3. **Refactor while green** (names, duplication, extraction). No new behavior outside a new cycle.
  4. Repeat 1–3 until the checklist is exhausted. Run the full gate in force at that point in history (§4). Commit with a Conventional-Commits message.
- **One TDD mode, no exceptions for production code.** **The firewall against accidental copying:** each commit's behavior checklist is distilled from `clean-rewrite` *before* construction (in the detailed implementation plan); while implementing, the old branch stays closed. If construction hits a platform quirk, the old code may be consulted *between* cycles like any other documentation — and what's learned goes into the checklist in words, never pasted as code.
- **Review cadence:** pause before each commit for Ahmed's review (step-by-step rule). No commit is made unreviewed.
- **No deferred verification.** `clean-rewrite`'s "[written, not executed in this env]" compromise is forbidden here: commits whose tests need live Supabase are constructed with `supabase start` running locally.
- **Next 16 rule:** before writing any Next-touching code, consult `node_modules/next/dist/docs/` (AGENTS.md standing instruction — proxy semantics, async request APIs, Turbopack defaults).
- **Dependency changes** always regenerate `node_modules` + lockfile from scratch (the lockfile-thrash lesson, 3 fix commits in `clean-rewrite`).
- **Dependencies enter at first use.** No big upfront install: each library lands in the lockfile in the commit that first needs it (§3.0 table). The history then doubles as a dependency review — every dep is introduced next to the test that justifies it.

## 3. The commit sequence

Per commit: **message** · delivers · *red test that demands it* · **Spec** = where its behavior checklist is distilled from (`clean-rewrite` tests/migrations/docs, or novel). All production code is written fresh from failing tests — Spec names lineage, never a copy source.

### 3.0 Bill of materials — what each commit uses

"Uses" = the technology exercised; "New deps" = what enters the lockfile in that commit (— = nothing new).

| # | Uses | New deps |
|---|---|---|
| 1 | npm; version pins | `next@16.2.x`, `react@19.2`, `react-dom`, `typescript@5`, `tailwindcss@4` + `@tailwindcss/postcss`, `eslint@9` + `eslint-config-next` |
| 2 | git only | — |
| 3 | markdown only | — |
| 4 | Vitest 4 (jsdom), Testing Library, ESLint import zones, hand-rolled boundary scanner | `vitest`, `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `eslint-plugin-import-x` |
| 5 | GitHub Actions, `actions/setup-node`, `npm audit`, Dependabot | — |
| 6 | t3-env + Zod 4 | `@t3-oss/env-nextjs`, `zod` |
| 7 | Pino | `pino`, `pino-pretty` |
| 8 | Testcontainers (postgres:17), second Vitest config | `@testcontainers/postgresql`, `testcontainers` |
| 9 | Drizzle ORM/Kit, node-postgres; migration M0 | `drizzle-orm`, `drizzle-kit`, `pg` |
| 10 | Drizzle transactions + `set_config`, Zod (UUID) | — |
| 11 | `actions/cache` (Docker images) | — |
| 12 | Supabase SSR + JS clients | `@supabase/ssr`, `@supabase/supabase-js` |
| 13 | Supabase CLI local stack, auth-guarded SQL; migration M1 | — (CLI is tooling, not a dep) |
| 14 | `@supabase/ssr` server client + Drizzle | — |
| 15 | Drizzle; migration M2 | — |
| 16 | Zod, React 19 `useActionState`, Testing Library | — |
| 17 | Next 16 `proxy` (Node runtime), `@supabase/ssr` | — |
| 18 | CASL 7 | `@casl/ability` |
| 19 | CASL + Pino + `getSessionUser` | — |
| 20 | Testing Library, `next/font`, Tailwind | — |
| 21 | Testing Library | — |
| 22 | Next `headers` config | — |
| 23 | Playwright, GoTrue admin API, Supabase CLI | `@playwright/test` |
| 24 | Registry seams (abilities + nav), Drizzle | — |
| 25 | rate-limiter-flexible | `rate-limiter-flexible` |
| 26 | `supabase-js` Realtime channels | — |
| 27 | Drizzle; migration M3 | — |
| 28 | CASL + Zod + D6 factory + `withUserContext` | — |
| 29 | D7 SQL templates (migration M4), Playwright | — |
| 30 | The c4 boundary scanner, re-targeted at confinement | — |
| 31 | `supabase/setup-cli`, `actions/cache` (Docker + Playwright) | — |
| 32 | markdown only | — |
| 33 | markdown + `.github` PR template | — |

### 3.1 TDD fidelity ledger

| Class | Commits | Discipline |
|---|---|---|
| **TDD-authentic production code** — all of it | 6, 7, 9, 10, 12–22, 24–29 | Strict micro-cycles: one failing test at a time, red→green→refactor, implementation written fresh — `clean-rewrite` consulted only as specification, closed during implementation |
| **Exempt — test infrastructure** (tests are not production code) | 4, 8, 23, 30 | Their own red = planted-violation fixtures ("test the test"); may mirror the old harness's approach, typed fresh |
| **Exempt — configuration / docs** (recognized TDD exceptions) | 1, 2, 3, 5, 11, 31, 32, 33 | Verified by the gates they enable, not by unit tests |

**Known ordering deviations (accepted, recorded):**
1. **Async server components are not unit-testable in jsdom.** The `(dashboard)` layout's auth-redirect (c20) and the login page's redirect-if-authed (c16) receive their failing behavioral tests at c23 (E2E) — up to three commits after the code lands. Outside-in TDD would demand the acceptance test first, but Playwright cannot run before login + shell exist (bootstrap circularity). The window is small and closes within the phase.
2. **D7's SQL templates (c26) are documentation, not production code.** They are inert text until copied into migration M4 at c29, where the live topic-isolation test provides their red. The production-code/red pairing belongs to c29.

### Phase 0 — Root & hygiene (no production code)

1. **`chore: pin toolchain and refresh scaffold`** — Next 16.2.x / React 19.2 / TS 5 current, fresh lockfile, Tailwind v4, ESLint flat config, `postcss.config.mjs`. Spec: version set from HEAD's `package.json` (configuration — version pins are not code).
2. **`chore: repo hygiene`** — untrack `.idea/` and ignore it; ensure `docs/` is tracked (never re-add the `/docs` ignore); delete unused scaffold SVGs; `.gitignore` final form. Spec: novel.
3. **`docs(governance): adopt DOMAIN-CHARTER and founding ADRs`** — `CHARTER.md` (v1.0); `docs/adr/0001-supabase-auth-not-keycloak.md` (rationale lifted from the 2026-06-09 reversal spec: SSO/federation/UMA unused, Keycloak broke Supabase Realtime, two extra containers, CI flakes); `0002-channel-layer-realtime.md` (the 0021 scar: row-RLS cannot gate streamed tables — neither `auth.uid()` nor app GUCs resolve in the realtime context; gate at `realtime.messages`); `0003-login-only-provisioning.md`; `0004-fresh-derivation.md` (this plan: `clean-rewrite` serves as specification and decision record for `clean-rewrite-2`; no code copied; where the audit lives; deletion-rehearsal record). ADR template. Spec: distilled from the reversal spec, Plan-1, and the handbooks.

### Phase 1 — Verification skeleton + CI first

4. **`test(verification): vitest harness + import-boundary law`** — `vitest.config.mts` (jsdom, excludes), `vitest.setup.ts`; boundary enforcement is two thin layers: `eslint-plugin-import-x` `no-restricted-paths` zones (editor + lint gate) and a hand-rolled D9 scanner test (glob + import-statement scan, ~50 lines, no graph dependency) that fails on any `lib/** → app/**` import or cross-feature import. *Red: a deliberate violation fixture fails the boundary test, then is removed.* Spec: novel.
5. **`ci: fresh-clone gate`** — `.github/workflows/ci.yml` job 1: `npm ci` → `npm audit --audit-level=high` → `tsc --noEmit` → `eslint` → `vitest run`; Node 24; npm cache; `.github/dependabot.yml`. Spec: HEAD's ci.yml structure (configuration).

### Phase 2 — D1 Environment, D5 logger

6. **`feat(env): t3-env validated environment`** — `lib/env/index.ts`: framework, `LOG_LEVEL`, `SKIP_ENV_VALIDATION` escape for CI build. Later domains add their vars in their own commits. *Red: invalid/missing values crash at import (fail closed); server vars unreadable client-side.* Spec: the `clean-rewrite` equivalent, restructured per charter.
7. **`feat(observability): pino logger`** — `lib/logger.ts`, level from env, pretty transport in dev. *Red: level respected; child loggers carry context.* Spec: the `clean-rewrite` equivalent's test behaviors.

### Phase 3 — D2 Persistence

8. **`test(verification): Testcontainers integration harness`** — `vitest.integration.config.mts` (only `*.integration.test.ts`, 60s timeouts, env injection before client import), `lib/db/__tests__/rls-test-db.ts` (boot postgres:17 → migrate → connect as `app_user`), `test:integration` script. *Red→green: harness boots and connects.* Spec: the `clean-rewrite` equivalent's test behaviors.
9. **`feat(db): drizzle pipeline + app_user runtime role`** — `drizzle.config.ts` (schema globs `lib/db/schema/*.ts` + `app/_features/*/schema.ts`, `entities.roles`, `MIGRATE_DATABASE_URL`), `lib/db/client.ts` (connects as `app_user` via `DATABASE_URL`), `lib/db/schema/roles.ts` + `lib/db/schema/index.ts` (aggregation root), migration **M0** (role). Env adds `DATABASE_URL`, `MIGRATE_DATABASE_URL`. *Red: migration smoke test — fresh container, migrations apply, `app_user` exists and is non-superuser.* Spec: behaviors of HEAD's db pipeline; the slice structure is novel (Charter §3).
10. **`feat(db): withUserContext GUC plumbing`** — `lib/db/with-user-context.ts`: per-transaction `set_config` of `app.user_id` + JSON-encoded `app.user_roles`; fail-closed UUID validation. *Red: unit (rejects bad UUID, JSON-encodes roles) + integration (GUCs visible in-transaction, absent outside, under real `app_user`).* Spec: the `clean-rewrite` equivalent's test behaviors.
11. **`ci: integration tests in pipeline`** — extend job 1 with Testcontainers image caching + `test:integration`. Spec: the `clean-rewrite` equivalent, restructured per charter.

### Phase 4 — D3 Identity (+ D5 audit table)

12. **`feat(identity): supabase server + browser clients`** — `lib/supabase/server.ts` (cookie-bound, `await cookies()`), `lib/supabase/browser.ts` (singleton). Env adds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. *Red: unit with mocked `@supabase/ssr`.* Spec: the `clean-rewrite` equivalent's test behaviors.
13. **`feat(identity): profiles — role source of truth`** — `supabase init` (config.toml committed — the local stack the live suites and CI depend on); `lib/db/schema/identity.ts` (profiles slice), migration **M1** (table + self-read RLS `id = auth.uid()` + revoke INSERT/UPDATE/DELETE from `authenticated`/`anon` — auth-schema-guarded SQL so it also runs on vanilla testcontainers); `lib/db/__tests__/live-db.ts` (`liveDbGate`: skip locally when down, **hard-fail under `CI_REQUIRE_LIVE_DB=1`**). *Red: gate unit tests; live-Supabase integration — self-read only, cross-read denied, role self-escalation fails loudly (privilege denied, not 0 rows).* Spec: behaviors of migrations 0008 + 0011, re-expressed as one fresh migration.
14. **`feat(identity): getSessionUser resolver`** — `lib/auth/session.ts` (the **only** identity resolver: Supabase user + `profiles.role`), `lib/auth/user.ts` (`AuthUser`). *Red: no session → null; session → AuthUser with role; profiles miss handled.* Spec: the `clean-rewrite` equivalent's test behaviors.
15. **`feat(observability): sign_in_log audit table`** — `lib/db/schema/audit.ts` (slice), migration **M2** (table + owner-only-read RLS, insert unrestricted, GUC path), `lib/audit/record-sign-in.ts` (best-effort recorder). *Red: recorder swallows DB failure (login must never block); integration — member read denied, owner reads, insert works under `app_user`.* Spec: behaviors of migrations 0000/0003/0004/0005/0007 as one fresh migration; recorder behavior from HEAD's auth actions, relocated per Charter D5.
16. **`feat(identity): sign-in/out actions + login page`** — `app/_features/auth/actions.ts` (`signInAction`: Zod input → Supabase auth → `recordSignIn`; `signOutAction`), `app/_features/auth/LoginForm.tsx` (mounted-deferral hydration fix), `app/login/page.tsx` (redirect if authed). **No registration path.** *Red: unit — invalid input rejected, failure message on bad creds, log written on success, no log on failure.* Spec: the `clean-rewrite` equivalent's test behaviors.
17. **`feat(shell): proxy + public-route policy`** — `lib/permissions/routes.ts` (D4: `isPublicPath` only — `canAccessRoute` stub from `clean-rewrite` is **dropped**, YAGNI until F9/F11), `proxy.ts` (D8: named `proxy` export, Node runtime, Supabase session refresh, public-vs-authed redirect only — authz stays in actions, Iron Rule 5). *Red: routes unit tests; proxy session-refresh unit test with mocked ssr.* Spec: the `clean-rewrite` equivalent, restructured per charter.

### Phase 5 — D4 Authorization (the seam — new TDD)

18. **`feat(authz): ability composition seam`** — `lib/permissions/ability.ts` (`AbilityContributor` type, `buildAbility(contributors, identity)`), `lib/registry/abilities.ts` (**empty list**). *Red: empty registry grants nothing (fail closed); a test contributor's rules compose; contributors are isolated from each other.* Spec: novel seam; rule semantics from HEAD's ability tests.
19. **`feat(authz): withPermission guard`** — `lib/permissions/guard.ts`: resolve `getSessionUser` once → build ability from registry → check → throw fail-closed on deny with Pino denial log → hand identity to callback. *Red: no session throws; denied action throws + logs; allowed action passes identity through.* Spec: HEAD's guard behaviors; registry-backed wiring is novel.

### Phase 6 — D8 Shell, D5 surface, D6

20. **`feat(shell): branding + layouts + nav registry`** — `lib/branding.ts` (product name, logos, copy — the only home of tenant strings), `app/layout.tsx` (real metadata from branding), `app/page.tsx` + `app/_features/landing/LandingPage.tsx` (branding-driven), `app/(dashboard)/layout.tsx` (authed shell + `PageHeader` with `signOutAction`), `app/(dashboard)/dashboard/page.tsx` rendering `lib/registry/nav.ts` (**empty**; `NavItem` = label/href/permission). *Red: RTL — branding strings render from config; header authed/anon states; dashboard renders zero hardcoded feature links.* Spec: HEAD's shell behaviors, genericized; branding/nav seams novel.
21. **`feat(shell): chunk-error auto-reload`** — `app/_features/shell/ChunkErrorReloader.tsx`. *Red: reloads on ChunkLoadError once per cooldown.* Spec: the `clean-rewrite` equivalent's test behaviors.
22. **`feat(shell): security headers + report-only CSP`** — headers as exported, unit-tested data consumed by `next.config.ts`. *Red: required headers present (frame-deny, nosniff, referrer, HSTS, permissions-policy), CSP report-only.* Spec: the `clean-rewrite` equivalent, restructured per charter.
23. **`test(e2e): playwright harness + auth journeys`** — `playwright.config.ts` (chromium, workers 1, own dev server, `.env.test`), `e2e/global-setup.ts` (GoTrue admin seeds owner+member, profiles rows, truncation), `e2e/helpers.ts`; specs: landing, login, login-failure, logout, security-headers. Requires local `supabase start`. Spec: HEAD's e2e journeys, minus orders.
24. **`feat(observability): activity viewer`** — `app/_features/activity/`: `permissions.ts` (owner reads SignInLog) + **first registry entries** (abilities + nav), `getSignInLog.ts` (`withPermission` → `withUserContext`), `app/(dashboard)/activity/page.tsx`; e2e spec (owner sees, member blocked). *Red: contributor unit; member denial integration; e2e.* Spec: HEAD's activity behaviors; the contributor form is novel.
25. **`feat(abuse): rate-limiter factory`** — `lib/rate-limit.ts`: `createRateLimiter(opts)` + `withRateLimit(limiter, key, fn)` only — **no feature instances**. *Red: allow under / deny over / per-key isolation.* Spec: HEAD's limiter behaviors, factory-only (no feature instances).

### Phase 7 — D7 Realtime plumbing

26. **`feat(realtime): topic grammar + hook + SQL templates`** — `lib/realtime/topics.ts` (`topicFor(domain, userId)`, `topicAll(domain)`, types), `lib/realtime/use-topic.ts` (subscribe via browser client, cleanup on unmount), `lib/realtime/templates/` (broadcast-trigger SQL + `realtime.messages` policy SQL, realtime-schema-guarded, with usage README — documentation artifacts; their executable red arrives when instantiated as migration M4 in c29). *Red: grammar unit tests; hook subscribe/cleanup with mocked client.* Spec: generalization of HEAD's orders realtime + migrations 0009/0010.

### Phase 8 — The `notes` exemplar (Charter §4)

27. **`feat(notes): schema slice + ownership RLS`** — `app/_features/notes/schema.ts` (uuid, `created_by`, `body`, `timestamptz`), migration **M3** (RLS: own rows or owner-role via JSONB `@>`; grants to `app_user`), registered in schema aggregation. *Red: integration under real `app_user` — member sees own, cross-member denied, owner sees all, JSON role check.* Spec: orders slice behaviors, renamed to notes.
28. **`feat(notes): ability contribution + actions`** — `permissions.ts` (+ registry line), `actions.ts`: `withPermission` → own limiter (from D6 factory) → Zod → `withUserContext`. *Red: unit — denial without permission, rate-limit exceeded path, invalid input; integration — create/list respect RLS.* Spec: orders action behaviors, renamed to notes.
29. **`feat(notes): realtime + live island + page + e2e`** — migration **M4** from D7 templates (trigger → `notes:{userId}` + `notes:all`; `realtime.messages` policy), `use-notes-realtime.ts` + `NotesLive.tsx`, `app/(dashboard)/notes/page.tsx`, `nav.ts` (+ registry line); live-Supabase integration: topic isolation; e2e: create, A/B isolation, owner firehose, live cross-user delivery. *Red: each tier.* Spec: orders realtime behaviors, renamed to notes.
30. **`test(verification): feature-confinement check`** — static D9 test: `notes` referenced only inside its folder, the §3 registry lines, and its migrations. Enforces Charter §4 disposability continuously. **Manual deletion rehearsal performed here** (delete feature + registry lines + migrations on a scratch worktree → full suite green → discard), result recorded in ADR-0004. *Red: a planted stray reference fails the check, then is removed.* Spec: novel.

### Phase 9 — Full delivery pipeline

31. **`ci: full pipeline`** — parallel e2e job: trimmed `supabase start` (Postgres/Auth/Kong/PostgREST/Realtime only), `db:migrate`, live-RLS suites with `CI_REQUIRE_LIVE_DB=1` (hard-fail, never self-skip), `.env.test` from `supabase status`, Playwright with browser/Docker caching. Spec: the `clean-rewrite` equivalent, restructured per charter.

### Phase 10 — Governance close

32. **`docs(governance): HANDBOOK — single tracked source of truth`** — merged from the three drifted handbooks; httpOnly fact correct (cookie deliberately readable for Realtime auth; XSS answered by CSP at deploy); profiles write-lock documented; control→file map on the -2 layout; roadmap F6+ naming `notes` as the template; supersession banners on nothing (one doc). `SECURITY.md` remains the security-mechanics canon; charter remains boundaries. Spec: merge of the three handbooks.
33. **`docs(governance): feature playbook + PR conventions`** — Charter §5 expanded into concrete commands; PR template with "ADR required if `lib/**` touched outside registries" gate; branch naming; rebase + fast-forward merge convention. Spec: novel.

## 4. Gates per point in history

| From commit | Gate in force at every commit |
|---|---|
| 4 | lint + `tsc --noEmit` + unit |
| 8 | + integration (Testcontainers) |
| 13 | + live-Supabase suites (local `supabase start` during construction; `liveDbGate` self-skips only outside CI) |
| 23 | + E2E (run at phase boundaries and at every commit that touches a journey; always at 29–33) |
| 31 | + full CI green on GitHub for the branch tip |

## 5. Acceptance criteria (branch done)

1. `git log --oneline bd8da07..clean-rewrite-2` is linear, ~33 commits, Conventional-Commits clean; every commit checks out green under its §4 gate.
2. Fresh-clone CI fully green; live-RLS suites executed (not skipped) in CI.
3. Feature-confinement test green; deletion rehearsal recorded in ADR-0004.
4. Charter Iron Rules mechanically enforced (ESLint zones + boundary test) with zero violations.
5. No business vocabulary outside `app/_features/notes/`; no Keycloak/Centrifugo references; no scaffold cruft; `.idea/` untracked; `docs/` tracked.
6. Behavioral parity with `clean-rewrite` HEAD minus orders, plus notes: login/logout, session refresh, profiles RLS + write-lock, sign_in_log + activity, headers/CSP, rate limiting, realtime delivery — every behavior in HEAD's ~91-test inventory present and proven by `clean-rewrite-2`'s own fresh-written tests, same or stronger.
7. Migrations: exactly M0–M4, each applying cleanly to both vanilla Postgres (Testcontainers) and live Supabase.

## 6. Risks and mitigations

- **Stale base (April scaffold):** commit 1 immediately pins current versions and regenerates the lockfile; nothing else is built on the stale toolchain.
- **Live-Supabase availability:** required locally for commits 13, 23, 29–31; `liveDbGate` makes absence loud in CI, silent-skip impossible.
- **Behavioral drift while re-deriving:** mitigated by per-commit behavior checklists distilled from HEAD's tests *before* construction, the §5.6 inventory check at the end, and the boundary/confinement tests for structural drift.
- **Fresh derivation is slower than copying:** accepted deliberately for TDD integrity (Ahmed's call, 2026-06-09). Contained because the architecture is already settled — construction is execution against checklists, not exploration.
- **Scope creep:** anything not in §3 is out; if construction reveals a needed change to `lib/**` contracts, that is a charter conversation first (Charter §5.9).

## 7. After this plan

1. Ahmed reviews this document and the charter amendment (§4 continuous confinement).
2. Detailed implementation plan via the writing-plans process — for each commit: the distilled behavior checklist (from `clean-rewrite`'s tests/migrations/docs), file list, exact commands, and red-verification steps. The distillation is where the old branch gets read deeply *once*, so it can stay closed during construction.
3. Execution with per-commit review checkpoints; `clean-rewrite` stays untouched as the audited reference.
