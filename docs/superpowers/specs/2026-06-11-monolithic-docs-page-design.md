# Monolithic docs page with TOC sidebar — design

**Date:** 2026-06-11
**Status:** Approved (brainstormed with Ahmed)
**Branch:** feature/dev-api-rule

## Problem

The HTML docs are split across `docs/html/add-a-feature.html` (the guide) and
five generated standalone pages in `docs/html/features/`, stitched together
with a pill nav. Page-to-page navigation is disliked; industry-leading docs
(Stripe, Tailwind) use a single page with a TOC sidebar. Additionally, every
feature contributor should be able to maintain their own feature's docs.

## Decision

One monolithic page, `docs/html/add-a-feature.html`, with a fixed TOC
sidebar. The `docs/html/features/` directory, the per-feature standalone
pages, the in-place tab control (`feattabs`/`featpanels`), and the pill nav
are all deleted. Contributor-authored docs live **only in doc comments in
each feature's `index.ts`** — no new files. The generator projects those
comments (plus the machine-derived tables) into the page; nobody hand-edits
generated content.

## Content model: index.ts is the docs source

A feature contributor maintains docs by editing `app/_features/<feature>/index.ts`:

1. **Module-level `/** ... */` comment** — rendered in full (paragraphs, not
   just the first sentence) as the feature section's intro prose.
2. **Per-export doc comments** — a `/** ... */` immediately above an
   `export { x } from './y'` statement becomes the **Description** column of
   that feature's dev API table. Multiple names in one export statement share
   the comment.

Exports without a comment get an empty description cell — valid, not an error.

## Page layout

Industry-standard docs shell:

- **Fixed left sidebar (~240px)** holding the TOC; main content column at the
  current prose width. Sidebar scrolls independently when long.
- **TOC entries:** the guide sections (Mental model, Dev API contract,
  Playbook, Evolving a dev API, Gates) plus a **Features** group with one
  sub-item per feature. Click → smooth-scroll to anchor.
- **Scroll-spy:** small `IntersectionObserver` script highlights the TOC item
  for the section in view. With JS disabled the TOC is a plain working anchor
  list — no content is hidden by JS.
- **Narrow screens:** sidebar collapses to a top-of-page anchor list; content
  goes full-width.

## Per-feature sections

Rendered inline where the tabs are today (between "Dev API contract" and
"The playbook"), one section per feature:

1. Intro prose — full module doc comment from `index.ts`.
2. **Dev API table** — Export / Kind / Description / Source module. Kind
   classification unchanged (`exportKind`).
3. **Used by** — unchanged (`findImporters`).
4. **Other seams** — manifests + private internals, unchanged.
5. **The contract, verbatim** — highlighted `index.ts` source inside a
   `<details>` collapsed by default, so the page stays scannable as the
   feature count grows.

At-a-glance stat cards from the standalone pages are dropped — they were
page-filler; the tables carry the same facts.

## Generator changes (`scripts/generate-feature-surfaces.mjs`)

**New/extended pure functions (TDD — failing test first, in
`generate-feature-surfaces.test.ts`):**

- `parseIndexDocLead` → replaced by `parseIndexDoc`, returning the **full**
  module doc comment as an array of paragraph strings (its only caller, the
  standalone page renderer, is being deleted).
- `parseIndexExports` → also captures an optional doc comment preceding each
  export statement; entries gain a `description` field.
- `renderSurfacesHtml` → renders full feature sections (prose, table with
  Description column, used-by, seams, `<details>` contract) instead of tabs.
- New `renderTocHtml(sections, features)` → the sidebar TOC fragment.

**Deletions:** `renderFeaturePageHtml`, the standalone-page write loop, the
feature-pages `mkdirSync`, `renderFeatureNav`/`navItems` (pill nav), and the
tab CSS/JS in the guide page. `highlightTs` stays (used by the inline
contract).

**Injection:** two marker pairs in `add-a-feature.html` — the existing
feature-surfaces pair, plus a new pair for the TOC's feature sub-items.

**Output:** exactly one file. `docs/html/features/` is removed from the repo.

## Hand-authored page changes

`add-a-feature.html` (outside the generated markers) gets the docs shell:
sidebar grid layout, TOC markup for the static sections, scroll-spy script,
removal of tab CSS/JS and `enableFeatureTabs`. Existing tokens/base CSS
design system unchanged.

## Testing

- Unit tests for every parser/renderer change (existing zero-dependency test
  style, TDD).
- Regenerate (`npm run docs:surfaces`) and verify idempotence: second run
  produces no diff.
- `/design` render→screenshot→critique loop once at the end as the polish
  pass — not for structure.

## Out of scope

- Any change to feature `index.ts` files beyond contributors later adding
  doc comments (the generator must handle today's comment-less exports).
- Markdown-file-based docs (`README.md` per feature) — explicitly rejected
  in favor of doc comments only.
- Multi-page output of any kind.
