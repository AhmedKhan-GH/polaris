# ADR-0006: Event tracking is separate from operational logging

**Status:** Accepted
**Date:** 2026-06-26

## Context

Two systems both record "something happened," and conflating them corrupts both. Operational logs (Pino) answer *"what went wrong / how is the system behaving?"* — request timing, errors, retries, stack traces. They are noisy, ephemeral (rotated after days to weeks), and full of system internals. Event tracking answers *"what are users doing / is the product working?"* — `order.created`, `user.logged_in`, `order.status_changed` — selective, structured (actor, action, resource, metadata, timestamp), and kept indefinitely for audit and trend analysis.

Treating logs as the audit trail loses the history on the next rotation; pouring debug noise into the events table makes it un-queryable for business facts. The two have different audiences, lifecycles, and retention, so they are different systems.

## Decision

Run both, each for its own purpose:

- **Pino** — operational logging only. Errors, request timing, debugging. Ephemeral.
- **A custom Postgres events table** — event tracking. One row per meaningful business action, structured and permanent, queried for audit and analytics. This is the same append-only log described in [ADR-0007](0007-bifurcated-layers-and-event-log.md).
- **PostHog is not adopted.** No external product-analytics dependency for an internal tool.

## Consequences

- A business action writes on two unrelated paths (a Pino line for ops, an event row for the record); the two are never reconciled.
- The audit/analytics trail lives in our own database — queryable by SQL, retained forever, no third-party data egress.
- Revisit PostHog only if Polaris becomes external-facing and needs funnels, retention, session replay, or feature flags without building dashboards. Full comparison in `docs/reference/event-tracking-vs-logging.md`.
