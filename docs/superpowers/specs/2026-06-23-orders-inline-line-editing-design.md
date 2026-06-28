# Orders — Inline-Editable Line Items (price override + quantity) — Design Spec

- **Date:** 2026-06-23
- **Status:** Approved (brainstorm complete) — ready for implementation plan
- **Base / target branch:** `feature/orders-rebuild`
- **Builds on:** `2026-06-22-orders-line-item-intake-design.md` (the as-built line model)

## Goal

Make order line items **directly editable in place**. Quantity and unit price
become text/number boxes that **auto-save on blur** — no per-row Edit/Save
buttons. The **line total sits at the rightmost column**. Editing the price is a
deliberate **per-line override** that is *tracked alongside* the frozen
list-price snapshot, so an order can show "was $10, now $8" and off-list pricing
stays auditable.

This is Feature 1 of three threads from the 2026-06-23 brainstorm. Feature 2
(multiple order views) and the product price changelog (shelved) are **out of
scope** here and tracked separately.

## Why a tracked override (Option B), not an in-place edit (Option A)

The line already carries a price **snapshot** captured at add time so a later
catalog price change never rewrites a placed order's totals
(`unit_price_cents` today). The question was: when a user overrides that price,
do we overwrite the snapshot (A) or keep it and store the override separately
(B)?

**B was chosen.** Orders are the billing + CRM record and the original
brainstorm explicitly anticipates *"different negotiated prices."* Keeping the
snapshot frozen and the override separate means discounting is answerable from
the data ("was X, now Y", "which orders got off-list pricing?") rather than
silently destroyed on first edit. The snapshot is **not** a live join to
`products` — `products.price_cents` is mutable/current; the line must freeze the
price-at-order-time itself (boundary rule B: orders never imports products).

## Data model

Rename + add one nullable column on `order_lines`:

| Column | Change | Meaning |
|--------|--------|---------|
| `unit_price_cents` → `list_price_cents` | **rename** | Frozen snapshot, captured at add time. **Never edited.** |
| `override_price_cents` | **new**, `integer` NULL | `NULL` = no override (use list). A value = the per-line price the user typed. |

- Constraint: `CHECK (override_price_cents IS NULL OR override_price_cents >= 0)`.
- Existing rows: value moves to `list_price_cents` under the rename; `override_price_cents` defaults `NULL` — i.e. every existing line reads exactly as before.
- The rename is hand-verified in the migration (preserve data; do **not** let drizzle emit a drop+add). `schema.ts` updated to match. Migration `0010`.

**Effective price** is derived, never stored:

```
effectivePriceCents(line) = line.overridePriceCents ?? line.listPriceCents
lineTotalCents(line)      = effectivePriceCents(line) * line.quantity
```

This pair lives as **pure exported helpers in the orders feature** (unit-tested),
so neither the page nor the client component does ad-hoc price math.

## Server action — `updateLine`

Today `updateLine(formData)` accepts `{ id, orderId, quantity }` and writes only
quantity. Extend it:

- Also accept an **optional** `overridePriceCents`.
  - A valid non-negative integer → set the override.
  - An **empty/cleared** value → set `override_price_cents = NULL` (line reverts to list price).
- `quantity` stays required and positive (unchanged validation).
- **Permission unchanged:** still `update Order` (CASL coarse gate) + the line-item RLS row gate. Editing a price is editing the order — no new ability, no new RLS policy. The same rate limiter applies.
- `list_price_cents` is **immutable** through this action — there is no code path that edits the snapshot.

Zod: extend the existing FormData parse with an optional override field
(`z.coerce.number().int().nonnegative()` guarded so empty string → `undefined` → `null`).

## UI — the one new client piece

Replace the per-row `<form>` + Save/Remove buttons in
`app/(dashboard)/orders/[id]/page.tsx` with a client `LineItemRow` component:

- **Quantity** and **price** render as inputs that **auto-save on blur** (call
  `updateLine`; on success the route revalidates as it does today). No Save button.
- The price input is seeded with the **effective** price. When an override is
  active, the frozen list price shows struck-through beside/under it
  (`~~$10.00~~ $8.00`); with no override, just the list price.
- **Line total is the rightmost column**, computed from `lineTotalCents`.
- **Remove** stays (the existing `removeLine` action).
- Rows are read-only (no inputs rendered) when `canEditLines` is false — the
  existing gate in the page is preserved.
- Auto-save trigger is **on blur** for now; finer UX (debounce-while-typing,
  optimistic display, inline validation messaging) is intentionally **not**
  specified yet — skeleton first.

Server-component data flow is otherwise unchanged: the page still loads
`getOrderLines` + products server-side and passes rows down.

## Testing (TDD, in this order)

1. **Migration + `schema.ts`** — rename + new column; existing RLS integration
   tests updated to the new column names (and a case asserting an existing row's
   value survives the rename as `list_price_cents` with `override_price_cents` NULL).
2. **`effectivePriceCents` / `lineTotalCents`** — pure unit tests: no override →
   list price; override set → override wins; total = effective × qty.
3. **`updateLine` override** — `actions.test.ts`: setting an override, clearing
   it back to NULL, list price never mutates, invalid (negative) rejected,
   quantity path still works.
4. **`LineItemRow`** — interactive behavior covered by the orders **E2E** suite
   (matching the existing "interactive bits covered by E2E" pattern): type a
   price → blur → persists and total updates; clear → reverts to list; quantity
   blur saves; read-only when not editable.

## Out of scope

- Multiple order views (Feature 2 — separate spec).
- Product price changelog (shelved — `docs/tasks/shelved.md`).
- Any change to add-line intake, transitions, or the orders list page.
- Finer inline-edit UX beyond auto-save-on-blur.
