# Orders & Line-Item Intake — Design Spec

- **Date:** 2026-06-22
- **Status:** Proposed (awaiting review)
- **Base branch:** `main` (now includes the products catalog, PR #179)
- **Target branch:** `feature/orders` (fresh off `main`)

## Goal

Build the **orders feature with line-item intake** on `main`, atop the
products catalog. Entry is a simple native form (informed by Ian Keilman's
work, not porting his macro editor); add a
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
  add later if a real need appears.
- **Richer line model** — per-line `unit`, fractional quantity, per-line price
  override, `line_number` ordering, line `notes` (all from Ian's model). Lean
  model stands: one row per product, integer qty, snapshot price.

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

**`order_lines`** (re-derived, + **price snapshot**):

```
id            uuid pk
order_id      uuid not null references orders(id) on delete cascade
product_id    uuid not null references products(id) on delete restrict   -- hand-written FK in migration
quantity      integer not null check (> 0)
unit_price_cents integer not null      -- PRICE SNAPSHOT at add time
unique(order_id, product_id)
```

**Why the snapshot:** the line stores `unit_price_cents` captured from the
catalog when the line is added — so a later `updateProduct` price change never
rewrites a submitted order's totals. This is the one schema change vs.
`feature/orders-intake`, which derived price live. (Resolves the accounting-
correctness gap; line totals = `unit_price_cents × quantity`.)

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

## Line-item intake UX (native fields)

A simple native HTML form on the order detail page — **no custom keybinds, no
macro, no command bar.** Browser-native focus/tab order only.

- **Entry row:** a product picker (from `getProducts()`, retired filtered out) +
  a quantity `<input>` + an **Add** button → `addLine`. Native `Tab` moves
  between fields; native `Enter` submits the form.
- **Existing lines:** a table with inline quantity edit (`updateLine`) and a
  **Remove** button (`removeLine`); line totals from the `unit_price_cents`
  snapshot (`getOrderLines`).
- Controls render only on the contractor's **own `draft`** (`canEdit`); locked
  once `submitted`.

This is essentially the form `feature/orders-intake` already prototyped — we
re-derive it (TDD) with the snapshot price. Ian's `LineItemEditor` / `entryMacro`
are **not** ported; rapid-entry keybinds, a command bar, and MCP are deferred
(YAGNI) and slot onto the same server actions later.

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
6. **Intake UI** — native line-entry form (product picker + qty + Add) and the
   line table (inline edit / remove) over the actions. E2E.
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
4. ~~Intake-editor fidelity~~ **RESOLVED** — native form fields only (browser
   focus/tab); no macro, keybinds, command bar, or MCP (all deferred).

## References

- NetSuite — Reopening a Closed Sales Order (reversibility-until-side-effect).
- Shopify — Canceling orders (cancel terminal; duplicate as redo); unfulfill.
- Odoo — Sales order states; lock/unlock; set-to-quotation.
- WooCommerce / Amazon — `processing` as the active-work status label.
