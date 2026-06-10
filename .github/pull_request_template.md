## What

<!-- One paragraph: the behavior this PR adds/changes, in user terms. -->

## Checklist (Charter compliance — all boxes or an explanation)

- [ ] **TDD:** every production change was born from a failing test (red observed for the right reason, then green, then refactor).
- [ ] **Gates green:** lint, `tsc --noEmit`, unit, integration (Docker), E2E (where journeys changed), build.
- [ ] **No `lib/**` changes outside `lib/registry/*`** — or an ADR is included in this PR and the charter conversation happened first.
- [ ] **Migrations apply to BOTH targets:** vanilla Postgres (testcontainers) and live Supabase — Supabase-only DDL is schema-guarded.
- [ ] **Correct RLS identity path** per table (GUC path vs `auth.uid()` path — Charter Iron Rule 6).
- [ ] **Actions self-guard:** `withPermission` → limiter → Zod → `withUserContext` (Iron Rule 5).
- [ ] **No tenant strings outside `lib/branding.ts`.**
- [ ] **Realtime via D7 templates only;** no row-RLS delivery filtering (ADR-0002).
- [ ] **Dependencies** (if any) enter with the test that justifies them; lockfile regenerated from scratch.

## How verified

<!-- Paste the gate tail: test counts, e2e run, anything manual. -->
