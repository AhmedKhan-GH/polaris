# ADR-0010: Test altitude — TDD rigor scales to stakes × logic

**Status:** Proposed
**Date:** 2026-07-01

## Context

Four reinforcing authorities mandate test-first with no written exception: the Charter
(D11 "TDD per commit… no production code without a failing test that demanded it"; §5 step 3),
`CONTRIBUTING.md` #3 ("TDD, no exceptions"), and the coding agent's global rule ("Always follow
TDD for feature code"). None carve out a domain where the discipline does not pay. The Charter's
own enforcement ethos — *"Enforcement is mechanical, not cultural"* (§1) — is correct and
load-bearing for import boundaries and RLS, where a wrong policy is a breach. But it is a meme,
and under a blanket mandate it generalized from security into aesthetics.

The costs are real and in-tree:

- **Change-detector tests.** `app/_features/notes/identity.ts` is a word/char counter where
  `charCount = (t) => t.length`; `identity.test.ts` asserts `charCount('hello') === 5`. It can
  only fail when someone changes a constant on purpose — it tests the language, not our code.
  (The file is also mis-housed: a word counter named `identity`.)
- **Design tokens tested as behavior.** `app/globals.contrast.test.ts` re-implements WCAG
  luminance/contrast math to assert that hex values in a stylesheet clear 4.5:1, and cites
  "Charter D11" to justify itself; `app/_features/brand/theme.test.ts` asserts CSS hex equals
  `lib/branding` hex. On a theming branch, editing a colour now means first satisfying a
  colour-math test.
- **Uniform tier cost.** 101 test files vs 77 source files in `app/`; three tiers
  (unit + integration + E2E, `CONTRIBUTING` #8) mandated for every feature regardless of risk.

The blanket rule optimizes the security spine (correct) by taxing everything else at the same
rate (waste, and friction against the very work — theming, copy, layout — it least protects).

## Decision

TDD rigor is **not uniform**; it scales to **stakes × logic**. Before writing a test, two
questions set the mode:

1. **Stakes** — if this is silently wrong in production, what breaks? A breach / data loss /
   money error, vs. a user-visible glitch, vs. something cosmetic.
2. **Logic** — does it branch, transform, or enforce a rule? Or is it a constant, a design
   token, or a one-line wrapper over the standard library?

Three tiers follow:

- **Tier A — iron TDD, every warranted tier.** Security and data-integrity domains
  (Charter D1–D7, D9) and pure high-stakes logic (permissions, money, pricing, order
  transitions, RLS). **Unchanged from today:** test-first, red → green → commit, unit +
  integration/RLS + E2E. A defect here is a breach or corruption.
- **Tier B — test the behavior; tier as warranted.** User-visible logic with low blast radius
  (nav-visibility filtering, form-error display, preference-toggle persistence). Test that it
  branches correctly. Test-first or test-after both acceptable; usually one tier suffices. No
  tautologies.
- **Tier C — not a red-green subject.** Aesthetics, config, and tautologies: colours, copy,
  spacing, CSS tokens, stdlib wrappers. Reviewed by eye. A single CI *guard* is permitted where
  regression risk is real (e.g. a11y contrast), but it is a guard — written once, never a
  per-edit driver, never authored test-first per token.

**The decisive filter:** *would this test ever fail for a reason other than someone changing a
value on purpose?* If no, it is a change-detector — do not write it. When genuinely unsure which
tier applies, ask; do not reflexively test.

The full rationale lives here. The Charter and `CONTRIBUTING.md` **cite** this ADR rather than
restating it (Charter: "one fact, one home").

## Consequences

- **Tier A is untouched.** The security/data spine keeps its full three-tier proof; this ADR
  narrows nothing that guards a boundary. It does not touch the Iron Rules (1–8) or their
  mechanical enforcement (the import-boundary / feature-confinement tests, D9) — those are not
  TDD conventions and stay exactly as strict.
- **Charter and CONTRIBUTING amended in this same change.** Charter D11 "Provides" and §5 step 3
  now scope TDD by altitude and cite this ADR; `CONTRIBUTING` #3 and #8 likewise. Per the
  Charter's change-control (§ header), the rule change and its ADR ship together.
- **No enforcement config to update.** TDD-per-commit is a cultural rule, never mechanically
  enforced — so unlike an Iron-Rule change, there is no ESLint zone or scanner to amend.
- **Cleanup backlog** (separate, reviewable commits, not part of this governance change): delete
  the `charCount` tautology test; rename/re-house `identity.ts` (word-count ≠ identity);
  reclassify `globals.contrast.test.ts` from per-edit driver to a single CI guard; keep
  `theme.test.ts` only if the CSS↔branding weld is a real regression risk, else drop.
- **To revisit:** if a Tier-C guard repeatedly catches regressions that eye review misses,
  promote that specific check. The default — aesthetics are not red-green subjects — stands.
