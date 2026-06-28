# Polaris Domain Growth & Schema Direction

> **Status:** long-horizon vision — the platform direction *beyond* the current F1–F12 roadmap ([`HANDBOOK.md`](../../HANDBOOK.md) §6). Not built, not scheduled; revisit when the post-orders domains (fulfillment, routing, assets, accounting) come on deck. ⚠️ The order-status examples below use the old 8-status names (`drafted/invoiced/closed/…`); the shipped model is **5 statuses** (draft/submitted/processing/completed/cancelled) — the *schema direction* stands, the status vocabulary is illustrative only.

This note captures the long-term schema direction discussed for growing Polaris from a single order process into a broader operations platform covering intake, fulfillment, routing, assets, and accounting.

## Core Direction

Polaris should grow as a modular operations platform, not as separate apps immediately.

The UI can feel like separate applets or workbenches:

- Order Intake
- Operations / Fulfillment
- Route Management
- Asset Tracking
- Accounting
- Reports
- Settings

But the technical architecture should stay as one coherent Next.js application for now, with strong domain boundaries inside the codebase and schema.

The guiding model:

```txt
Order = central business record
Domains = process-owned state around the order
Events/history = durable record of what changed, when, by whom, and why
Workbenches = role-specific views over the same operational graph
```

## Orders As The Spine

Orders are the shared anchor because every major process revolves around them:

```txt
customers create orders
staff fulfill orders
fleet moves orders
assets support orders
accountants close orders
```

That does not mean every state should live in the `orders` table. The order should be the spine, not the container for every department's complexity.

## Current Polaris State Tracking

Today Polaris tracks the order's lifecycle with:

```txt
orders
  id
  order_number
  status
  status_updated_at
  duplicated_from_order_id
  created_at

order_status_history
  id
  order_id
  from_status
  to_status
  changed_by
  changed_at
  reason
```

The current status lives on `orders.status`.

The lifecycle timeline lives in `order_status_history`.

The current status graph is:

```txt
drafted   -> submitted | discarded
submitted -> invoiced  | rejected
invoiced  -> closed    | voided
closed    -> archived
archived  -> nothing
discarded -> nothing
rejected  -> nothing
voided    -> nothing
```

Terminal states are:

```txt
archived
discarded
rejected
voided
```

Polaris enforces forward-only movement in two places:

- App code in `lib/db/orderRepository.ts`
- Database trigger in the Drizzle migrations

The normal mutation flow is:

```txt
transaction:
  lock order row
  validate transition
  update orders.status
  update orders.status_updated_at
  insert order_status_history row
```

This is the right basic pattern:

```txt
current state = first-class column
history = append-only-ish rows
```

## Gaps To Tighten

Two consistency improvements should happen before the lifecycle becomes more important:

1. Normal order creation should record an initial history row:

```txt
from_status = null
to_status = drafted
changed_at = created_at
```

Duplicated orders already record a similar initial history row.

2. Status updates should use one timestamp for both places:

```txt
orders.status_updated_at
order_status_history.changed_at
```

This avoids tiny differences between app time and database default time.

Longer term, direct SQL updates should not be able to bypass history. That can be handled either by strict service-only mutation discipline or by moving lifecycle history insertion into a database trigger.

## Why Keep One State On `orders`

The order's own lifecycle state belongs on `orders` because it is intrinsic, universal, and needed almost everywhere.

It answers the broad system question:

```txt
Is this order drafted, active, fulfilled, closed, canceled, or archived?
```

That is different from domain-specific questions:

```txt
Has fulfillment assigned staff?
Has dispatch scheduled the stop?
Has the driver arrived?
Has an asset been returned?
Has accounting invoiced it?
```

Those should not become columns on `orders`.

Over time, `orders.status` should probably be renamed or reframed as:

```txt
orders.lifecycle_status
orders.lifecycle_updated_at
```

That makes it clear this state is the broad order lifecycle, not fulfillment state, routing state, asset state, or accounting state.

## Target Schema Shape

As domains grow, use this structure:

```txt
orders
  identity + broad lifecycle

domain current-state tables
  one current operational truth per process

domain resource/action tables
  many rows when work repeats

history/events
  when things changed, who did it, why
```

## Core Order Tables

```txt
orders
  id
  order_number
  customer_id
  lifecycle_status
  lifecycle_updated_at
  created_at

order_status_history
  id
  order_id
  from_status
  to_status
  changed_by
  changed_at
  reason
```

Do not add one timestamp column per lifecycle step unless there is a proven reporting need:

```txt
submitted_at
invoiced_at
closed_at
rejected_at
voided_at
```

Those can be derived from `order_status_history`:

```txt
submitted_at = first history row where to_status = submitted
invoiced_at = first history row where to_status = invoiced
closed_at = first history row where to_status = closed
```

## Intake

```txt
order_intake_state
  order_id primary key
  status
  source
  submitted_at
  reviewed_by
  status_updated_at
```

Example statuses:

```txt
draft
submitted
needs_review
accepted
rejected
```

## Customers

```txt
customers
  id
  name
  billing_account_id
  created_at

customer_contacts
  id
  customer_id
  name
  phone
  email

order_contacts
  order_id
  contact_id
  role
```

Example contact roles:

```txt
requester
site_contact
billing_contact
```

## Fulfillment / Staff

```txt
order_fulfillment_state
  order_id primary key
  status
  assigned_team_id
  assigned_user_id
  status_updated_at

order_tasks
  id
  order_id
  type
  status
  assigned_to
  due_at
  completed_at
```

Example fulfillment statuses:

```txt
unassigned
assigned
in_progress
blocked
complete
```

Example task statuses:

```txt
open
in_progress
blocked
done
canceled
```

## Routing / Fleet

```txt
routes
  id
  route_date
  vehicle_id
  driver_id
  status

route_stops
  id
  route_id
  order_id
  sequence
  status
  eta
  arrived_at
  completed_at
```

Example route statuses:

```txt
planned
dispatched
in_progress
completed
canceled
```

Example stop statuses:

```txt
scheduled
en_route
arrived
completed
failed
```

## Assets

```txt
assets
  id
  asset_tag
  type
  status

asset_assignments
  id
  order_id
  asset_id
  status
  reserved_at
  checked_out_at
  returned_at
```

Example asset statuses:

```txt
available
reserved
deployed
maintenance
retired
```

Example assignment statuses:

```txt
reserved
checked_out
deployed
returned
canceled
```

## Accounting

```txt
order_accounting_state
  order_id primary key
  status
  invoice_id
  status_updated_at

invoices
  id
  order_id
  invoice_number
  status
  issued_at
  paid_at
```

Example accounting statuses:

```txt
not_ready
invoiceable
invoiced
paid
closed
disputed
```

Example invoice statuses:

```txt
draft
sent
paid
voided
```

## Unified Event Table Option

At first, each domain can have its own history table:

```txt
order_status_history
order_fulfillment_history
order_accounting_history
route_stop_history
asset_assignment_history
```

As automation grows, a unified event table may be better:

```txt
order_events
  id
  order_id
  domain
  entity_type
  entity_id
  event_type
  from_status
  to_status
  actor_id
  occurred_at
  reason
  metadata jsonb
```

Example domains:

```txt
order
intake
fulfillment
routing
assets
accounting
```

Events should support audit and automation. They should not replace queryable current state early on.

The practical rule:

```txt
current state = real columns and indexed tables
history/events = timeline and automation source
```

## Example Combined State

An order can be active overall while each domain has its own truth:

```txt
orders.lifecycle_status = active
order_intake_state.status = accepted
order_fulfillment_state.status = in_progress
route_stops.status = en_route
asset_assignments.status = deployed
order_accounting_state.status = not_ready
```

This is why domain states should not all be crammed into `orders`.

## Industry Pattern

This is a common industry structure:

```txt
central business entity
domain-owned tables around it
current-state projections for fast queries
history/events for audit and automation
```

It is essentially normalized relational modeling plus bounded contexts.

Comparable companies use similar architectural ideas, even when their exact schemas are private:

- Shopify: commerce domains such as orders, shipping, inventory, billing.
- DoorDash: orders centered around dispatch, delivery, fulfillment, and support systems.
- Uber: trips/orders surrounded by marketplace, routing, payments, and account domains.
- Stripe: customers, invoices, payment intents, subscriptions, products, and prices as separate lifecycle objects.

For Polaris, the monolith-friendly version is:

```txt
one application
one database
clear domain tables
clear service boundaries
schema boundaries strong enough to extract later if needed
```

## Design Rules

- Keep `orders` as the spine.
- Keep only the broad order lifecycle on `orders`.
- Give each domain its own current-state table when it owns a distinct process.
- Use many-row tables for repeatable work, resources, stops, tasks, documents, and assignments.
- Track history for every important state mutation.
- Prefer current-state tables for operational queries.
- Prefer history/events for audit, timelines, and automation.
- Avoid one giant `orders` table with every department's state.
- Avoid making JSON blobs the source of operational truth.
- Avoid full event sourcing until there is a real need for replayable state.

