# Architecture: Domain, Persistence, and Service Layers

> **Purpose of this document.** This is the **contributor reference** — the pragmatic guide for anyone writing code in this repo, answering *"where does this new function go?"* every layer is introduced with a concrete, copy-pasteable example pulled from the current codebase, so you never have to guess.
>
> For **why** the architecture is shaped this way (the philosophy, trade-offs, and alternatives considered), read [`architecture.md`](./architecture.md).
>
> For the **order subsystem design document** with formal diagrams (layered architecture figure, swim-lane mutation flow, layer-responsibility table), see [`architecture.pdf`](./architecture.pdf).
>
> For **what's planned next**, see [`roadmap.md`](./roadmap.md). For **what's queued to commit this session**, see [`open-threads.md`](./open-threads.md).

## The Core Idea

Three layers, each with exactly one job:

| Layer | Job | Knows about |
|---|---|---|
| **Domain** | Business rules, domain types, pure transforms | Nothing except itself |
| **Persistence** | Store and retrieve data | Drizzle / SQL |
| **Service** | Orchestrate the other two | Domain + Persistence |

The rule: **lower layers never import from higher ones.** Domain knows nothing about Drizzle. Persistence knows nothing about business rules. Only the service layer touches both.

---

## Layer 1: Domain (`lib/domain/`)

The domain answers: *what is an Order? What can it do? What rules must hold?*

```
lib/domain/order.ts
```

- Pure TypeScript — no Drizzle, no `db`, no `fetch`, no `Date.now()`
- Defines the `Order` type
- Defines pure transforms operating on that type

**Today, the domain has one transform:** `toOrder`, the row-to-domain mapper. It isolates the rest of the app from DB schema column names and enforces an explicit allowlist so unexpected columns never leak across the boundary.

```ts
export type Order = {
  id: string
  orderNumber: number
  createdAt: Date
}

export function toOrder(row: {
  id: string
  orderNumber: number
  createdAt: Date
}): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt,
  }
}
```

**Test this layer without a database.** It's just functions taking objects and returning objects. See `tests/orderMapper.test.ts`.

**Future:** when status arrives, transitions live here as pure functions:

```ts
// Future, not yet in the codebase:
export function confirmOrder(order: Order): Order {
  if (order.status !== 'draft') {
    throw new Error(`Cannot confirm order in status "${order.status}"`)
  }
  return { ...order, status: 'confirmed', updatedAt: new Date() }
}
```

The rule (`only drafts can be confirmed`) will live here, not in a route, not in a database trigger.

---

## Layer 2: Persistence (`lib/db/`)

The persistence layer answers: *how do I store and retrieve an Order?*

```
lib/db/orderRepository.ts
```

- All Drizzle queries live here
- Imports `toOrder` from the domain to project DB rows into domain shape
- No business rules — it doesn't know or care what "confirmed" would mean

```ts
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { orders } from '../schema'
import { toOrder, type Order } from '../domain/order'

export async function findOrderById(id: string): Promise<Order | null> {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return rows[0] ? toOrder(rows[0]) : null
}

export async function findAllOrders(): Promise<Order[]> {
  const rows = await db.select().from(orders)
  return rows.map(toOrder)
}

export async function insertOrder(input: { id: string }): Promise<Order> {
  const [row] = await db.insert(orders).values(input).returning()
  return toOrder(row)
}
```

`insertOrder` only receives an `id`; `orderNumber` is populated server-side by the `order_number_seq` sequence default, and `createdAt` by `DEFAULT now()`. The app never generates either.

---

## Layer 3: Service (`lib/services/`)

The service layer answers: *how do I complete a business operation end-to-end?*

```
lib/services/orderService.ts
```

**Today, one service function:**

```ts
import { randomUUID } from 'node:crypto'
import { insertOrder } from '../db/orderRepository'
import type { Order } from '../domain/order'

export async function createOrder(): Promise<Order> {
  return insertOrder({ id: randomUUID() })
}
```

Creation has no precondition to enforce, so there's no domain rule to apply — the service generates a UUID and delegates to the repository.

**Future mutations** will exercise the full three-beat pattern:

1. **Load** — fetch from persistence
2. **Apply** — run a pure domain function (`confirmOrder`, `shipOrder`, …)
3. **Save** — write back via persistence

```ts
// Future, not yet in the codebase:
export async function confirmOrderById(id: string): Promise<Order> {
  const order = await findOrderById(id)       // 1. load
  if (!order) throw new Error('Not found')
  const confirmed = confirmOrder(order)       // 2. apply (pure)
  await saveOrder(confirmed)                  // 3. save
  return confirmed
}
```

The service will be the only place that imports from both `domain/` and `db/`.

---

## How a Request Flows

```
Next.js Server Component / Server Action
              ↓
          Service layer          ← orchestrates
          /       \
     Domain      Persistence     ← each knows only its job
```

In the current code, the flow for creating an order is:

```ts
// app/actions.ts
'use server'
import { revalidatePath } from 'next/cache'
import { createOrder } from '@/lib/services/orderService'

export async function createOrderAction() {
  await createOrder()
  revalidatePath('/')
}
```

The Server Action calls the service. The service calls the repository. The repository does the SQL. The Server Component re-renders after `revalidatePath`. No layer reaches across.

---

## Why This Matters for Your Stack

**Testing.** Domain functions are pure — test them with `vitest` and no database setup. See `tests/orderMapper.test.ts`. Migration and repository behavior are integration-tested against a throwaway Postgres container — see `tests/migrations.test.ts`.

**Event log (future).** When append-only event sourcing arrives, the domain will produce *events* (`OrderConfirmed`, etc.), the service will append them in the same transaction as the projection upsert, and `replay(events)` will reconstruct current state from the log. Each layer's job stays the same; only the shape of what crosses them changes.

**Changing the database.** If Postgres is ever swapped, only `lib/db/` changes. Domain and services are untouched. The `toOrder` mapper's structural input type means the domain doesn't even depend on Drizzle's inferred row types.

---

## File Map

```
lib/
  domain/
    order.ts          ← Order type + toOrder mapper (+ future: transitions)
  db/
    orderRepository.ts ← Drizzle queries + domain projection via toOrder
  services/
    orderService.ts   ← orchestration (today: createOrder only)
  db.ts               ← Drizzle client setup
  schema.ts           ← orders table + order_number_seq sequence
  seed.ts             ← development seed

app/
  page.tsx            ← Server Component rendering the Kanban
  layout.tsx          ← root layout, dark-only theme
  actions.ts          ← createOrderAction Server Action

tests/
  migrations.test.ts   ← Testcontainers migration smoke test
  orderMapper.test.ts  ← pure unit tests for the mapper
```

---

## Future Work: Immer for Larger Domain Objects

The domain currently uses plain spread syntax to return new objects without mutating inputs:

```ts
return { ...order, status: 'confirmed', updatedAt: new Date() }
```

This is fine today. Order is a shallow 3-field object; each spread costs ~100ns. DB I/O dwarfs it by four or five orders of magnitude.

**When to revisit:** if domain objects grow deeply nested (line items with shipments with temperature logs with sensor readings…) and transitions need to update fields several levels down, the spread syntax gets ugly:

```ts
// Gets painful fast
return {
  ...order,
  shipments: order.shipments.map(s =>
    s.id === shipmentId
      ? { ...s, temperatureLogs: [...s.temperatureLogs, newReading] }
      : s
  )
}
```

**Solution:** [Immer](https://immerjs.github.io/immer/). You write code that *looks* like mutation, but Immer produces a new immutable object via structural sharing — only the touched branches are copied, everything else is reused.

```ts
import { produce } from 'immer'

export function recordTemperature(order: Order, shipmentId: string, reading: Reading): Order {
  return produce(order, (draft) => {
    const shipment = draft.shipments.find(s => s.id === shipmentId)
    if (!shipment) throw new Error('Shipment not found')
    shipment.temperatureLogs.push(reading)   // looks mutable, isn't
  })
}
```

The domain stays pure and immutable from the outside; the code inside reads like procedural updates. Structural sharing keeps the cost O(depth of change), not O(size of object).

**Adoption trigger:** introduce Immer when a domain transition needs to update something two or more levels deep, or when spread-based updates stop reading cleanly. Don't add it preemptively — plain spread is one less dependency to reason about, and fits the current shape of Order fine.

**Scope if adopted:** Immer is a domain-layer concern only. The repository and service don't change. `lib/domain/*.ts` functions swap `{ ...x, foo: y }` for `produce(x, d => { d.foo = y })` where it improves clarity.
