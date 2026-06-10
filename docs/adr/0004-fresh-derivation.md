# ADR-0004: clean-rewrite-2 is a fresh TDD derivation, not a copy

**Status:** Accepted
**Date:** 2026-06-09

## Context

The predecessor branch `clean-rewrite` (144 commits, HEAD `96f0480`) reached a strong end-state — security-audited (0 critical/high findings) with ~91 tests — but its history is unusable as a foundation narrative: ~57 of those commits are the Keycloak adoption-and-removal arc (ADR-0001), plus early backtracks (RLS and Pino removed then re-added, lockfile thrash, CI target ping-pong). The owner's requirements for the successor: a purely linear history, every commit green, genuine test-driven development — explicitly **not** copied code wearing a test-first costume. Re-staging audited files with ceremonial red observation was considered and rejected (2026-06-09): tests written against existing implementations prove failure power, not design.

## Decision

`clean-rewrite-2` is derived fresh, from the shared root commit `bd8da074`, in 33 planned commits. `clean-rewrite` serves three roles, none of which is "source":

1. **Decision record** — its converged choices (this ADR set, the Domain Charter).
2. **Behavioral specification** — what its ~91 tests prove, distilled into per-commit checklists (`CLEAN-REWRITE-2-BUILD.md`) before construction began, so the old branch stays closed while code is written.
3. **Platform notes** — hard-won quirks (auth/realtime schema guards, GoTrue seeding mechanics, the 0021 scar) recorded as facts, not transcribed as code.

Every production-code commit follows strict red→green→refactor micro-cycles. Exceptions: configuration, docs, and test infrastructure (TDD-exempt classes); brand assets and prose documents may be carried over directly.

## Consequences

- Authorship is real: any behavioral divergence from the old branch is intentional and recorded (e.g. stricter `LOG_LEVEL` enum, `canAccessRoute` stub dropped, sign-in recorder extracted to the audit domain).
- The audit lives on `clean-rewrite` (kept as the reference branch, never deleted); `clean-rewrite-2`'s equivalent assurance is behavior parity — the §5 acceptance audit walks the old suite's behavior inventory against the new suite.
- Construction quality gates: lint + typecheck + unit from commit 4, integration from commit 8, live-Supabase from commit 13, E2E from commit 23.

## Deletion-rehearsal record

**Date:** 2026-06-10 · **Base:** `clean-rewrite-2` @ `5bc576c` · **Where:** a throwaway
`git worktree` (`../polaris-rehearsal`, detached), `npm ci` fresh — the trunk was
never touched.

To prove the `notes` exemplar is the *disposable* feature the Domain Charter §4
claims, it was deleted whole and the foundation re-gated. Deleted: `app/_features/notes/`,
`app/(dashboard)/notes/`, `e2e/notes.spec.ts`, `e2e/realtime-notes.spec.ts`, migrations
`0003_*`/`0004_*` (+ their `drizzle/meta` snapshots and `_journal.json` entries). Edited
back to a no-feature state: the three composition roots (`lib/registry/{abilities,nav,schema}.ts`),
`e2e/global-setup.ts` (TRUNCATE → `sign_in_log` only), and two exemplar-coupled
verification controls — `lib/permissions/ability.test.ts` (the registry-default
assertions reverted to the activity-only registry; `create Note` folded back into the
"unregistered subject fails closed" check) and `lib/db/__tests__/migrations.integration.test.ts`
(its M3 `notes` describe-block removed, since that block is migration-content verification
that ships and dies with the migrations).

**Gates, feature present → feature gone:**

| Gate | Before | After |
| --- | --- | --- |
| `npm run lint` | pass | pass |
| `npx tsc --noEmit` | pass | pass |
| `npm test` (unit) | 109 / 30 files | 96 / 25 files |
| `npm run test:integration` | 34 / 8 files | 20 / 5 files |
| `npm run test:e2e` | 17 | 12 |

The drops are exactly the deleted suites: unit −13 (the 5 notes unit files: NotesLive,
use-notes-realtime, nav, permissions, actions = 2+2+2+3+4); integration −14 (the 3 notes
integration files = 4+5+2, plus the migrations M3 block = 3); e2e −5 (notes.spec ×3 +
realtime-notes.spec ×2). Nothing else moved.

**Surprises / findings:**
- *No foundation breakage.* Every remaining gate was green with the feature gone —
  the composition roots absorbed the removal as single deleted lines, exactly as designed.
- *Two `notes` strings legitimately survive.* After the full deletion, a tree-wide
  scan for `notes` (any case) returned ONLY `lib/realtime/topics.test.ts` and
  `lib/realtime/use-topic.test.tsx`. These exercise the *generic* realtime primitives
  (`topicFor`/`topicAll`/`useTopic`) using `'notes'`/`'notes:u1'` as an arbitrary example
  domain; they are not exemplar references and were untouched by the rehearsal. They are
  recorded as known generic fixtures on the continuous confinement test's allowlist
  (`lib/verification/feature-confinement.test.ts`) so the rehearsal and the test agree.
- *One transient integration flake.* On the first full integration run,
  `with-user-context.integration.test.ts` failed; it passed in isolation and on the
  immediate full re-run — Docker/testcontainer resource contention under `workers`, not a
  deletion regression (consistent with the known dev-DB quirks).
- *`drizzle/meta/*` is JSON, hence outside the confinement scan's ts/tsx/sql/yml scope;*
  it is allowlisted for the record but never actually visited by the scanner.

The scratch worktree was removed (`git worktree remove --force`); trunk stayed at `5bc576c`.
