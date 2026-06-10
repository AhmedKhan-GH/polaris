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

*Pending — appended at Task 30 (feature-confinement check): delete the `notes` exemplar + its registry lines + its migrations in a scratch worktree; the foundation must stay fully green. Result recorded here.*
