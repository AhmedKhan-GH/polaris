# Contributing to Polaris

Read `CHARTER.md` first (the law), then `HANDBOOK.md` (the system). This file is the *how*: adding a feature, passing the gates, landing the branch.

## Adding a feature (the playbook — Charter §5)

The `notes` exemplar (`app/_features/notes/`) is the living template. It exercises every seam: schema slice, ability contributor, guarded actions with a feature-owned rate limiter, realtime delivery, nav registration, all three test tiers.

1. **Branch:** `feature/<name>` off the trunk.
2. **Copy the exemplar:** `cp -r app/_features/notes app/_features/<name>` — then rename: table, CASL subject (singular, e.g. `'Order'`), topics (`<name>:{userId}` / `<name>:all`), limiter key (`<name>:create:<userId>`), policy names (`<name>_owner_or_self`, `<name>_read_own_topic`), trigger (`broadcast_<name>_change` / `<name>_broadcast`) — and the exports in `index.ts`, your **dev API** (Iron Rule 8 / ADR-0005): outsiders import `@/app/_features/<name>` and nothing deeper; whatever you don't export there is private. Never re-export the manifests through it.
3. **TDD scaled to altitude (ADR-0010):** behavior that branches, transforms, or enforces a rule — and anything security/data/money-bearing — starts as one failing test: red (for the right reason) → minimal green → refactor. A test that passes before its implementation lands belongs to an earlier commit or is redundant. Design tokens, copy, config, and one-line stdlib wrappers are *not* red-green subjects; never write a test whose only way to fail is a deliberately-changed constant. Unsure which tier? Ask, don't reflexively test.
4. **Schema:** table + `ENABLE RLS` in your `schema.ts` slice; policies/grants hand-written in the migration (`npm run db:generate`, then append with `--> statement-breakpoint`; `--custom` for triggers/realtime). Pick the correct identity path (Charter Iron Rule 6): app-path tables get GUC policies (`app.user_id` / `app.user_roles` JSONB `@>`), Supabase-path tables get `auth.uid()`. Guard Supabase-only DDL with `DO $$ IF EXISTS (schema 'auth'|'realtime')` so vanilla test containers stay happy.
5. **Register manifests** — the ONLY foundation files you touch: `lib/registry/abilities.ts`, `lib/registry/nav.ts`, `lib/registry/schema.ts`. Manifests are named `schema.ts` / `permissions.ts` / `nav.ts` (the scanner enforces this).
6. **Actions self-guard** (Iron Rule 5): `withPermission` → `withRateLimit` (your own `createRateLimiter` instance, in your folder) → Zod parse → `withUserContext`. `revalidatePath` only after the chain resolves.
7. **Realtime** only via the D7 templates (`lib/realtime/templates/` — README there). Never row-RLS a streamed table for delivery (ADR-0002).
8. **Tests at the tiers the risk warrants (ADR-0010):** Tier-A domains (security/data — auth, RLS, permissions, money) prove at all three — unit (mocked collaborators), integration (real `app_user` through `startRlsTestDb`/`withUserContext`; live-Supabase suites use the `liveDbGate` pattern), E2E journeys (seeded owner/member, `loginViaSupabase`). Lower-stakes behavior (Tier B) needs only the tier that actually exercises its logic; Tier-C work needs none.
9. **If you need to change `lib/**` outside the registries: stop.** That is a charter conversation requiring an ADR, not a feature PR.

## Gates (run what exists, every commit)

```
npm run lint && npx tsc --noEmit && npm test          # always
npm run test:integration                               # Docker required
npm run test:e2e                                       # local `supabase start` required
SKIP_ENV_VALIDATION=1 npm run build                    # when routes/components changed
```

Local Supabase: `supabase start -x studio,imgproxy,inbucket,edge-runtime,functions,vector,analytics,meta,storage`, then `npm run db:migrate` (uses `MIGRATE_DATABASE_URL`). Live suites self-skip without the stack — CI runs them with `CI_REQUIRE_LIVE_DB=1`, where skipping is a hard failure.

## Conventions

- **Commits:** Conventional Commits with scopes (`feat(orders): …`, `fix(rls): …`, `test(e2e): …`). Small, green, self-contained.
- **History:** linear trunk — rebase your branch onto the tip, then fast-forward merge. No merge commits, no squash: the red→green commit story IS the review artifact.
- **Dependencies:** enter at first use, in the commit whose failing test justifies them. After any dependency change: `rm -rf node_modules package-lock.json && npm install` (never patch the lockfile incrementally).
- **Env vars:** declared in `lib/env/index.ts` (t3-env) AND wired in `runtimeEnv`, in the commit that first consumes them. Secrets never in code; `.env.test` carries local demo keys only.
- **Branding:** tenant strings live in `lib/branding.ts` and nowhere else.
