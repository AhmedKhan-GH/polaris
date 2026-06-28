# ADR-0007: Bifurcated layers and an append-only event log

**Status:** Accepted
**Date:** 2026-06-26

## Context

Cold-chain logistics is regulated and dispute-prone: *"who authorized this shipment, at what temperature, and when?"* is an operational question, not a hypothetical. A CRUD schema that mutates rows in place cannot answer it — yesterday's state is gone. The architecture has to separate stable business knowledge from changeable technology, and record every change immutably, without coupling domain rules to whichever database or framework is in use this year.

## Decision

Three domain-agnostic principles (orders today; clients, shipments, line items later):

1. **Bifurcated layers.** The Service sits *above* Domain and Persistence; Domain and Persistence are peers that never import each other. Dependency Inversion at the module level — neither leaf depends downstream, and the Service composes them. One narrow exception: Persistence imports the domain type + projection mapper to shape query results at the boundary (Domain stays pure, so its leaf status holds).
2. **load → apply → save.** Every mutation: load (persistence) → apply (pure domain function) → save (persistence), sequenced by the Service. Sibling operations differ only in the domain call; if they differ in more, logic has leaked out of the domain.
3. **Append-only event log.** A current-state projection table (the queryable cache) plus an append-only events table (one row per transition), written in one transaction. Immutability is **enforced by the database**: the app role holds `SELECT`/`INSERT` on events and no `UPDATE`/`DELETE`. A pure `replay(events)` reconstructs state. This is deliberately *not* pure event sourcing — the projection stays, because querying by replay alone is expensive at scale.

## Consequences

- One extra `INSERT` per mutation and a second table's overhead, bought for: audit trails, time-travel, reconstruction of any state anyone ever saw, and a legally defensible *"what did the system know, and when?"*
- A framework or database swap edits one layer, not a stack; *"where does this change go?"* has one honest answer.
- The events table is also the home for event tracking ([ADR-0006](0006-event-tracking-vs-operational-logging.md)).
- Revisit only if a domain genuinely needs full event sourcing (drop the projection) — not expected.
