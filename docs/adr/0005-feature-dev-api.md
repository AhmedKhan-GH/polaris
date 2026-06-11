# ADR-0005: Features expose a dev API via `index.ts`; outsiders import only the index

**Status:** Accepted
**Date:** 2026-06-10

## Context

The Iron Rules forbid foundation→feature and feature→feature imports, but say
nothing about how *deep* a sanctioned consumer may reach. Route pages imported
feature internals directly (`@/app/_features/notes/actions`,
`../auth/actions`), so a feature had no declared surface: nothing
distinguished its intended exports from its plumbing
(`use-notes-realtime.ts` was importable by anyone), and internal refactors
could silently break outsiders. The boundary scanner did not even see these
edges — its scan roots were `lib/` and `app/_features/`, so route files were
never collected as importers.

"Dev API" means the TypeScript import surface — a build-time contract between
developers. No HTTP endpoint, route, or runtime behavior is involved.

## Decision

Every feature under `app/_features/<name>/` exposes its dev API through
`<name>/index.ts`. Outsiders import the bare feature folder
(`@/app/_features/<name>`) and nothing deeper; anything not exported from the
index is private to the feature. This is Iron Rule 8 (Charter §1), enforced
as Rule D in `lib/verification/import-boundaries.test.ts`, whose scan roots
broaden to all of `app/` so route files become visible importers.

The index and the manifests are distinct seams that never mix: `index.ts`
serves pages/layouts (components, server actions); `schema.ts` /
`permissions.ts` / `nav.ts` serve `lib/registry/*` only (Rule 3, unchanged).
The index must not re-export manifests — re-exporting the Drizzle schema
through a barrel consumed by client-reachable code would leak server code
into client bundles.

Exemptions to Rule D: intra-feature imports, and registry→manifest edges.
The sanctioned shell→auth edge narrows to auth's index automatically.

## Consequences

- A new feature copied from the exemplar inherits a declared front door; deep
  imports fail the build with the offending file and specifier named.
- Publishing a symbol is one export line in a feature-owned file — a feature
  PR, never a charter conversation. Anything unexported is provably
  unreferenced by outsiders and safe to refactor.
- Constraint: a future *client* component must not import a feature index
  that exports plain server-only functions (e.g. activity's `getSignInLog`);
  such a feature splits its entry points in its own PR when the need arises.
- The ESLint editor mirror still encodes only Rule 1; the comprehensive law
  (rules 1–3, 8) lives in the verification test. The charter's enforcement
  clause is corrected accordingly in the same PR.
- These index files become `package.json` `exports` entries if features ever
  move to workspace packages (resolver-level enforcement); revisit then.
