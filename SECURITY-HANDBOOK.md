# Polaris — Security Handbook (the layers you build on)

This is the **security companion** to `IAM-FOUNDATION-PROJECT.md`. The IAM brief tells you
*what to build*; this tells you *what "secure" already means here* — the full 14-layer
model, the mechanics (with diagrams), the threat model, and the checklist every PR answers.
Read it once, keep it open, and check your work against §6 on every PR.

> **Relationship to the IAM brief.** `IAM-FOUNDATION-PROJECT.md` §1–§6 is the condensed
> foundation; this document is the long form of the same model with the diagrams and the
> control→file map. Where the two overlap, they agree by design. **You extend the
> *app/Drizzle path* with a new `app.org_id` GUC — you do not invent new security.**

---

## 1. The story (security-relevant)
Polaris is an internal **cold-chain logistics order tool on Supabase** — Supabase
Auth, Postgres, and Supabase Realtime for a collaborative live order kanban. A clean
rewrite hardened the foundation feature-by-feature (CASL, RLS, non-superuser `app_user`,
Zod boundaries, t3-env, rate limiting, security headers). Identity is **Supabase Auth**
(`@supabase/ssr`); realtime is **Supabase Realtime** (Broadcast-from-Database). There is
**no public self-registration** — accounts are provisioned out-of-band.

---

## 2. Principles & conventions (the spine)
A foundation is "secure" because **every layer is addressed** and these hold **across all
of them**. Every decision traces to one of these — you don't invent security, you plug in.

| # | Principle | Concrete convention(s) in Polaris |
|---|-----------|-----------------------------------|
| 1 | **Fail closed** — deny by default | `withPermission` throws without a session; an invalid identity never reaches the DB. Your `withOrgContext` throws for a non-member. |
| 2 | **Defense in depth** — ≥2 layers, no single point of trust | CASL **and** RLS; route-guard **and** data-layer guards. **RLS = ownership/tenancy by default; role-based RLS only as a deliberate "last line of defense" on PII tables** (e.g. `sign_in_log`). **Streamed data is scoped at the channel layer** — per-owner broadcast topics + a `realtime.messages` policy (`auth.uid()`) — because Supabase Realtime can't honor the app's `app.user_id` GUC; tables keep ownership RLS for the app/Drizzle path. |
| 3 | **Validate at every trust boundary** | Zod at input/claims/env/events/headers: `.parse` (fail-closed) for identity/env, `safeParse` (degrade) where resilience matters. |
| 4 | **Least privilege** | App connects as non-superuser **`app_user`** (no `BYPASSRLS`, not table owner); migrations use a separate privileged role. **Never change this.** |
| 5 | **Tests mirror prod** | Non-superuser everywhere; RLS test harness under `app_user`; fresh-clone CI. A superuser test would bypass RLS and hide bugs. |
| 6 | **Test-first (TDD)** | Failing test before code; watch it fail → minimal code → watch it pass → commit. No production code without a red test that demanded it. |
| 7 | **Build-vs-buy discipline** | Libraries for hard problems (Zod, CASL, Drizzle, `@supabase/ssr`, t3-env, rate-limiter-flexible); hand-rolled only for thin app glue (guards/wrappers). |
| 8 | **Security rides with features** | Gate the surface as it lands — don't pre-harden things that don't exist yet, and never ship a surface ungated. |

**Other locked-in rules:** CASL = "can this role do this action", RLS = "which rows" ·
roles **`owner`/`member`** (system) and **`org_admin`/`org_member`** (org) · env via
**t3-env** · **Pino** for ops/denials, `sign_in_log` for successful logins · `auth.uid()`
RLS on Supabase-read tables (`profiles`, `realtime.messages`); `app.user_id` GUC RLS on the
app/Drizzle path (`orders`, `sign_in_log`) · no secrets in code (`.env*` gitignored) ·
**roles are JSON-encoded** into role GUCs (`@> '["owner"]'`), never comma-joined.

---

## 3. The secure-foundation model — 14 layers
A coherent full-stack foundation addresses all of these. **There are no empty rows.**
The ones the IAM project touches are in **bold**.

| # | Layer (what *good* looks like) | Polaris realization | Status |
|---|---|---|---|
| 1 | **Authentication** — delegate to a managed auth service | Supabase Auth (GoTrue) via `@supabase/ssr`; app-hosted login (no public registration); `getSessionUser` resolver | ✅ |
| 2 | **Session integrity** — signed, validated | Supabase JWT in httpOnly cookies, verified by `@supabase/ssr`; refreshed in `proxy.ts`; role from `profiles` | ✅ |
| 3 | **Authorization (coarse) — CASL** — roles/actions, fail-closed, logged | CASL `withPermission` (requires session, throws, Pino denial log). **You add `defineOrgAbilityFor`.** | ✅ |
| 4 | **Data isolation (fine) — RLS** — which rows, at the DB | RLS, two paths: app/Drizzle via `app.user_id` GUC; Supabase/`auth.uid()`. **You add `app.org_id` org-scoping.** | ✅ |
| 5 | **Least-privilege data access — `app_user`** | Non-superuser `app_user`; migrations privileged. **Never grant `BYPASSRLS`.** | ✅ |
| 6 | **Input / trust-boundary validation — Zod** | Zod at identity context, login input, env. **You `.parse` orgId/role enums.** | ✅ |
| 7 | **Configuration & secrets** | **t3-env** (validated, edge-safe, server/client guard); managed secrets → deploy | ✅ / 🔒 deploy |
| 8 | **Transport & browser hardening** | Security headers + report-only CSP; CSP-enforce+nonce + TLS → deploy | ✅ / 🔒 deploy |
| 9 | **Abuse resistance** | **rate-limiter-flexible** on writes; Supabase Auth rate-limited login; Redis → scale | ✅ / 🔒 deploy |
| 10 | **Observability & audit** | Pino (ops/denials); `sign_in_log`; `supa_audit` later | ✅ / 🔒 |
| 11 | **Supply chain** | Dependabot + `npm audit` CI gate | ✅ |
| 12 | **Resilience / recovery** | Stale-chunk auto-reload; chunk retention → deploy | ✅ / 🔒 deploy |
| 13 | **Verification — TDD + RLS harness** | TDD; unit + integration + E2E; fresh-clone CI; non-superuser RLS harness | ✅ |
| 14 | **Structure / maintainability** | Feature folders; `lib/` grouped (auth/ supabase/ env/ db/ permissions/) | ✅ |

You will mostly live in **Authorization (3)**, **Data isolation (4)**, **Input validation
(6)**, **Verification (13)**, and **Structure (14)**.

---

## 4. Security mechanics

### Threat model & trust boundaries
**Defend against:** unauthenticated access · cross-user / **cross-org** row access ·
privilege escalation (role-string injection via the GUC) · crashes from malformed
input/claims/env · framework fingerprint · write flooding · known-vulnerable deps.
**Trust (don't re-implement):** Supabase Auth/GoTrue (identity, credentials, password
policy, rate-limited login) · `@supabase/ssr` JWT verification (a forged session cookie
fails before our code) · host/network/TLS (deploy).

```mermaid
graph TD
  subgraph Untrusted["UNTRUSTED — browser / network"]
    B["Browser"]
  end
  subgraph EdgeRT["EDGE runtime — proxy.ts"]
    P["Route guard: refresh Supabase session, unauth to /login"]
  end
  subgraph NodeRT["NODE runtime — server actions / components"]
    SA["Server actions + pages"]
    GS["getSessionUser: Supabase user + profiles.role"]
    G["withPermission: CASL, fail-closed"]
    RL["withRateLimit"]
    UC["withUserContext / withOrgContext: sets identity + org GUCs"]
  end
  subgraph DB["Postgres — connects as app_user, non-superuser"]
    RLS["RLS: orders + sign_in_log via app.user_id GUC; org scope via app.org_id; profiles + realtime.messages via auth.uid"]
  end
  GT["Supabase Auth / GoTrue — TRUST BOUNDARY"]
  B --> P --> SA
  SA --> GS --> G --> RL --> UC --> RLS
  SA -. signInWithPassword server-side .-> GT
  GT -. JWT session cookie .-> SA
  SA -. Set-Cookie .-> B
```

### Authentication (Supabase Auth)
Login is **app-hosted** (`/login` → `signInAction` → `signInWithPassword`); the session is a
Supabase JWT in httpOnly cookies, refreshed in `proxy.ts` and verified by `@supabase/ssr`.
`userId` = `auth.users.id`; the app **role** comes from the `profiles` table (not a JWT
claim). **No registration in the app at all** — accounts are created out-of-band (Supabase
Studio/CLI: an `auth.users` user **and** a matching `profiles` row).

### Authorization & data access — the defense-in-depth stack
Both layers must pass. The IAM proof (`IAM 11`) shows the DB layer stands **alone**: even if
app code forces `app.org_id` to an org the user isn't in, RLS still returns zero rows.

```mermaid
flowchart TD
  R["createOrder request"] --> PG{"EDGE: authenticated?"}
  PG -->|no| RD["redirect to /login"]
  PG -->|yes| WP{"withPermission: session present AND CASL allows?"}
  WP -->|no userId| NA["throw Not authenticated (fail-closed)"]
  WP -->|denied| NAuth["throw Not authorized + Pino warn"]
  WP -->|allowed| WO{"withOrgContext: is caller a member of this org?"}
  WO -->|no| NM["throw / no GUC set (fail-closed)"]
  WO -->|yes| WR{"withRateLimit: under limit?"}
  WR -->|no| TM["throw Rate limit exceeded"]
  WR -->|yes| UC["set app.user_id + app.user_roles + app.org_id GUCs; tx as app_user"]
  UC --> RLS{"RLS: org_id = app.org_id AND ownership/role?"}
  RLS -->|deny| Z["blocked / 0 rows"]
  RLS -->|allow| OK["insert order"]
```

### RLS model — two identity paths
The app/Drizzle path connects as **`app_user`** and identifies via the **`app.user_id`
GUC** (set by `withUserContext`); org scope comes from the **`app.org_id` GUC** (set by your
`withOrgContext`). The Supabase-client path (auth/role reads) and Supabase Realtime identify
via **`auth.uid()`** as the **`authenticated`** role. **A policy written for one path is
blind to the other** — put the policy on the path that actually queries the table.

```mermaid
graph TD
  subgraph appPath["app_user / Drizzle path — app.user_id + app.org_id GUCs"]
    orders["orders — OWNERSHIP + ORG: created_by = app.user_id OR owner-role, scoped by org_id = app.org_id"]
    orgs["organizations / memberships — ORG membership (what you build)"]
    signinlog["sign_in_log — ROLE: owner-only read (PII)"]
  end
  subgraph supaPath["authenticated path — auth.uid()"]
    profiles["profiles — self-read: id = auth.uid()"]
    rtmsg["realtime.messages — channel auth: topic = orders:auth.uid() OR (orders:all AND owner)"]
  end
  GUC["withUserContext/withOrgContext set app.user_id + app.user_roles + app.org_id"] --> orders
  GUC --> orgs
  GUC --> signinlog
  JWT["Supabase session JWT → auth.uid()"] --> profiles
  JWT --> rtmsg
```
Roles in `app.user_roles` are **JSON-encoded** (`@> '["owner"]'`), never comma-joined — a
role name can't collide with a delimiter (escalation fix). **Everything the IAM project
builds (`organizations`, `memberships`, `orders.org_id`) lives on the APP PATH.**

### Input validation (Zod) — boundary table
| Boundary | Validates | Mode | Location |
|---|---|---|---|
| Identity context | `userId` UUID, `roles` string[] | `.parse` | `lib/db/with-user-context.ts` |
| **Org context** | `orgId` UUID, org `role` enum | `.parse` | `lib/db/with-org-context.ts` *(you build)* |
| Login input | `email`, `password` | `safeParse` | `app/_features/auth/actions.ts` |
| Server + client env | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*` | t3-env | `lib/env/index.ts` |

### Headers, rate limiting, supply chain, logging
- **Headers** (`next.config.ts`): `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  HSTS, `Permissions-Policy`, no `X-Powered-By`; **CSP report-only** (enforce+nonce → deploy).
- **Rate limiting**: rate-limiter-flexible `RateLimiterMemory` behind
  `withRateLimit(limiter, key, fn)`; writes are limited per user; → Redis at scale.
- **Supply chain**: `npm audit --audit-level=high` CI gate + Dependabot.
- **Logging**: Pino (ops/denials); `sign_in_log` (successful logins).

---

## 5. The two role axes (IAM-specific)
- **System role** — `profiles.role` (`owner`/`member`), platform-wide, **already exists**.
- **Org role** — `memberships.role` (`org_admin`/`org_member`), authority *inside one org*,
  **what you build**. A user can be `org_admin` of A and `org_member` of B at once.

CASL answers "can this *org role* do this action" (`defineOrgAbilityFor`); RLS answers
"which rows belong to *this org*" (`org_id = current_setting('app.org_id')::uuid`).

---

## 6. Adding a new feature — security checklist (THE gate — every PR answers this)
Run every feature through this. **It is the 14-layer model expressed as questions.**

```mermaid
flowchart TD
  F["New feature"] --> Q1{"New DB table with user/tenant data?"}
  Q1 -->|yes| R1["Enable RLS + ownership/org policy; grant app_user; migration; integration test proving ANOTHER tenant gets 0 rows"]
  Q1 -->|PII / admin table| R1b["ALSO role-based RLS as last-line-of-defense (see sign_in_log)"]
  F --> Q2{"New server action?"}
  Q2 -->|reads user data| R2["withPermission(ctx => …) + withUserContext/withOrgContext + CASL read rule"]
  Q2 -->|writes| R2b["ALSO withRateLimit; CASL create/transition rule"]
  F --> Q3{"Accepts user input?"}
  Q3 -->|yes| R3["Zod .parse() on inputs (incl. orgId / role enums) BEFORE the work"]
  F --> Q4{"Consumes external data? (API / webhook / claim)"}
  Q4 -->|yes| R4["Zod safeParse at the boundary; fail-closed or degrade"]
  F --> Q5{"New env var?"}
  Q5 -->|server / service key| R5["lib/env/index.ts — server{}"]
  Q5 -->|client / NEXT_PUBLIC_| R5b["lib/env/index.ts — client{}"]
  F --> Q6{"New realtime feed or external connection?"}
  Q6 -->|realtime| R6["broadcast trigger → per-owner topic + realtime.messages channel policy (NOT ownership RLS on the streamed table)"]
  F --> Q7{"Acts on a specific record the user may not own?"}
  Q7 -->|yes| R7["pass a CASL subject INSTANCE (instance-level authz) — not RLS alone"]
  F --> Q8{"Touches secrets / deploy config?"}
  Q8 -->|yes| R8["managed secrets only; defer to chore/prod-hardening"]
```

**Always:** TDD (failing test first); for anything touching RLS, an integration test under
`app_user` (harness in `lib/db/__tests__/`). **If a table or action is tenant-scoped and
there is no test where another tenant gets zero rows / a thrown denial — it is not done.**

---

## 7. Control → file map (where each layer lives — copy these, don't reinvent)
| Control | File(s) |
|--------|---------|
| Edge session refresh + route guard | `proxy.ts`, `lib/permissions/routes.ts` |
| Supabase clients (cookie-bound / browser) | `lib/supabase/server.ts`, `lib/supabase/browser.ts` |
| Sign-in / sign-out actions (+ `sign_in_log` write) — **no registration** | `app/_features/auth/actions.ts` |
| Identity resolver (user + `profiles.role`) | `lib/auth/session.ts` (`getSessionUser`) |
| App authorization (CASL) | `lib/permissions/guard.ts`, `lib/permissions/ability.ts` |
| Identity → DB context + RLS GUCs | `lib/db/with-user-context.ts` |
| **Org context + `app.org_id` GUC (you build)** | `lib/db/with-org-context.ts` |
| Schema + RLS policies (incl. `profiles`, `realtime.messages`) | `lib/db/schema.ts`, `drizzle/*.sql` |
| Realtime broadcast trigger | `drizzle/0009_orders_broadcast_trigger.sql` |
| Non-superuser connection (never touch) | `lib/db/client.ts` |
| Env validation (t3-env; server + client) | `lib/env/index.ts` |
| Rate limiting | `lib/rate-limit.ts` |
| Security headers / CSP | `next.config.ts` |
| RLS integration tests (every table) | `lib/db/__tests__/*-rls.integration.test.ts` |
| Dependency monitoring | `.github/dependabot.yml`, `.github/workflows/ci.yml` |
| Logging | `lib/logger.ts` |

---

## Bottom line
Layers 1–6, 11, 13, 14 are fully built; 7–10, 12 sit at their pre-deploy maximum. The IAM
project's job is to **extend the app/Drizzle path with org scope (`app.org_id`)** without
poking a hole in any layer. The **§6 checklist is the filter** — every feature plugs into
known layers up front, and a tenant-scoped surface without an isolation test is not done.
