# Polaris Handbook

**Status:** living document — THE single tracked source of truth for identity, security model, and roadmap.
**Boundaries** live in `DOMAIN-CHARTER.md` (the constitution). **Decisions** live in `docs/adr/`. This handbook cites both; it does not restate them. One fact, one home.

---

## 1. What Polaris is

An internal cold-chain logistics order-management tool for the people running the business. Single Next.js 16 monolith on the Supabase platform (Auth + Postgres + Realtime), Drizzle-managed schema, two roles today: **`owner`** (operators, read-everything) and **`member`** (staff, own-rows). No public self-registration — accounts are provisioned out-of-band (ADR-0003). The product surface (orders domain, live kanban) is built as features on top of this foundation, starting at F6.

`clean-rewrite-2` is a fresh TDD derivation of the audited predecessor (ADR-0004): 33 linear commits, every one green, every production line born from a failing test.

## 2. Principles

The charter's Iron Rules (`DOMAIN-CHARTER.md` §1) govern structure. Operationally:

1. **Fail closed** — no session → throw; empty ability registry → no permissions; missing GUC → RLS denies.
2. **Defense in depth** — CASL (action layer) AND RLS (row layer); the proxy gates routes, but every server action self-guards (Server Action POSTs can bypass proxy matchers).
3. **Validate at every boundary** — Zod on env, inputs, identity context.
4. **Least privilege** — the app connects as non-superuser `app_user`; migrations run as a privileged role. Never change this.
5. **Tests mirror prod** — RLS suites run as the real `app_user`; live-Supabase suites hard-fail in CI rather than skip (`CI_REQUIRE_LIVE_DB=1`).
6. **TDD** — red → green → refactor; no production code without a failing test that demanded it.
7. **Build-vs-buy** — libraries for hard problems (Zod, CASL, Drizzle, @supabase/ssr, t3-env, rate-limiter-flexible); hand-rolled only for thin glue.
8. **Security rides with features** — gate each surface as it lands; never ship a surface ungated.

## 3. Security model — 14 layers, control → file

| # | Layer | Control | File(s) |
|---|---|---|---|
| 1 | Authentication | Supabase Auth (GoTrue), login-only | `app/_features/auth/actions.ts`, `app/login/page.tsx`, `lib/supabase/server.ts` |
| 2 | Session integrity | JWT cookie re-validated server-side every request; refreshed in proxy | `proxy.ts`, `lib/auth/session.ts` |
| 3 | Authorization (coarse) | CASL over contributor registry; fail-closed guard | `lib/permissions/{ability,guard}.ts`, `lib/registry/abilities.ts` |
| 4 | Data isolation (fine) | RLS, two identity paths (§4) | feature `schema.ts` slices + `drizzle/*.sql` |
| 5 | Least privilege | `app_user` runtime role (NOLOGIN in schema; LOGIN is env), privileged migrations | `lib/db/client.ts`, `drizzle/0000_*` |
| 6 | Input validation | Zod at actions + identity context | `app/_features/*/actions.ts`, `lib/db/with-user-context.ts` |
| 7 | Config & secrets | t3-env validated; `.env*` gitignored (committed `.env.test` = local demo keys only) | `lib/env/index.ts` |
| 8 | Transport/browser | Security headers + report-only CSP (enforce+nonce at deploy) | `lib/security-headers.ts`, `next.config.ts` |
| 9 | Abuse resistance | rate-limiter-flexible factory; feature-owned limiters | `lib/rate-limit.ts` (factory), feature `actions.ts` (instances) |
| 10 | Observability & audit | Pino (ops/denials); `sign_in_log` (facts, best-effort write) | `lib/logger.ts`, `lib/audit/record-sign-in.ts`, `app/_features/activity/` |
| 11 | Supply chain | Dependabot + `npm audit --audit-level=high` gate | `.github/dependabot.yml`, `.github/workflows/ci.yml` |
| 12 | Resilience | Stale-chunk auto-reload with cooldown | `app/_features/shell/ChunkErrorReloader.tsx` |
| 13 | Verification | 3-tier harness + boundary/confinement law + live hard-fail gate | `vitest*.mts`, `lib/verification/*`, `lib/db/__tests__/live-db.ts`, `playwright.config.ts` |
| 14 | Structure | Domain charter, mechanically enforced | `DOMAIN-CHARTER.md`, ESLint zones + scanner |

**Session cookie truth:** the Supabase JWT cookie is deliberately **not httpOnly** — the browser client must read it for Realtime channel auth. XSS exfiltration is answered at layer 8 (CSP enforce + nonce, a deploy-time task), not by pretending the cookie is httpOnly.

## 4. RLS model — two identity paths, never mixed (Charter Iron Rule 6)

- **App/Drizzle path** — connects AS `app_user`; identity from transaction-scoped GUCs `app.user_id` + `app.user_roles` (JSON-encoded array, checked with JSONB `@>` — a comma inside a role name can never splice the check), set only by `withUserContext` after fail-closed UUID validation. Tables: `sign_in_log`, `notes` (exemplar), all future feature tables.
- **Supabase client path** — connects as `authenticated`; identity from `auth.uid()`. Tables: `profiles` (self-read only), `realtime.messages` (channel gating).
- A policy written for one path is blind to the other. Put the policy on the path that actually queries the table.
- **Realtime is gated at the channel layer, never by row RLS on streamed tables** (ADR-0002, the 0021 scar): trigger → `realtime.broadcast_changes()` to `{domain}:{userId}` + `{domain}:all`; policy on `realtime.messages` locks subscribers to their own topic, owners additionally to `:all`. Templates: `lib/realtime/templates/`.
- Practical note (learned in construction): broadcast delivery begins at channel **join** — there is no replay. Rows created before the subscription completes arrive via the server render (`revalidatePath`), not the channel; E2E must await join before asserting live delivery.

## 5. The profiles write-lock

`profiles.role` is the role source of truth, so Supabase's default `GRANT ALL TO anon, authenticated` is revoked down to `SELECT` (migration `0001`). A logged-in user attempting `UPDATE profiles SET role='owner'` fails **loudly** (`permission denied`) rather than silently matching zero rows — pinned by a live integration test. Provisioning writes run as the privileged role. Owner-reads-all on `profiles` is deferred to F9 (a naive policy self-references `profiles` → infinite RLS recursion; F9 will use SECURITY DEFINER or a JWT claim).

## 6. Roadmap

| F | Feature | Status | Notes |
|---|---|---|---|
| F1–F5 | Foundation (db, auth, authz, RLS, least-privilege) | ✅ this branch | plus realtime plumbing, shell, harness — commits 1–33 |
| F6 | **Orders domain** | 🔜 next | copy `app/_features/notes/` per `CONTRIBUTING.md`; order_number sequence, 6-status state machine, line items, instance-level CASL |
| F7 | Realtime | ✅ | shipped as foundation plumbing (D7) + exemplar proof |
| F8 | Orders UI | 🔒 after F6 | kanban (drag = transition), list, line-item editor |
| F9 | Settings + invite provisioning | 🧊 | invite codes, owner role management, last-owner protection, `SUPABASE_SERVICE_ROLE_KEY` returns to t3-env, profiles owner-reads-all (non-recursive) |
| F10 | Business audit | 🧊 | `supa_audit` + audit-log view |
| F11 | Client-side CASL | 🧊 | `@casl/react` |
| F12 | Org model | 🧊 | `organizations`, `memberships`, `app.org_id` GUC, org-scoped RLS |

The `notes` exemplar is **disposable by contract** (Charter §4): delete it + its registry lines + its migrations and the foundation stays green — proven by rehearsal (ADR-0004) and enforced continuously (`lib/verification/feature-confinement.test.ts`).

## 7. Decision log

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-supabase-auth-not-keycloak.md) | Supabase Auth, not Keycloak — and why the option wasn't worth its price |
| [0002](docs/adr/0002-channel-layer-realtime.md) | Channel-layer realtime gating (the 0021 scar) |
| [0003](docs/adr/0003-login-only-provisioning.md) | Login-only; provisioning out-of-band until F9 |
| [0004](docs/adr/0004-fresh-derivation.md) | Fresh TDD derivation; deletion-rehearsal record |

## 8. Known follow-ups (quality-review minors, deliberately deferred)

1. Wrap `getSessionUser` in React `cache()` — dedupe the per-render double resolution (layout + page + guard).
2. `signOutAction` logs nothing on GoTrue failure — add `logger.warn` for operator symmetry.
3. LoginForm error region: render the `aria-live` paragraph persistently (announce reliability).
4. Boundary scanner hardening: multi-dot basenames (`nav.client.ts`) and `require()` form.
5. `e2e/global-setup`: assert the critical env vars resolve to expected test values (guards the `.env.local` ⊂ `.env.test` invariant); consider pinning `webServer.env` explicitly.
6. ALTER ROLE password interpolation in global-setup: escape or document trust.
7. At deploy: CSP enforce + nonce, Redis rate-limit store, HSTS becomes effective, managed secrets.
