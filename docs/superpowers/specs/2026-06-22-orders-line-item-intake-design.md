# Orders & Line-Item Intake — Design Spec

- **Date:** 2026-06-22
- **Status:** Implemented (as-built; see "As-built revisions" below)
- **Base branch:** `main` (now includes the products catalog, PR #179)
- **Target branch:** `feature/orders-rebuild` (PR #180); fuzzy SKU search stacked on `feature/fuzzy-sku-search` (PR #182)

## As-built revisions (2026-06-22)

Two design points changed during implementation. This spec is updated to match
what shipped; the reasoning is recorded here.

1. **Line model — duplicate-SKU lines + `line_number` (was: one row per
   product).** The original lean model enforced `unique(order_id, product_id)`
   and merged a re-added product into the existing line. That denied a real
   intake need: the SAME product on multiple lines at different negotiated
   prices. Shipped instead — `unique(order_id, line_number)` (no product-unique),
   each `addLine` APPENDS a line at `max(line_number)+1`, and the detail table
   shows a `#` column. Migration `0009` (drops the old constraint, backfills
   `line_number`, then adds the new one).
2. **Fuzzy SKU search intake (was: native fields only — decision #4 reversed).**
   Decision #4 had locked "native form fields only, no fuzzy." That was reversed
   by request: the product picker is now a fuzzy, search-as-you-type combobox
   (`fuzzysort`, Obsidian-style) matching SKU *or* name, both fields always
   shown. Native focus/tab still applies elsewhere; macros, keybinds, a command
   bar, and MCP remain deferred. Lives in the stacked PR #182; dummy SKUs seed
   via `npm run db:seed-products`.

Smaller things shipped alongside (not part of the core design): the `update
Order` CASL grant (line edits and transitions need it — its absence crashed
cancel), an empty-product guard on Add line (the combobox is `required`; the
action no-ops on an empty `productId`), semantic status chips, and a global Back
button (shell chrome, a separate concern from orders).

## Goal

Build the **orders feature with line-item intake** on `main`, atop the
products catalog. Entry is a line-item form with a **fuzzy SKU-search product
picker** (informed by Ian Keilman's work, not porting his macro editor); add a
minimal industry-standard **order state machine**, and a three-level **role
model**.

Internal tool only: **call-center contractors** enter & confirm orders;
**office admins** process them; the **owner** oversees everything. No
customer-facing accounts and no organizations (explicitly out of scope).

## Sources we're integrating

Three inputs feed this feature:

1. **`main` (the base)** — products catalog: `products(id, name, sku UNIQUE,
   price_cents, retired, created_at)`, read-all / owner-write (RLS + CASL twin).
2. **`feature/orders-intake` (structural template, unmerged)** — already has a
   clean, on-playbook orders header + line-items: per-feature `index.ts` dev
   API, `withUserContext` RLS, CASL registry, rate-limited guarded actions, RLS
   twins, E2E. We **re-derive from it (TDD)** rather than merge, because its
   authz model (owned-container) is changing (status + admin read-all).
3. **`origin/order-line-items` — Ian Keilman's intake UX** — `LineItemEditor.tsx`
   (~400 lines), `entryMacro.ts` (keyboard macros), `ShortcutTooltip`,
   `LineItemSummary`, `OrderLineItemStats`, `summary.ts`. Built on an older
   Supabase / `lib/`-structure lineage, so it is **ported onto main's patterns,
   not merged.**

## Out of scope (deferred, by decision)

- **Fulfillment & billing sub-status axes** (the two-axis model from research).
  Core status only for now; the design leaves a clean seam to plug them in.
- Organizations / multi-tenancy / customer accounts.
- Realtime line-item sync (Ian had a realtime spec) — deferred.
- **Rapid-entry enhancements** — keyboard macros (Ian's `entryMacro`), custom
  keybinds, a command bar, an MCP server. All sit on the same server actions;
  add later if a real need appears. (Fuzzy SKU search WAS added — see As-built
  revisions — but this macro/keybind/command-bar/MCP layer stays deferred.)
- **Richer line model** — per-line `unit`, fractional quantity, and line `notes`
  (from Ian's model) stay deferred. SHIPPED instead: `line_number` ordering and
  duplicate-SKU lines (same product across lines, each its own snapshot price) —
  see As-built revisions. Integer qty and snapshot price stand.

## Order state machine (LOCKED)

States: `draft`, `submitted`, `processing`, `completed`, `cancelled`.

```
draft ⇄ submitted → processing → completed
  └────────┴───────────┘ → cancelled (terminal)
```

| Transition | Who | Notes |
|---|---|---|
| `draft → submitted` | member (own) · admin/owner (any) | the "confirm"; locks the *member* out of editing |
| `submitted → draft` (recall) | member (own) · admin/owner (any) — only while `submitted` | **the one reversal** — member self-corrects; admin/owner "bounce back to contractor" |
| `submitted → processing` | admin/owner | office picks it up |
| `processing → completed` | admin/owner | terminal |
| `draft\|submitted\|processing → cancelled` | admin/owner (any) · member (own, while `draft`/`submitted`) | terminal; redo path = duplicate (future) |

Terminal states: `completed`, `cancelled`. There is no un-cancel; the future
"redo" path is **duplicate** (matches Shopify/NetSuite/Odoo).

**Invariant to bake in now:** a transition becomes irreversible once it emits a
real-world side effect. The core emits none yet, so the whole forward chain is
reversible-in-principle but we only *expose* the `submitted → draft` recall. When
the billing/fulfillment axes arrive, `reopen` auto-restricts per this rule
(matches NetSuite "reopen only if not billed or fulfilled", Shopify "can't
unfulfill once shipped").

Labels chosen per industry norm: `processing` (WooCommerce/Amazon) for the
office work stage; `submitted`/`draft` for intake. Reversibility & terminal
semantics grounded in NetSuite, Shopify, and Odoo.

## Role model

`profiles.role` is free-text (`DEFAULT 'member'`, no CHECK), mirrored into the
`app.user_roles` GUC and CASL `identity.roles`. Adding a role needs **no
constraint migration**.

| Persona | Role key | Reads | Writes / transitions |
|---|---|---|---|
| Company owner / superuser | `owner` (exists) | all orders | create; **edit any non-terminal order**; all transitions; manage catalog + users |
| Back-office processor | `admin` (**new**) | all orders | create; **edit any non-terminal order**; all transitions (submit/recall/process/complete/cancel); **not** catalog (owner-only) |
| Call-center contractor / order-taker | `member` (exists) — UI label "Agent" | **own orders only** | create; edit **own `draft`**; submit/recall own; cancel own |

**Decision (resolved):** the new back-office role is **`admin`**. The contractor
stays **`member`** (UI-labelled "Agent") — no cross-feature rename. Only `admin`
is added. (`admin` is unused on `main`; `owner`/`member` are the only existing
roles.)

## Data model

**`orders`** (re-derived from `feature/orders-intake`, + status):

```
id              uuid pk default gen_random_uuid()
order_number    bigint not null unique default nextval('orders_order_number_seq')  -- seq START 100000; 6-digit min-width display
created_by      uuid not null            -- the contractor who entered it (no FK; vanilla-PG safe)
status          text not null default 'draft'   -- CHECK in (draft,submitted,processing,completed,cancelled)
status_updated_at timestamptz not null default now()
created_at      timestamptz not null default now()
-- deferred: customer link

-- Sequence `orders_order_number_seq` created in the migration (START 100000),
-- like the RLS. Stored as bigint so it never hard-caps; the UI pads to a
-- 6-digit min width. Gaps (from rolled-back inserts) are expected and fine.
```

**`order_lines`** (re-derived, + **price snapshot** + **`line_number`**):

```
id            uuid pk
order_id      uuid not null references orders(id) on delete cascade
line_number   integer not null check (> 0)   -- per-order ordering; assigned max+1 by the action
product_id    uuid not null references products(id) on delete restrict   -- hand-written FK in migration
quantity      integer not null check (> 0)
unit_price_cents integer not null      -- PRICE SNAPSHOT at add time
unique(order_id, line_number)          -- NOT product-unique: the same SKU may repeat across lines
```

**Why the snapshot:** the line stores `unit_price_cents` captured from the
catalog when the line is added — so a later `updateProduct` price change never
rewrites a submitted order's totals. This is the price-side schema change vs.
`feature/orders-intake`, which derived price live (`line_number`, below, is the
other). (Resolves the accounting-correctness gap; line totals =
`unit_price_cents × quantity`.)

**Why duplicate-SKU lines:** the same product may legitimately appear on several
lines at different negotiated prices, so a line is keyed by `line_number`
(`unique(order_id, line_number)`), not by product. `addLine` appends at
`max(line_number)+1`; the unique constraint is the backstop against a race. (This
reverses the original one-row-per-product + merge model.)

## RLS + CASL (twin layers, both must pass)

**`orders`**

- **Read (USING):** `created_by = app.user_id` **OR** caller holds `owner` **OR**
  `admin` (read-all). *Change vs orders-intake:* `admin` joins
  `owner` on the read-all branch.
- **Create:** sets `created_by = app.user_id`. Allowed for `member`, `admin`,
  `owner`.
- **Write (WITH CHECK) — two branches:**
  - `member`: `created_by = me AND status = 'draft'` (own draft only)
  - `admin`/`owner`: any order **AND** `status NOT IN ('completed','cancelled')`
  - **Terminal orders (`completed`/`cancelled`) are frozen for everyone.**
- **Status transitions:** a dedicated guarded action against `VALID_TRANSITIONS`
  + role + ownership. `member` transitions own orders (submit/recall/cancel);
  `admin`/`owner` transition any. **Recall** (`submitted → draft`) is allowed for
  all three but only while `status = 'submitted'`. Not a blanket `update`.

**`order_lines`** (derived from parent order)

- **Read:** visible iff the parent order is visible.
- **Write:** allowed iff the caller may write the parent order under the orders
  write rule above — i.e. `member` only on their **own `draft`**; `admin`/`owner`
  on **any non-terminal** order. Terminal orders frozen for all.

CASL twin mirrors all of the above; a `transition` ability + `getAllowedTransitions(role, status)`
drive the UI (informed by Ian's `lib/abilities.ts`).

## Line-item intake UX (fuzzy search + native fields)

A line-item form on the order detail page. Browser-native focus/tab order —
**no custom keybinds, macro, or command bar** — but the product picker is a
**fuzzy search-as-you-type combobox**.

- **Entry row:** a **fuzzy SKU/name search** product picker (`ProductCombobox`,
  backed by `fuzzysort` over `getProducts()`, retired filtered out) + a quantity
  `<input>` + an **Add** button → `addLine`. The combobox matches SKU *or* name
  and always shows both per result; ↑/↓/Enter/Esc drive the list. A product MUST
  be picked — the input is `required` and `addLine` no-ops on an empty
  `productId`. Re-adding a product APPENDS a new line (duplicate SKUs allowed).
- **Existing lines:** a table — `#` (`line_number`), product, qty, unit
  (snapshot), line total — with inline quantity edit (`updateLine`) and a
  **Remove** button (`removeLine`); totals from the `unit_price_cents` snapshot
  (`getOrderLines`, ordered by `line_number`).
- Controls render only when the caller may write the order — the contractor's
  **own `draft`**, or any non-terminal order for `owner`/`admin`; locked once
  `submitted` (member) and on terminal orders (all).

The form re-derives `feature/orders-intake`'s prototype (TDD) with the snapshot
price; the fuzzy combobox replaced the original native `<select>` by request
(decision #4 reversed — see As-built revisions). Ian's `LineItemEditor` /
`entryMacro` are still **not** ported; macros, a command bar, and MCP stay
deferred (YAGNI) on the same server actions.

## Integration plan (TDD slices, in order)

1. **Foundation:** add `admin` role — session wiring, CASL identity, seed
   a demo `admin@example.com`. (Keep `member` as contractor.) TDD.
2. **orders schema + status + `order_number`** (sequence START 100000) + RLS
   twin + CASL (re-derive w/ `admin` read-all). TDD.
3. **order_lines** + `unit_price_cents` snapshot + parent-derived RLS +
   draft-only-edit lock. TDD.
4. **transition action** — `VALID_TRANSITIONS` + role/ownership gate + recall
   rule + `getAllowedTransitions`. TDD.
5. **server actions** — create/read/transition + line add/update/remove,
   guarded + rate-limited, exposed via `index.ts`. TDD.
6. **Intake UI** — line-entry form (product picker + qty + Add) and the line
   table (`#` / inline edit / remove) over the actions. E2E. (The picker became
   a `fuzzysort` combobox in the stacked PR #182 — As-built revisions.)
7. **Pages** — orders list, detail/editor, status display, office queue
   (`submitted`/`processing`). E2E.
8. **Wiring** — `nav`, `docs:surfaces` regen.

## Testing strategy

- **Unit:** actions, permissions, transition table, `getAllowedTransitions`.
- **RLS integration twins:** orders (own vs admin vs owner read),
  line-items (parent-derived, draft-only write), transition gating.
- **E2E:** contractor intake + recall; office `submitted→processing→completed`;
  owner read-all; non-owner cannot transition out of turn.

## Open decisions to confirm in review

1. ~~Contractor role key~~ **RESOLVED** — new back-office role is `admin`;
   contractor stays `member` (UI label "Agent"). No cross-feature rename.
2. ~~Catalog management~~ **RESOLVED** — owner-only. `admin`/`member` read the
   catalog but cannot manage it. No change to the products feature.
3. ~~`order_number`~~ **RESOLVED** — 6-digit sequence starting at `100000`
   (bigint, min-width display). ~30-yr runway at ~100 orders/day; phone-friendly.
4. ~~Intake-editor fidelity~~ **RESOLVED, then partly reversed** — native
   focus/tab and no macro/keybinds/command-bar/MCP still hold (deferred). The
   "no fuzzy" part was reversed in implementation: the product picker is now a
   `fuzzysort` search combobox (As-built revisions; stacked PR #182).
5. ~~Line model~~ **RESOLVED (as-built)** — duplicate-SKU lines keyed by
   `line_number`, not one-row-per-product-with-merge; the same product may
   appear on multiple lines at different snapshot prices. Migration `0009`.

## References

- NetSuite — Reopening a Closed Sales Order (reversibility-until-side-effect).
- Shopify — Canceling orders (cancel terminal; duplicate as redo); unfulfill.
- Odoo — Sales order states; lock/unlock; set-to-quotation.
- WooCommerce / Amazon — `processing` as the active-work status label.
