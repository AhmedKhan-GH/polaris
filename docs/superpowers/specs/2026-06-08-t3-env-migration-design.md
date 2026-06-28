# Feature: Migrate env validation to `@t3-oss/env-nextjs`

> **Status:** Proposed (spike-gated — see §4). **Branch:** `refactor/t3-env`.
> **Date:** 2026-06-08. **Type:** infrastructure refactor (behavior-preserving).
> Pairs with `docs/HANDBOOK.md` §6 (env validation) and the conventions in
> `docs/HANDBOOK.md`.

## 1. Goal

Replace our three hand-rolled env-validation files with **t3-env**
(`@t3-oss/env-nextjs`), the purpose-built library for Zod-validated environment
variables in Next.js. We currently reimplement, by hand, exactly what t3-env
does: Zod schemas, the **server/edge split**, explicit static refs for edge
inlining, and a **`SKIP_ENV_VALIDATION`** build escape. This is the one piece of
"from-scratch" code where a library is a clear net win (see the build-vs-buy
review, 2026-06-08).

**Non-goals:** changing *what* is validated, the values, or any runtime behavior.
Identical validation, fewer hand-maintained moving parts.

## 2. Current state (what we'd replace)

| File | Lines | Role |
|------|------|------|
| `lib/env.ts` | 17 | node: `DATABASE_URL`, `LOG_LEVEL`; dynamic `process.env` parse + SKIP |
| `lib/env-auth.ts` | 20 | node: `AUTH_KEYCLOAK_*` + `AUTH_SECRET`; dynamic parse + SKIP |
| `lib/keycloak-env-fields.ts` | 12 | shared field rules (so edge `auth.config` and node `env-auth` don't duplicate them) |
| `lib/auth.config.ts` (env part) | ~15 | **edge**: `AUTH_KEYCLOAK_*` validated from **explicit static refs** + SKIP (the edge can't run a dynamic `process.env` parse) |

The complexity we're paying for by hand: the **edge/node split** (the reason
`keycloak-env-fields.ts` exists and why `auth.config` parses static refs), and a
`SKIP_ENV_VALIDATION` branch repeated in each module.

## 3. What t3-env provides

`createEnv({ server, client, runtimeEnv, skipValidation, emptyStringAsUndefined })`:
- **Zod schemas** for `server` and `client` vars.
- **`runtimeEnv`** — you map each var to an **explicit `process.env.X`** (static
  refs). This is *exactly* the edge-inlinable pattern we hand-rolled in
  `auth.config` — so one config can serve edge and node.
- **`skipValidation`** — first-class build escape (our `SKIP_ENV_VALIDATION`).
- **server/client boundary** — throws if a `server` var is read in client code.
- **`emptyStringAsUndefined`** — treats `""` as missing (nice for our `min(1)`).

Sketch:

```ts
// lib/env.ts (proposed, single source)
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    LOG_LEVEL: z.string().optional(),
    AUTH_KEYCLOAK_ID: z.string().min(1),
    AUTH_KEYCLOAK_SECRET: z.string().min(1),
    AUTH_KEYCLOAK_ISSUER: z.string().url(),
    AUTH_SECRET: z.string().min(1),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    AUTH_KEYCLOAK_ID: process.env.AUTH_KEYCLOAK_ID,
    AUTH_KEYCLOAK_SECRET: process.env.AUTH_KEYCLOAK_SECRET,
    AUTH_KEYCLOAK_ISSUER: process.env.AUTH_KEYCLOAK_ISSUER,
    AUTH_SECRET: process.env.AUTH_SECRET,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
```

## 4. ⚠️ Spike gate — the one thing that must be verified FIRST

**Does a single `createEnv` work when imported from the EDGE `auth.config` (which
the `proxy` bundles)?** This is the whole reason our code is split. t3-env's
explicit `runtimeEnv` static refs *should* be edge-inlinable, but we must prove:

1. **Edge import works** — `proxy.ts` → `auth.config` → `env` builds and runs in
   the edge runtime (no "dynamic process.env" / "can't inline" failure).
2. **Build is green with `SKIP_ENV_VALIDATION`** (CI build sets it).
3. **t3-env treats edge middleware as server**, not client (so reading
   `AUTH_KEYCLOAK_*` there doesn't trip the server/client guard).

**If the spike fails (edge can't use a unified t3-env), abort the consolidation**
and keep the hand-rolled split — the dependency only earns its place if it
*removes* the edge complexity, not if we end up splitting around it anyway.

## 5. Open design decisions

1. **Consolidate to one file, or keep a conceptual split?**
   - Preferred: **one `lib/env.ts`** (t3-env) — collapses 3 files → 1.
   - Tension: a single `env` requires **all** vars whenever it's imported. Today
     `env-auth` is separate so **DB-only integration tests** (which import
     `db/client` → env) don't need auth vars. With one `env`, those tests must
     either set the auth vars or run with `skipValidation`.
   - Resolution: set **`SKIP_ENV_VALIDATION` in the test setup** (tests don't
     exercise env validation except the dedicated env test) — clean and matches
     how CI build already skips. Confirm no test *relies* on auth-var validation.
2. **`MIGRATE_DATABASE_URL`** stays out of the app env (it's drizzle-kit/CLI only,
   read in `drizzle.config.ts`). Leave as-is.
3. **`logger.ts`/`db/client.ts`/`auth.config.ts`/`signOutAction`** import the new
   `env` (`env.DATABASE_URL`, `env.AUTH_KEYCLOAK_ISSUER`, etc.).

## 6. Migration plan (TDD, single branch `refactor/t3-env`)

1. **Spike commit** — add `@t3-oss/env-nextjs`; **regen the lockfile** (nuke
   `node_modules` + lockfile, reinstall — house rule); stand up the unified `env`;
   wire `db/client` + `logger`; **verify the §4 edge gate** (build + `npm run dev`
   + E2E hit the proxy). *If the gate fails, stop here and discard.*
2. **Wire auth** — point `auth.config` (provider) + `signOutAction` at `env`;
   delete `env-auth.ts` + `keycloak-env-fields.ts`.
3. **Tests** — replace `env.test.ts` / `env-auth.test.ts` with tests for the
   t3-env module (valid parses; missing required throws; `skipValidation` skips).
   Add `SKIP_ENV_VALIDATION` to test setup if §5.1 requires.
4. **Verify** — typecheck · lint · unit · integration · build (SKIP) · E2E, all
   green. Confirm behavior is byte-identical (same vars required, same failures).
5. **Docs** — update `HANDBOOK.md` §2/§6 + §14 (env now one file, t3-env).

Refactor discipline: behavior is preserved, so the **existing tests are the net**;
the only *new* tests are the env-module tests that replace the old ones.

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| **Edge incompatibility** (the big one) | §4 spike gate *before* deleting anything; abort if it fails |
| Integration tests now need auth vars | `SKIP_ENV_VALIDATION` in test setup (§5.1) |
| Another dependency (supply-chain surface) | Justified: removes the fiddly hand-rolled edge/SKIP logic we got subtly wrong once; t3-env is widely used + now covered by our Dependabot/`npm audit` gate |
| t3-env server/client guard friction | No `NEXT_PUBLIC_`/client env in Polaris → minimal; verify in spike |
| Lockfile drift | Full lockfile regen per house rule |

## 8. Success criteria / rollback

**Success:** 3 env files → 1; edge proxy + auth flow work (E2E green); build green
under `SKIP_ENV_VALIDATION`; identical validation behavior; net LOC down.
**Rollback:** the branch is self-contained — if the §4 gate fails or anything
regresses, drop the branch; `clean-rewrite` is untouched.

## 9. Out of scope

Rate-limiting → `rate-limiter-flexible` (deferred to scale) and security headers →
`nosecone`/`next-safe` (marginal; revisit at CSP-enforce). This branch is **env
only.**
