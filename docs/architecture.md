# Architecture Patterns

General architectural principles behind Polaris — the "why" behind the layering, the service shape, and the event log. These principles are **domain-agnostic**: they apply to orders today, and to clients, shipments, line items, and any other aggregate added later.

For the concrete order-subsystem design (schema, identifier scheme, file map, roadmap), see [`architecture.pdf`](./architecture.pdf) built from [`architecture.tex`](./architecture.tex). For the day-to-day contributor reference (where each thing lives, with current code samples), see [`contributing.md`](./contributing.md).

---

## In Plain Words

Picture a small office.

- **The rulebook on the wall** is the **Domain**. It says things like *"a draft order can be confirmed; a delivered order cannot be cancelled."* It never moves, never reaches for a folder.
- **The filing clerk** is **Persistence**. Knows where every folder lives. Fetches and files. Never reads what's inside.
- **The office manager** is the **Service**. Gets the folder from the clerk, checks the rulebook, updates the folder, hands it back to be filed.

The manager is the only one who talks to both. The clerk and the rulebook never speak to each other. Swap the filing cabinet for a computer? Only the clerk retrains. Change a rule? Only the rulebook edits. Each role has one job; problems have one place to live.

---

## Why This Architecture

Cold chain logistics is regulated and dispute-prone: *"who authorized this shipment at what temperature, and when?"* is an operational question, not a hypothetical. A CRUD schema that mutates rows in place cannot answer it — yesterday's state is gone. Polaris separates **business knowledge** (stable) from **technology** (changeable), and records every change as an immutable event.

This is why the code is layered: so that the domain rules (what a valid state transition looks like) can be tested, reasoned about, and audited independently of whichever database, framework, or runtime happens to be in use this year.

---

## Why Bifurcated, Not Linear

The Service sits *above* Domain and Persistence, not between them. Domain and Persistence are peers that never import each other. Three arrangements were possible:

```
(A) Linear:              (B) Linear:              (C) Bifurcated (chosen):
    domain → persistence     persistence → domain

     service                  service                   service
        ↓                        ↓                     /        \
     domain  ←✗ domain        persist ←✗ repo       domain    persist
        ↓    imports DB         ↓    grows business
     persist                  domain  methods
```

- **(A)** Domain would import the DB. It stops being pure. Tests need a database; swapping Postgres edits domain files.
- **(B)** Repo grows business methods (`saveConfirmedOrder`, …). It stops being about storage.
- **(C)** Domain and Persistence share no runtime link. Each changes for its own reasons; neither cascades.

This is Dependency Inversion at the module level: Domain and Persistence depend on nothing downstream; the Service composes them from above.

The one narrow exception — Persistence importing the domain type and projection mapper — is a concession to practicality: it lets the repository project its query results into domain shape once, at the boundary, without pushing that knowledge into the Service. Because Domain remains pure and depends on nothing, that import doesn't compromise its leaf status.

---

## Mutation Flow Pattern

Three-beat rhythm: **load → apply → save**. Rules live in Domain, I/O in Persistence, sequencing in Service.

```ts
export async function <operation>ById(id: string) {
  const entity = await find<Entity>ById(id)    // 1. load    (persistence)
  if (!entity) throw new Error('Not found')    //   null → error
  const next = <operation>(entity)             // 2. apply   (domain, pure)
  await save<Entity>(next)                     // 3. save    (persistence)
  return next
}
```

Sibling operations across a domain look nearly identical. That repetition is the architecture holding — all the interesting logic lives inside the pure domain function (step 2), not in orchestration. If two services-layer functions differ in more than the domain call they make, something has leaked out of the domain that should be inside it.

The null-check between load and apply is the Service translating *persistence vocabulary* (`null` for "not found") into *caller vocabulary* (an exception). Each layer speaks its own language; the Service is the bilingual one.

---

## Append-Only Event Log

Hybrid pattern: a current-state projection plus an append-only log, both written in one transaction.

- **Projection table** — current state. Queried by listings, dashboards, Kanban, Gantt. A cache of the events.
- **Events table** — append-only. One row per transition: event type, payload, actor, timestamps, prior/next status.
- **Enforced by the database**, not by the app: the app role receives `SELECT`/`INSERT` on the events table, and no `UPDATE`/`DELETE`. A developer who forgets the rule gets a permission error before the data can be corrupted.

A pure `replay(events)` reconstructs current state from the log alone. Events are the authoritative history; the projection is a cache. This is *not* pure event sourcing — the projection stays, because querying via replay alone is expensive and frequently regretted at scale.

**Trade-off.** You pay one extra `INSERT` per mutation, plus the schema overhead of a second table. You gain: audit trails, time-travel debugging, the ability to reconstruct any state anyone ever saw, and — for regulated domains like cold chain — a legally defensible answer to *"what did the system know and when did it know it?"*

---

## Why These Principles Compose

The three ideas reinforce each other:

- **Layers** isolate churn: a framework change shouldn't edit domain files.
- **Bifurcation** turns layers into peers rather than a stack, so the cost of change is local.
- **Event log** pushes the discipline into the database: the physical schema enforces the immutability the domain tests assume.

Together they produce a codebase where the question *"where does this change go?"* has one honest answer. That's the primary return on investment.

---

## References

- Eric Evans. *Domain-Driven Design: Tackling Complexity in the Heart of Software*. Addison-Wesley, 2003. (*"The Blue Book."*)
- Vaughn Vernon. *Implementing Domain-Driven Design*. Addison-Wesley, 2013.
- Alistair Cockburn. ["Hexagonal Architecture."](https://alistair.cockburn.us/hexagonal-architecture/) 2005.
- Robert C. Martin. *Clean Architecture*. Prentice Hall, 2017.
- Martin Fowler. ["Event Sourcing."](https://martinfowler.com/eaaDev/EventSourcing.html) 2005.
- Martin Fowler. *Patterns of Enterprise Application Architecture*. Addison-Wesley, 2002.
- Greg Young. *CQRS Documents*. 2010.
- Greg Young. *Versioning in an Event Sourced System*. Leanpub, 2017.
- Adam Bellemare. *Building Event-Driven Microservices*. O'Reilly, 2020.
