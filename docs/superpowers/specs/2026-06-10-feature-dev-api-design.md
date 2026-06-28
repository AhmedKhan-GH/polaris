# Feature Dev API via `index.ts` (Iron Rule 8) — Design

**Date:** 2026-06-10
**Status:** Approved design, pre-implementation
**Companion:** will become ADR-0005 + Charter §1 Iron Rule 8

## What "API" means here

**Developer API (import surface), not a web API.** This design controls which
symbols other code in this repo may `import` from a feature folder. It exists
only at build time. No HTTP endpoints, routes, or runtime behavior change in
any way. The term "dev API" is used throughout to keep this unambiguous.

## Problem

The boundary law (Iron Rules 1–3) mechanically forbids foundation→feature and
feature→feature imports, but says nothing about *how deep* a sanctioned
consumer may reach. Route pages currently import feature internals directly
(`@/app/_features/notes/actions`, `../auth/actions`), so:

- A feature has no declared surface — nothing distinguishes its intended
  exports from its plumbing (`use-notes-realtime.ts` is importable by anyone).
- Refactoring inside a feature can silently break outsiders.
- The boundary scanner (`lib/verification/import-boundaries.test.ts`) does not
  scan `app/` route files at all (`SCAN_ROOTS = ['lib', 'app/_features']`), so
  page→internals edges are invisible to the law today.

## Decision

Every feature under `app/_features/<name>/` exposes its dev API through
`<name>/index.ts`. Outsiders import the bare feature folder
(`@/app/_features/<name>`) and nothing deeper. Anything not exported from the
index is private to the feature.

This becomes **Iron Rule 8** in `CHARTER.md` §1, enforced as **Rule D**
in `import-boundaries.test.ts`.

### Two seams, two consumers — manifests stay out of the index

| Seam | File(s) | Consumer | Rule |
|---|---|---|---|
| Dev API | `index.ts` | pages/layouts (and the one sanctioned cross-feature edge) | Rule D (new) |
| Manifests | `schema.ts` / `permissions.ts` / `nav.ts` | `lib/registry/*` only | Rule C (unchanged) |

The index must NOT re-export manifests. This keeps registries on their
existing manifest-only law and avoids the Next.js barrel hazard (a barrel
mixing drizzle schema with `'use client'` components would pull server code
into client bundles).

### Index contents (verified against every current outsider import)

All exports are named; no default exports exist in any feature.

| Feature | `index.ts` exports | Stays private |
|---|---|---|
| notes | `NotesLive`, `getNotes`, `createNote` | `use-notes-realtime.ts` (`useNotesRealtime`, `NoteRowView`), `NoteRow` |
| auth | `LoginForm`, `signOutAction` | `signInAction` (internal to LoginForm) |
| shell | `PageHeader`, `DashboardNav`, `ChunkErrorReloader` | — |
| landing | `LandingPage` | — |
| activity | `getSignInLog` | — |

Server/client mixing is safe today: every outsider importer is a server
page/layout, and `'use server'` action re-exports are importable from any
context. **Recorded constraint:** a future *client* component must not import
a feature index that exports plain server-only functions (e.g. activity's
`getSignInLog`); if that need arises, the feature splits its index (e.g.
`index.ts` + a client-safe entry) in its own PR.

### Rule D mechanics (in the existing test idiom)

- Broaden `SCAN_ROOTS` from `['lib', 'app/_features']` to `['lib', 'app']`.
  Route files become importers; `buildEdges()` already de-dupes the overlap.
- Violation predicate: importer not under `app/_features/<name>/` AND resolved
  target strictly deeper than the bare `app/_features/<name>` folder.
  The resolver never appends `/index.ts`, so a bare-folder target IS the
  index import.
- Exemptions: intra-feature imports; registry→manifest edges (Rule C's
  territory, keyed on importer under `lib/registry/` + manifest basename).
- The sanctioned shell→auth edge narrows automatically: `PageHeader` imports
  `../auth` (auth's index) instead of `../auth/actions`.
- Fourth `it()` block in `describe('import-boundary law')`, same
  filter-to-violations + `formatViolations('D', …)` style.

### Verified-safe collisions

- `feature-confinement.test.ts`: adding `notes/index.ts` is covered by the
  `isUnder(p, 'app/_features/notes')` allowlist prefix; the notes route page
  is explicitly allowlisted. No other scanned file may newly mention "notes".
- ESLint editor mirror (`eslint.config.mjs`): encodes only Rule 1 today
  (despite the charter's claim of "rules 1–3" — corrected below). Rule D is
  NOT added to ESLint; per the config's own comment, the comprehensive law
  lives in the verification test, ESLint is fast IDE feedback only.

## Doc amendments (same PR, per charter change-control line 9)

1. `CHARTER.md` §1: new Iron Rule 8 — "Features expose a dev API.
   Outsiders import `app/_features/<name>` (the index) only; everything not
   exported there is private. Manifests remain registry-only (Rule 3)."
2. `CHARTER.md` §1 enforcement clause: correct to "ESLint zones encode
   rule 1; the D9 verification test encodes rules 1–3 and 8."
3. `CHARTER.md` §4: add `index.ts` dev-API seam to the exemplar list.
4. `CHARTER.md` §5 step 2: rename list gains `index.ts`.
5. `CONTRIBUTING.md` step 2: "your `index.ts` is your dev API — outsiders
   import nothing else."
6. `HANDBOOK.md` (root) §7 decision log: ADR-0005 row.
7. New `docs/adr/0005-feature-dev-api.md` (template format: Status/Date +
   Context/Decision/Consequences).

`docs/HANDBOOK.md` is stale/non-canonical (root HANDBOOK is canonical per
README) — not amended.

## Commit sequence (branch `feature/dev-api-rule`, rebase + ff-merge)

1. `docs(adr): ADR-0005 — features expose a dev API via index.ts`
   (+ all charter amendments; law and ADR travel together).
2. **Red checkpoint (not a commit):** write Rule D + `SCAN_ROOTS` broadening;
   run it; confirm red listing exactly the page→internals imports. Stays
   uncommitted until green.
3. `feat(notes): dev API via index.ts` — exemplar first; rewire
   `app/(dashboard)/notes/page.tsx`.
4. `feat(auth): dev API via index.ts` — rewire `app/login/page.tsx`.
5. `feat(shell): dev API via index.ts` — rewire `app/layout.tsx`, both
   layouts, dashboard page, `app/page.tsx`; `PageHeader` → `../auth`.
6. `feat(landing): dev API via index.ts` + `feat(activity): dev API via
   index.ts` — rewire `app/page.tsx` landing import, activity page.
7. `test(boundaries): Rule D — outsiders import only a feature's index`
   (now green; closes the red→green story).
8. `docs: CONTRIBUTING playbook + HANDBOOK decision log for ADR-0005`.

Gates per commit: `npm run lint && npx tsc --noEmit && npm test`; integration
+ e2e before merge; `SKIP_ENV_VALIDATION=1 npm run build` (components
changed). No schema, migration, or runtime behavior changes.

## Out of scope (each a separate future conversation)

- Splitting the `shell` grab-bag into foundation UI.
- Tier-3 workspace packages with `package.json` `exports` (resolver-level
  enforcement). The index files written here become those entry points if
  that move ever happens.
- Extending the ESLint editor mirror to Rule D.
- Manifest shapes for `auth`/`landing` (foundation surfaces, not business
  features — correct as-is).

## Extension story (the point of all this)

- **New feature:** `cp -r app/_features/notes app/_features/<name>` now brings
  `index.ts`; rename its exports alongside table/topics. Your route page
  imports `@/app/_features/<name>`. Deep imports fail the build with file +
  specifier named.
- **Publishing a symbol:** add one export line to your feature's `index.ts`,
  justified by the consumer's failing test. Feature-owned file → always a
  feature PR, never a charter conversation.
- **Cross-feature wants:** still forbidden (Iron Rule 2 untouched); charter
  conversation only.
- **Privacy guarantee:** anything not in the index is provably unreferenced
  by outsiders — safe to rename, split, or delete.
