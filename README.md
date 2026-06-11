# Polaris

[![CI](https://github.com/AhmedKhan-GH/polaris/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AhmedKhan-GH/polaris/actions/workflows/ci.yml)

Polaris is an internal **cold-chain logistics order-management platform**. What lives on `main` today is its **foundation**: a deliberately product-free core — identity, authorization, row-level data isolation, realtime delivery, observability, abuse resistance, and a three-tier verification harness — onto which the product domains are added as self-contained features.

## What this is, right now

A security-first foundation, born test-first and governed by a written constitution:

- **Every production line came from a failing test.** The branch is a from-scratch TDD derivation (34 linear commits, each green at its gate) of an audited predecessor whose code was used as *specification, never as source* — see [ADR-0004](docs/adr/0004-fresh-derivation.md).
- **Authorization is layered and fail-closed.** CASL gates actions, Postgres RLS gates rows (two identity paths, never mixed), realtime is gated at the channel layer, and the app runs as a non-superuser DB role — the 14-layer model is mapped control-by-control in [HANDBOOK.md §3](HANDBOOK.md).
- **Boundaries are law, not convention.** Features plug into the foundation through three registry files and nothing else; the foundation never imports features. Both rules are machine-enforced by tests that fail the build on violation — they caught real violations during construction, including one introduced by the build's own orchestrator.
- **One disposable exemplar feature ships with it:** `notes` (`app/_features/notes/`) exercises every seam — schema + RLS, ability contribution, guarded/rate-limited actions, live realtime delivery, nav, all three test tiers — and is the template every real feature copies. Deleting it leaves the foundation 100% green: proven by rehearsal, enforced continuously.
- **Verified:** 110 unit / 34 integration / 17 end-to-end tests; the live-Supabase RLS suites are *required* to execute in CI (skipping is a hard failure); fresh-clone CI runs the entire stack — including a real Supabase instance — on every push.

## What it aims to be

**Near term** (roadmap detail in [HANDBOOK.md §6](HANDBOOK.md)): the operational tool for the business —

- **F6 Orders domain** — order numbers, a six-status state machine, line items
- **F8 Live orders kanban** — drag-to-transition, realtime across users
- **F9 Settings & invite provisioning** — the first in-app account flow (until then: no registration, by design — [ADR-0003](docs/adr/0003-login-only-provisioning.md))
- **F10 Business audit trail** · **F11 client-side permissions** · **F12 Organizations** — application-level multi-tenancy in our own Postgres

**Long view** (aspirational): a customer-facing logistics platform — self-service shipper onboarding, shipment tracking with cold-chain telemetry, billing, and a public API. The foundation's security posture exists so that opening the doors later is an extension, not a rewrite.

## How it's built

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind 4 |
| Platform | Supabase — Auth, Postgres, Realtime ([ADR-0001](docs/adr/0001-supabase-auth-not-keycloak.md): permanent, Keycloak rejected with rationale) |
| Data | Drizzle ORM + drizzle-kit as the sole migration authority; non-superuser `app_user` runtime role |
| AuthZ | CASL composed from feature contributors + RLS with GUC identity; fail-closed guard on every server action |
| Validation / config | Zod everywhere; t3-env |
| Tests | Vitest (unit + Testcontainers integration), Playwright E2E against a live local Supabase stack |

## Reading order

1. **[HANDBOOK.md](HANDBOOK.md)** — the system: security model, RLS paths, roadmap, known follow-ups
2. **[DOMAIN-CHARTER.md](DOMAIN-CHARTER.md)** — the law: domains, Iron Rules, composition roots, the disposable-exemplar contract
3. **[CONTRIBUTING.md](CONTRIBUTING.md)** — the practice: the feature playbook (copy `notes`, rename, register three lines), gates, conventions
4. **[docs/adr/](docs/adr/)** — the why: four founding decisions

## Quickstart

Prerequisites: Node 24 (`.nvmrc`), Docker, the Supabase CLI.

```bash
npm ci
npx supabase start -x studio,imgproxy,inbucket,edge-runtime,functions,vector,analytics,meta,storage
cp .env.test .env.local   # local demo keys + dev DB URLs (never production values)
npm run db:setup          # migrations + app_user login + demo users; self-verifying, idempotent
npm run dev               # http://localhost:3000 — log in: owner@example.com / test-password-123
```

Broke your local data? `npm run db:reset` wipes the database and re-provisions it end to end (schema, `app_user` login, demo users) — never run a bare `supabase db reset`, which leaves the DB unprovisioned.

There is no sign-up page (by design). `db:setup` already seeded two demo accounts — `owner@example.com` and `member@example.com`, both with password `test-password-123`. For anything else:

- **Custom user:** create it via the GoTrue admin API, then give it a role in `profiles` as a privileged DB role (the write-lock prevents any logged-in user from touching roles — that's the point):

```bash
export $(grep SUPABASE_SERVICE_ROLE_KEY .env.test)
curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"choose-one","email_confirm":true}'
docker exec supabase_db_polaris psql -U postgres -d postgres -c \
  "insert into public.profiles (id, email, role) values ('<id from response>', 'you@example.com', 'owner')
   on conflict (id) do update set role = excluded.role;"
```

Verification gates (run what your change touches — full list and rules in [CONTRIBUTING.md](CONTRIBUTING.md)):

```bash
npm run lint && npx tsc --noEmit && npm test
npm run test:integration   # Docker
npm run test:e2e           # local supabase stack
```

## Lineage

`main` is the rebuilt foundation (June 2026). The history it learned from is preserved: `clean-rewrite` (the audited predecessor that serves as its behavioral specification), and `main-legacy` / `main-archive` (the pre-rewrite product app — mined for orders-domain behavior when F6/F8 land).
