# Orders — Input Methods & Deferred Backlog (design)

> Date: 2026-06-26. Captures the orders input-method architecture and the
> deferred orders backlog discussed alongside MVP scoping.
>
> **None of this is MVP.** Each item is **demand-triggered** — build when its
> signal fires, not as a scheduled queue. The orders MVP (multi-view console +
> lean products catalog) is feature-complete vs. Ian's branch; the real next step
> is org-scoping (IAM #161–164), then *use it*.

## The core idea: one "add a line" foundation, many doors

Every way an order's lines can enter the system is a thin **adapter** over a
single, validated, programmatic core:

```
addLineBySku(orderId, sku, quantity, override?) → resolve SKU → validate → snapshot price → add
```

Build that core **once**; each input method is a parser/adapter feeding it. The
macro, CSV, API, MCP, barcode, and reorder are **not separate engines** — they
are doors on the same foundation.

## The doors (by who/what feeds the order)

**Staff, manually**
- **Form** — combobox + qty/price. *(Built today.)*
- **Barcode / QR scan** — scanner or phone camera → SKU → line. Warehouse-style
  item-by-item checkout. Ties to the deferred catalog `barcode` field.

**Staff, in bulk**
- **CSV** — two doors on one parser: a **file upload** and a **paste-a-grid**
  (paste tabular data from a spreadsheet). Per-row validation + error report.

**Repeat orders**
- **Reorder / order duplication** — copy a *past order's* lines into a new draft.
- **Order templates** — a *saved, named blueprint* (a standing weekly order)
  stamped into a new draft. Same capability as reorder, different source: build
  **reorder first** (no new entity); a template is just a saved order flagged for
  reuse, added later if people re-duplicate the same order.
- *Note:* duplication was earlier parked as a "lifecycle extra," but as an INPUT
  method it's a stronger case — likely the first of these to actually pay off.

**Another system feeding it**
- **API / EDI** — other companies' procurement systems push orders
  programmatically. The B2B system-to-system standard.
- **MCP** — AI agents place orders via a tool call on the core. **Email-to-order
  flows through this (or the API)** — email is a transport, not its own door;
  parsing an emailed order is an MCP/API job. **Gated on org-scoping** — no agents
  before orders belong to orgs.

**The customer entering it themselves**
- **Self-service portal** — a customer-facing version of the internal order
  system. Same core, different actor/UI; leans on the customer/org model (deferred).

## Triggers (when each earns its build)
- **Reorder** — repeat customers re-placing the same order. *Likely first; cheap on the core.*
- **Barcode** — physical/warehouse picking. *Likely if you're physical.*
- **CSV / email / API** — customers send orders as spreadsheets or via their systems. *Likely for wholesale.*
- **MCP** — agents, AND after org-scoping. *Last.*
- **Self-service** — customers self-order. *After the customer/org model.*

## Other deferred orders items (not input)
- **Pagination + virtualization** — when the list is actually slow (hundreds of
  orders). Port Ian's cursor pagination + `react-virtual`. Trigger: real volume.
- **Realtime sync** (+ optimistic updates + correlation-id) — when 2+ people edit
  the same orders live. Pulls in a client data layer.

## Open considerations (decide before "done" — not features)
- **Order-level charges** — the order total is sum-of-lines only. Real orders
  (esp. with delivery) may need a **delivery/shipping fee** or **order-level
  discount** that isn't a product line. Decide: everything a line item (even
  "Delivery" as a SKU), or a couple of order-level fields? The one genuine
  modeling gap not yet touched.
- **Concurrent edits** — no realtime yet means the inline auto-save is silent
  last-write-wins if two people edit one order. Fine if one person owns an order
  at a time.
