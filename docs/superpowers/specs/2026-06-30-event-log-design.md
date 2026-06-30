# Order & Product Event Log — Design

> **Status:** proposed (2026-06-30). The first realization of **ADR-0007**'s append-only
> event log, on the order spine + the product catalog. Closes a live correctness gap —
> order status transitions and product price/state changes are currently **mutated in
> place** with no history (only `sign_in_log` is append-only today) — and establishes the
> reference pattern every future domain (fulfillment, routing, accounting…) copies.
> Branch: `feature/event-log`.

## What it is

Three append-only, **per-entity, typed** event tables that record business-significant
state and value changes, plus owner-only **windows** to read them. The live tables
(`orders.status`, `products.retired`/`price_cents`) stay the authoritative projection —
this is event **tracking** (ADR-0006/0007), *not* full event sourcing.

Deliberately **not** a single polymorphic `events` table with a `type` discriminator +
`jsonb` payload: per-entity tables give real FKs, typed columns, and one shape per table
(no discriminator), which matches ADR-0007's per-aggregate framing and the typed-ontology
direction. The cost — the global feed `UNION`s the tables — is acceptable.

## Tables

```
order_events                      -- order status lifecycle
  id           uuid pk
  order_id     uuid not null      -- FK orders(id)
  from_status  order_status       -- NULL = order creation (null → 'draft')
  to_status    order_status not null
  actor_id     uuid not null      -- profile that acted
  occurred_at  timestamptz not null default now()

product_status_events             -- product state lifecycle (mirrors order_events)
  id           uuid pk
  product_id   uuid not null      -- FK products(id)
  from_state   product_state      -- 'active' | 'retired'; NULL = creation (null → 'active')
  to_state     product_state not null
  actor_id     uuid not null
  occurred_at  timestamptz not null default now()

product_price_events              -- product price changes (a value event, not a state one)
  id           uuid pk
  product_id   uuid not null      -- FK products(id)
  from_cents   integer not null   -- prior price (the first row's from_cents = the creation price)
  to_cents     integer not null   -- new price
  actor_id     uuid not null
  occurred_at  timestamptz not null default now()
```

Every row in `order_events` / `product_status_events` is a transition, so **creation needs
no `type` column** — it is the genesis row (`from = null`).

## Append-only enforcement (copy `sign_in_log`, drizzle/0002)

Per table: `ENABLE ROW LEVEL SECURITY`; an **owner-only read** policy (fails closed without
identity, reads the `app.user_roles` GUC); and `GRANT SELECT, INSERT … TO app_user` with
**no UPDATE/DELETE** — immutability is enforced by the grant, not by convention. These
hand-written policy/grant statements live in the migration SQL (not re-emitted by
`db:generate`), exactly as `sign_in_log` does.

## Write path (ADR-0007: load → apply → save, one transaction)

Each tracked action appends its event in the **same transaction** as the mutation it
records, so the projection and the event can never diverge:

| Action | Event |
|---|---|
| `createOrder` | `order_events` (`null → 'draft'`) |
| `transitionOrder` | `order_events` (`from → to`) |
| `createProduct` | `product_status_events` (`null → 'active'`) |
| `retireProduct` | `product_status_events` (`'active' → 'retired'`) |
| `restoreProduct` | `product_status_events` (`'retired' → 'active'`) |
| `updateProduct` | `product_price_events` (`old → new`) **only when `price_cents` actually changes** |

## Viewer (owner-only; extends `app/_features/activity`)

- **Per-order timeline:** an owner-only "History" panel on the order detail page, reading
  `order_events where order_id = $1` (oldest → newest).
- **Global feed:** the existing owner-only `/activity` page folds in the three event tables
  alongside sign-ins — a chronological, filterable audit feed (`UNION` + order by
  `occurred_at`). Owner-gating reuses `activity`'s existing CASL + RLS pattern.

## Scope

**Tracked:** order create + status transitions; product create/retire/restore (state);
product price updates.
**Not tracked:** order lines (add/update/remove); notes; preferences; sign-out (asymmetric
with silent expiry, which is not an event); product name/SKU edits.
**Future (same pattern, later):** IAM role/membership; CRM; maps/routing; fulfillment;
cold-chain temperature + custody; accounting. Each becomes its own per-entity event table.

## Build slices (TDD, red → green → commit)

1. `order_events` table + append-only migration. Test: app role can `SELECT`/`INSERT` but
   **not** `UPDATE`/`DELETE`; owner reads, non-owner doesn't (mirror the `sign_in_log` RLS test).
2. `createOrder` + `transitionOrder` append (in-txn). Test: create writes `null → draft`;
   a legal transition writes `from → to`; an illegal transition writes nothing.
3. `product_status_events` table + migration (append-only/RLS, as slice 1).
4. `createProduct`/`retireProduct`/`restoreProduct` append the right state transitions.
5. `product_price_events` table + migration (append-only/RLS).
6. `updateProduct` appends a price event **only** on a price delta; name/SKU-only edits log none.
7. Per-order History panel (owner-only) renders the timeline from `order_events`.
8. Global `/activity` feed unions the three tables + sign-ins; owner-only.

## Decisions

1. **Per-entity typed tables, not one polymorphic `events` table** — real FKs, typed
   columns, one shape per table (no `type`/`kind` discriminator); matches ADR-0007's
   per-aggregate model.
2. **Transitions-as-rows** — creation is the genesis transition (`from = null`); no separate
   "created" event kind.
3. **No `reason` column** — nothing captures it today; add it (likely required) when
   cancellation/exception UI lands. YAGNI.
4. **Event tracking, not event sourcing** — the live tables remain the source of truth; the
   event tables are the durable, immutable history (ADR-0007's "the projection stays").
5. **Price events are updates only** — `from_cents` is the prior price; the creation price is
   recoverable from the first row (or the current projection if never changed).
6. **Append-only is DB-enforced** by the grant (no UPDATE/DELETE), copied from `sign_in_log`.
