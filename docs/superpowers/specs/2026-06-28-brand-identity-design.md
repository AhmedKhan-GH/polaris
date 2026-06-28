# Brand & Identity page — Design

> **Status:** proposed (2026-06-28). A read-only dashboard page that renders the Zee Foods
> logo lockup, its **corrected** proportions, and the canonical color palette — every value
> read from `lib/branding.ts`, the **D8** brand-token home, so the page can never disagree
> with what the app actually ships. It **extends an existing foundation module** and adds one
> read-only business feature; **no ADR** is required (no domain boundary, iron rule, or
> contract signature changes — contrast the time-preferences slice, which did need one).

## What it is

A single internal reference — **"Brand & Identity"** — surfacing the canonical brand for
everyone who touches it (web development, sales, marketing, design): the logo lockup, the
proportions you can derive from it, and the three brand colors. It reads entirely from
`lib/branding.ts` and stores nothing of its own. "Management" today means editing that one
file — a reviewed change that then propagates everywhere; in-app editing is a later slice.

## Why this shape (foundation tokens + feature page)

The brand *tokens* are already a foundation concern. `lib/branding.ts` is owned by **D8 —
Shell & Routing** ("product name, logos, copy — tenant strings appear nowhere else"), and
D8's law forbids *tenant branding inside components*. So the tokens stay in `branding.ts`;
this work only **extends** them (colors, the lockup asset, the source geometry).

The *page* is an ordinary read-only **business feature** (`app/_features/brand/`, the
notes/products lineage) that consumes those foundation tokens. **Iron Rule 2** is satisfied:
it imports foundation, never another feature. This mirrors the time-preferences split —
foundation data + a thin feature surface — but with no DB, no realtime, and no write path.

## The emblem correction (the one real subtlety)

`Asset 3222.svg`'s emblem is an **ellipse** — `rx 16.11`, `ry 15.52` — i.e. **1.038 : 1**,
wider than tall by exactly `rx / ry`. That is the signature of a non-uniform resize that
stretched the *entire* lockup horizontally (it also explains why the wordmark sits slightly
wider than the standalone `zeefoods_letters.svg`). The brand emblem is a true circle; the
squish is a long-standing defect to **fix**, not document. The fix is one global transform,
not per-element surgery:

- **scaleX = ry / rx ≈ 0.9634**, applied to the whole artwork → the emblem becomes a true
  **1 : 1 circle** (`r = 15.52`), the green mark stays aligned inside its white ground, and
  the wordmark un-stretches in step (back toward the standalone letters' proportions).
- Canonical proportions therefore derive from the **corrected** geometry: **lockup 2.80 : 1**
  (107.43 × 38.39), **emblem 1 : 1**. The source's defective **2.90 : 1 / 1.04 : 1** are
  shown only as a "corrected from" footnote.

The correction is applied in two *derived* places, both from the single source measurement
held in `branding.ts`: the served asset (`public/zeefoods_lockup.svg` — the artwork wrapped
in `<g transform="scale(0.9634 1)">`, viewBox width → 107.43) and the displayed ratios (the
pure function below). One source, one factor, two derivations.

## Architecture (by domain)

- **D8 — tokens (`lib/branding.ts`, extend):**
  - `colors` — `blue #00447c` (primary: wordmark, headings), `green #67953f` (accent: emblem
    mark), `white #ffffff` (emblem ground / negative space). Names: "Zee Foods Blue",
    "Zee Foods Green", "White". Each token is `{ name, hex, role }`.
  - `lockup` — `{ src: '/zeefoods_lockup.svg', alt: 'Zee Foods', width: 224, height: 80 }`,
    the same shape as the existing `logo` / `wordmark` entries (corrected ≈ 2.80 : 1).
  - `logoGeometry` — the **source** measurements straight from Asset 3222:
    `viewBox { width: 111.51, height: 38.39 }`, `emblem { rx: 16.11, ry: 15.52 }`. Kept as
    data so the ratio is *derived*, never hand-asserted.
- **D8 — consumption (`app/globals.css` `@theme`):** declare `--color-brand-blue/green/white`
  from those hexes, so the app can style brand surfaces by **name** (`bg-brand-blue`) and
  never hardcode a hex — the only way to honor D8's "never tenant branding inside components"
  for color. A unit test **welds** the two literals (the CSS values must equal
  `branding.colors`); drift is a red build. This is the "single source that propagates", made
  mechanical.
- **Feature — `app/_features/brand/`:**
  - `ratios.ts` — pure `computeLogoRatios(geometry)` → `{ lockupAspect, emblemAspect (= 1),
    emblemWidthPct, emblemHeightPct, correction: { sourceEmblemAspect, scaleX } }`. No deps;
    the `lib/datetime.ts` formatter pattern, kept inside the feature because only this page
    needs it (promote to `lib/` if that ever changes).
  - `ColorSwatch.tsx`, `LogoRatios.tsx` — presentational; brand data arrives **via props**,
    never imported-and-hardcoded. Unit-tested with RTL (the `ProductListRow` pattern).
  - `nav.ts` — `{ label: 'Brand', href: '/brand' }`, **ungated** (an internal reference for
    everyone, exactly like `products`).
  - `index.ts` — the dev API (**Iron Rule 8**): exports only what the route page consumes.
  - **No `permissions.ts`, no `schema.ts`:** no actions and no table, so there is nothing to
    guard or to register. The `(dashboard)` authed gate is the only guard the MVP needs; a
    `Brand` CASL subject arrives with in-app editing, not before.
- **Route — `app/(dashboard)/brand/page.tsx` (the feature's composition seam):** thin async
  server component; reads `branding` + `computeLogoRatios(branding.logoGeometry)` and composes
  the lockup (plain `<img>` — the repo's deliberate choice for unoptimizable static SVGs) with
  the swatches and the ratio table.
- **Composition root:** add `brandNav` to `lib/registry/nav.ts`. The ability and schema
  registries are untouched (nothing to contribute).
- **Asset:** transform root `Asset 3222.svg` → corrected `public/zeefoods_lockup.svg` (per the
  correction above); remove the root copy.

## Build slices (TDD, red → green → commit)

1. **Ratios** — `app/_features/brand/ratios.ts` + unit tests **first**: `emblemAspect === 1`,
   `lockupAspect ≈ 2.80`, `correction.scaleX ≈ 0.9634`, `correction.sourceEmblemAspect ≈
   1.038`, and the two coverage percentages (≈ 28.9% wide, ≈ 80.9% tall). Pure, no deps.
2. **Tokens** — extend `lib/branding.ts` with `colors`, `lockup`, `logoGeometry`; a unit test
   pins the canonical hexes and the geometry shape.
3. **Corrected asset** — create `public/zeefoods_lockup.svg` (global `scaleX`, circular
   emblem); remove root `Asset 3222.svg`. A unit test asserts the circle invariant
   `scaleX × emblem.rx === emblem.ry`.
4. **@theme + weld** — add the three `--color-brand-*` vars to `globals.css`; a unit test
   asserts the CSS literals equal `branding.colors` (the propagation guarantee).
5. **Components** — `ColorSwatch` + `LogoRatios` with RTL tests (swatch renders name/hex/role;
   ratios render the corrected values plus the "corrected from" note).
6. **Page + nav + E2E** — the route page, `brandNav` registered; a light `e2e/brand.spec.ts`:
   the nav link is visible to a signed-in user, the lockup `<img>` is present, and the three
   hexes plus "2.80 : 1" / "1 : 1" are shown.

## Decisions

1. **Extend `lib/branding.ts`, not a new `lib/brand/`** — `branding.ts` is already the single
   brand-token home (D8); a second home would re-create the exact drift this page exists to kill.
2. **Asset 3222's hexes are canonical** (`#00447c` / `#67953f`, user-confirmed); the two
   `/public` SVGs (`#00447b` / `#66953f`) are off by one digit and get reconciled to match in
   a tracked fast-follow, not this slice.
3. **Global un-stretch, not an emblem-only fix** — one factor corrects the emblem *and* the
   wordmark coherently; fixing only the ground circle would leave the green mark misaligned.
4. **Ratios derived, not stored** — store the source geometry and compute; "calculated from
   the SVG" stays literally true and the correction is auditable.
5. **`@theme` + weld test over inline hexes** — lets components reference brand color by name;
   the test makes `branding.ts` the *enforced* source of truth for the app's styling.
6. **No ADR, no DB, no authz subject, no realtime** — a read-only display of existing
   foundation data; the authed shell gate is sufficient.

## Out of scope (future slices)

Clear-space rules, typography, tone/voice, downloadable variant kits (emblem / wordmark /
lockup, light / dark, raster), reconciling the `/public` SVGs to the canonical hexes, and
in-app editing of tokens.
