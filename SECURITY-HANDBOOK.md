# Polaris Security Handbook

**Status:** living document — the **diagrams and per-mechanism detail** behind the security model.
The 14-layer overview and the control → file map live in [`HANDBOOK.md`](HANDBOOK.md) §3; the boundaries / Iron Rules in [`DOMAIN-CHARTER.md`](DOMAIN-CHARTER.md); the decisions in [`docs/adr/`](docs/adr/). This document holds the pictures. One fact, one home — where they overlap, the handbook's terse statement is authoritative.

---

## Threat model & trust boundaries

**Defend against:** unauthenticated access · cross-user row access · privilege escalation (role-string injection via the GUC) · crashes from malformed input/claims/env · framework fingerprint · write flooding · known-vulnerable deps.
**Trust (don't re-implement):** Supabase Auth/GoTrue (identity, credentials, password policy, rate-limited login) · `@supabase/ssr` JWT verification (a forged session cookie fails before our code) · host/network/TLS (deploy).

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
    UC["withUserContext: sets identity GUCs"]
  end
  subgraph DB["Postgres — connects as app_user, non-superuser"]
    RLS["RLS: orders + sign_in_log via app.* GUCs (user_id + user_roles); profiles + realtime.messages via auth.uid"]
  end
  GT["Supabase Auth / GoTrue — TRUST BOUNDARY"]
  B --> P --> SA
  SA --> GS --> G --> RL --> UC --> RLS
  SA -. signInWithPassword server-side .-> GT
  GT -. JWT session cookie .-> SA
  SA -. Set-Cookie .-> B
```

## Authentication (Supabase Auth)

Login is app-hosted (`/login` → `signInAction` → `signInWithPassword`); the session is a Supabase JWT in cookies — **not `httpOnly`** (the `@supabase/ssr` default, left in place deliberately), because the browser client must read the JWT for Realtime channel auth (XSS exfiltration is answered by CSP enforce+nonce at the transport layer, not by pretending the cookie is httpOnly — see `HANDBOOK.md` §3). The cookie is refreshed in `proxy.ts` and verified by `@supabase/ssr`. `userId` = `auth.users.id`; the app **role** comes from the `profiles` table (not a JWT claim). **No registration in the app** — accounts are provisioned out-of-band today (Supabase Studio/CLI: an `auth.users` user **and** a matching `profiles` row), via invite-code at F9, public sign-up at F14 (ADR-0003). Logout is a single `supabase.auth.signOut()` (no second SSO step — that was a Keycloak artifact).

```mermaid
sequenceDiagram
  actor U as User
  participant App as Polaris
  participant SA as Supabase Auth / GoTrue
  U->>App: visit /login, submit email + password (signInAction)
  App->>SA: signInWithPassword(email, password)
  SA-->>App: session (JWT) set as a session cookie (not httpOnly), or error
  App->>App: on success write sign_in_log best-effort, else return an inline error
  App-->>U: redirect to /dashboard, proxy refreshes the session each request
```

```mermaid
sequenceDiagram
  actor U as User
  participant App as Polaris
  participant SA as Supabase Auth / GoTrue
  U->>App: click Log out (signOutAction)
  App->>SA: supabase.auth.signOut()
  SA-->>App: clears the session cookie
  App-->>U: redirect to /
```

## Authorization & data access — the defense-in-depth stack

```mermaid
flowchart TD
  R["createOrder request"] --> PG{"EDGE: authenticated?"}
  PG -->|no| RD["redirect to /login"]
  PG -->|yes| WP{"withPermission: session present AND CASL allows?"}
  WP -->|no userId| NA["throw Not authenticated (fail-closed)"]
  WP -->|denied| NAuth["throw Not authorized + Pino warn"]
  WP -->|allowed, ctx = userId+roles| WR{"withRateLimit: under 30/min?"}
  WR -->|no| TM["throw Rate limit exceeded"]
  WR -->|yes| UC["withUserContext: set app.user_id + app.user_roles GUC; tx as app_user"]
  UC --> RLS{"RLS WITH CHECK: created_by = app.user_id (create-as-self)?"}
  RLS -->|deny| Z["blocked / 0 rows"]
  RLS -->|allow| OK["insert order"]
```

## RLS model — two identity paths

The app/Drizzle path connects as **`app_user`** and identifies via the **`app.user_id` GUC** (set by `withUserContext`). The Supabase-client path (auth/role reads) and **Supabase Realtime** identify via **`auth.uid()`** as the **`authenticated`** role. Tables carry policies for the path that reads them.

```mermaid
graph TD
  subgraph appPath["app_user / Drizzle path — app.user_id GUC"]
    orders["orders — READ open to all signed-in (temp: drizzle/0012, pending org-scoping); WRITE ownership: insert create-as-self, update own-draft OR owner/admin"]
    signinlog["sign_in_log — ROLE: owner-only read (PII); WITH CHECK true (signInAction logs every sign-in)"]
  end
  subgraph supaPath["authenticated path — auth.uid()"]
    profiles["profiles — self-read: id = auth.uid() (role source; owner-reads-all → F9)"]
    rtmsg["realtime.messages — channel auth (notes exemplar): topic = notes:auth.uid() OR (notes:all AND owner)"]
  end
  GUC["withUserContext sets app.user_id (UUID) + app.user_roles (JSON array)"] --> orders
  GUC --> signinlog
  JWT["Supabase session JWT → auth.uid()"] --> profiles
  JWT --> rtmsg
```

Roles in `app.user_roles` are **JSON-encoded** (`@> '["owner"]'`), never comma-joined — a role name can't collide with a delimiter (escalation fix).

**Live feed — the `notes` exemplar (orders not yet wired):** a `notes` trigger broadcasts each change to its owner's private topic (`notes:<created_by>` + `notes:all`); the `realtime.messages` policy gates each subscriber to their own topic — per-user realtime without the streamed table needing ownership RLS (the `drizzle/0021` scar, ADR-0002). An orders live feed would follow this exact pattern (templates in `lib/realtime/templates/`), but **no orders broadcast trigger exists today**.

**Orders read is currently open** (`drizzle/0012` `orders_read_all USING (true)`, with the CASL twin `can('read','Order')` unconditional): every signed-in `app_user` reads every order — a deliberate temporary simplification until org-scoping lands (see `docs/superpowers/specs/2026-06-26-orders-org-scoping-design.md`). Ownership today gates only **writes** (`orders_insert_self`, `orders_update_writer`).

## Input validation (Zod) — boundary table

| Boundary | Validates | Mode | Location |
|---|---|---|---|
| Identity context | `userId` UUID, `roles` string[] | `.parse` | `lib/db/with-user-context.ts` |
| Login input | `email`, `password` | `safeParse` | `app/_features/auth/actions.ts` |
| Server + client env | `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_*` (service-role key NOT in t3-env) | t3-env | `lib/env/index.ts` |

## Headers, rate limiting, supply chain, logging

- **Headers** (`lib/security-headers.ts`, attached via `next.config.ts`): `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS, `Permissions-Policy`, no `X-Powered-By`; **CSP report-only** (enforce+nonce → deploy).
- **Rate limiting**: rate-limiter-flexible `RateLimiterMemory` behind `withRateLimit(limiter, key, fn)`; `createOrder` 30/min/user; → Redis at scale.
- **Supply chain**: `npm audit --audit-level=high` CI gate + Dependabot.
- **Logging**: Pino (ops/denials); `sign_in_log` (successful logins). See [ADR-0006](docs/adr/0006-event-tracking-vs-operational-logging.md) for ops-logs vs the event table.

## Env validation (t3-env)

Env validation uses **t3-env** (`lib/env/index.ts`): `server` vars (`DATABASE_URL`, `LOG_LEVEL`) + `client` vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). **`SUPABASE_SERVICE_ROLE_KEY` is deliberately NOT in t3-env** — no in-app code uses it (registration was removed), and t3-env's `server` schema would require it at boot for a key the app never reads; its readers (E2E global-setup, `scripts/seed-dev.ts`, `scripts/create-user.ts`) take it from `process.env` directly. Re-add at F9 when in-app provisioning consumes it.

---

## Adding a new feature — security checklist

Run every feature through this. **It is the 14-layer model expressed as questions.**

```mermaid
flowchart TD
  F["New feature"] --> Q1{"New DB table with user/tenant data?"}
  Q1 -->|yes| R1["Enable RLS + ownership policy; grant app_user; migration; integration test (member cannot read others)"]
  Q1 -->|PII / admin table| R1b["ALSO role-based RLS as last-line-of-defense (see sign_in_log)"]
  F --> Q2{"New server action?"}
  Q2 -->|reads user data| R2["withPermission(ctx => …) + withUserContext + CASL read rule"]
  Q2 -->|writes| R2b["ALSO withRateLimit; CASL create/transition rule"]
  F --> Q3{"Accepts user input?"}
  Q3 -->|yes| R3["Zod .parse() on inputs BEFORE the work"]
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

**Always:** TDD (failing test first); for anything touching RLS, an integration test under `app_user` (harness in `lib/db/__tests__/`). This checklist is why new work **stops being whack-a-mole** — each feature plugs into known layers up front.
