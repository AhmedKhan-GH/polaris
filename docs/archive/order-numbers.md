# Order Number System

## The Core Idea

Every order has two identifiers:

| Identifier | Type | Purpose |
|---|---|---|
| `id` | `uuid` | Internal primary key. Never shown to users. |
| `orderNumber` | `bigint` | Customer-facing. What humans read, say, scan. |

The split matters. `id` is a good database key — random, unguessable, generatable client-side without a round-trip. `orderNumber` is a good human identifier — a plain number, short, pronounceable, sortable, barcode-friendly. Neither has to compromise for the other's job.

---

## Current Scheme

- **Storage type:** `bigint`
- **Generator:** Postgres sequence `order_number_seq`, starting at `1000000`
- **First order number:** `1000000` (one million)
- **Growth:** monotonically increasing forever. Crosses 7 digits at 10M orders, 8 at 100M, etc. No ceiling that matters — `bigint` goes to `9_223_372_036_854_775_807` (~9.2 × 10¹⁸), which is more orders than the world will ever place.
- **Uniqueness:** enforced by a `UNIQUE` constraint on `orders.order_number`
- **Who sets it:** the database (`DEFAULT nextval('order_number_seq')`). The application never generates order numbers.

The counter grows naturally. There is no era allocation, no width juggling, no epoch migration. When the number gets long enough that display starts to matter visually, that is a presentation concern, not a data concern.

---

## Why These Choices

**Pure numeric, stored as `bigint`.** Freight / logistics industry norm. Dispatchers dictate numbers over phones and radios where alphanumeric gets lost in bad audio. EDI (ANSI X12 211/214) and most carrier TMS reference fields are numeric-only. Numeric Code 128 and ITF-14 barcodes scan faster and cost less than alphanumeric. `bigint` makes the commitment to pure numeric explicit and permanent: you cannot accidentally paste a prefix into the column.

**Sequence, not random.** Monotonic, collision-free, no retry logic in application code. The "leaks volume" objection that applies to sequential *primary keys* does not apply here — customers already see their own order numbers and can compare them.

**Database-generated, not application-generated.** One source of truth. Seed scripts, API inserts, bulk imports, ad-hoc SQL — all get the same treatment. There is no `generateOrderNumber()` function in the codebase, and there shouldn't be.

**Starting at 1,000,000, not 1.** Two reasons:

1. The first order is `1000000`, not `1` — the app never looks like a demo.
2. Width is visually stable at 7 digits from order one until order ~9,000,000. Plenty of runway before natural growth adds a digit.

**No leading-digit "era" namespacing.** An earlier draft of this scheme used the leading digit as a reserved namespace marker. It was removed. Identifiers should not carry business meaning. If a future need arises to segment orders semantically — acquisitions, business lines, regions — add a separate column (`source`, `business_line`, `tenant_id`). That is queryable, extensible, and does not couple partition schemes to the identifier format.

---

## How It Works

### Schema

```ts
// lib/schema.ts
export const orderNumberSeq = pgSequence('order_number_seq', {
  startWith: 1000000,
})

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  orderNumber: bigint('order_number', { mode: 'number' })
    .notNull()
    .unique()
    .default(sql`nextval('order_number_seq')`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

`mode: 'number'` returns JavaScript `number` on read. JavaScript's safe integer limit is `2^53 ≈ 9 × 10¹⁵`. At one billion orders per year, you would hit that limit in about 9 million years. If that ever becomes a real concern, switch the mode to `'bigint'` (returns `BigInt`) or `'string'`.

### Insert Flow

The service layer generates the UUID; the database fills everything else:

```ts
// lib/services/orderService.ts
export async function createOrder(): Promise<Order> {
  return insertOrder({ id: randomUUID() })
}
```

```ts
// lib/db/orderRepository.ts
export async function insertOrder(input: { id: string }): Promise<Order> {
  const [row] = await db.insert(orders).values(input).returning()
  return toOrder(row)
}
```

`.returning()` reads back the DB-populated `orderNumber` so the caller never has to round-trip again.

---

## Display Conventions

`orderNumber` is stored as a raw `bigint`. Presentation is a UI concern.

Reasonable formatting choices — pick one and apply consistently:

| Style | Example for `1000042` | Best for |
|---|---|---|
| Raw | `1000042` | CLI, logs, internal tools |
| Chunked (3-3-…) | `1-000-042` | Phone dictation, paper forms |
| Zero-padded to fixed width | `0001000042` (10 wide) | Labels, barcodes, ERP/report output |

The database never sees padding or dashes. Format on read, parse back to integer on write if user input is involved.

---

## Invariants

These are the rules the system depends on. Future changes must preserve them all:

1. Every issued `orderNumber` is immutable and permanent.
2. No two orders ever share an `orderNumber`.
3. The sequence `order_number_seq` is monotonically increasing. Never reset or rewound.
4. The database — not the application — assigns `orderNumber`.
5. `orderNumber` carries no business meaning. If you need to segment orders by source, tenant, or category, add a dedicated column.

---

## Known Behaviors

### Gaps Are Expected

Postgres sequences **do not roll back** when a transaction aborts. If you run:

```sql
BEGIN;
INSERT INTO orders (id) VALUES (...); -- consumes 1000042
ROLLBACK;
```

…`1000042` is permanently burned. The next insert gets `1000043`. The sequence will show gaps: `1000001, 1000002, 1000004, …`

**Do not try to fill them.** Backfilling is exactly the kind of operation that creates duplicate order numbers if a concurrent insert lands in the same window. Gaps are a normal property of transaction-safe counters.

### If Gapless Numbering Is Ever Required

Some jurisdictions (Germany's GoBD, parts of Italy's e-invoicing regime) mandate gapless sequences for invoices. Cold chain orders are not invoices and usually aren't subject to this, but if a regulation ever applies:

- A Postgres sequence cannot guarantee gaplessness.
- The solution is an application-level counter backed by a locking table row, incremented inside the same transaction as the insert. Slower (serializes inserts on that row) but gapless.
- Implement it **only** if mandated. For non-regulated use, sequence gaps are fine and operationally invisible.

### Concurrency

Multiple concurrent inserts work correctly without application coordination. `nextval()` is atomic. Two writers will never get the same number; the `UNIQUE` constraint is a belt-and-suspenders safeguard, not a primary defense.

### Don't Sort By `orderNumber`

It happens to work today (`bigint` sorts numerically), and it will keep working. But treat it as policy:

**`orderNumber` is an identifier, not a chronology key.** Sort orders by `createdAt` or `id` when you need creation order. This discipline protects you from:

- Future schema changes (e.g., if a regulatory requirement ever forces splitting the sequence).
- Mixed-source data if orders are ever imported from a pre-existing system.
- Reports that outlive the original author's assumptions.

If a report absolutely needs numeric order-number sort, write it explicitly: `ORDER BY order_number`. Don't silently rely on it.

---

## Future Upgrades

### Check Digit

Real freight / BOL systems typically append a **check digit** (ISO 7064 MOD 11-10 is a common choice). One extra digit computed deterministically from the preceding digits. Catches single-digit transcription errors and most adjacent-digit transpositions when a dispatcher mis-hears over the phone.

**When to consider:** if operational data shows recurring order-number misreads creating measurable support load. Implementation is a stored generated column or a trigger; existing numbers would need backfilling, which is cheap since the check digit is a pure function of the number.

If added, the check digit is a **display-time** concern: the stored `orderNumber` stays pure integer; the appended digit appears only when rendering to users. That way the database-side invariants (bigint, monotonic, UNIQUE) are untouched.

---

## Change Log

| Date | Change | Migration |
|---|---|---|
| 2026-04-18 | Initial system: `bigint`, starts at `1000000` | `0003_burly_lorna_dane.sql` |

Append new entries here when the scheme changes.
