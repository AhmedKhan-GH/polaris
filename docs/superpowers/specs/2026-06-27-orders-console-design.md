# Orders — Multi-View Console — Design (as-built)

> **Status:** as-built. The `/orders` console — **List / Board / Status** views, server-first and URL-driven. Extracted 2026-06-27 from the orders session notes; the open decisions below were resolved as recommended and shipped (`OrdersListView`, `OrdersBoardView`, `OrdersStatusView`, `ViewSwitcher`, `OrderDetail`, `groupOrdersByStatus`, `filterOrders`). Companion to the intake ([`2026-06-22`](2026-06-22-orders-line-item-intake-design.md)) and inline-editing ([`2026-06-23`](2026-06-23-orders-inline-line-editing-design.md)) specs.

## What it is

`/orders` is a **console** with three views over the same RLS-scoped order set:

- **List** — the order table, with status + created-date-range filters.
- **Board (Kanban)** — a column per status, orders as cards.
- **Status** — per-status scrollable rails with a **center Detail pane** for the selected order.

The brief was the *structure* — routing, data flow, component boundaries, view switching, selection — with styling/interaction polish deferred.

## Architecture — server-first, URL-driven

- One RLS-scoped **`getOrders()`** call in the `/orders` RSC page. **No client data layer** — a deliberate divergence from the reference template's client React-Query shape; it stays server-first to match the rest of the codebase.
- **View + selection live in URL search params:** `?view=list|board|status` and `?selected=<orderId>`. Shareable, back-button-friendly, no client cache.
- **`ViewSwitcher`** = links that flip `?view` while preserving `?selected` (and the active filters).
- For **board/status**, when `?selected` is set the page *also* fetches that one order's detail server-side and renders it in the center pane via the reusable **`OrderDetail`** component (the same body the `/orders/[id]` route uses).
- Minimal client JS — just the switcher (and, later, any drag interactions).

## Build slices (TDD, all shipped)

- **B0 — Extract `OrderDetail`.** Move the body of `/orders/[id]/page.tsx` into an async `OrderDetail({ orderId })` that does its own fetching (`getOrder` / `getOrderLines` / products / session / permissions); the route just renders `<OrderDetail orderId={id} />`. *(Refactor — all tests stay green. Unblocks reusing the detail in the console center.)*
- **B1 — `groupOrdersByStatus(orders)`.** Pure helper → `Record<OrderStatus, OrderRow[]>` over `ORDER_STATUSES` (stable column order, empty arrays for empty statuses). Exported via the feature `index.ts`.
- **B2 — `/orders` reads `?view` + `?selected`; `ViewSwitcher`.** Page becomes `OrdersPage({ searchParams })`, default `view='list'`, rendering the switcher + the chosen view.
- **B3 — List view** (`OrdersListView`): row selection sets `?selected` (keeping an "Open" route link too).
- **B4 — Board view** (`OrdersBoardView`): B1 → a column per status, simple `OrderCard` placeholders; card click selects. *(Drag-to-transition is a later enhancement that would call `transitionOrder`.)*
- **B5 — Status-rail + center detail** (`OrdersStatusView`): per-status scrollable rails + a center pane rendering `<OrderDetail orderId={selected} />` when `?selected` is set (placeholder otherwise).
- **B6 — Wire `/orders` + nav + E2E.** Single Orders nav entry unchanged. E2E: load `/orders`, switch to board, click an order → detail appears; switching views preserves selection.

## Decisions (resolved)

1. **Server-first, URL-driven console** ✅ — chosen over the client React-Query shell; matches the whole codebase.
2. **Default view:** `list`.
3. **Selection:** list "Open" → the full `/orders/[id]` route; board/status selection → the `?selected` center/preview panel. Both kept (the list also gained a read-only preview).
4. **Board/status selection triggers one extra server query** (the selected order's detail) in the `/orders` page — accepted as the simplest skeleton.
