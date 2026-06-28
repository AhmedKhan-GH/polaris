# Reference

Developer reference — the docs you read to understand how the codebase works and how to work in it. Distinct from the **decisions** in [`../adr/`](../adr/), the **designs** in [`../superpowers/specs/`](../superpowers/specs/), and the **vision** in [`../future/`](../future/).

- [`DEVELOPMENT-PLAYBOOK.md`](development-playbook.md) — how the clean-rewrite foundation was built, and the coding discipline behind it.
- [`development-progression.md`](development-progression.md) — coding guidance: write inline first, extract an abstraction after the third use, and the testing progression.
- [`centralized-permissions.md`](centralized-permissions.md) — the live two-layer **CASL + RLS** permissions reference (roles, the abilities registry, the member/admin/owner matrix).
- [`event-tracking-vs-logging.md`](event-tracking-vs-logging.md) — operational logging (Pino) vs the event-tracking table vs PostHog — the full comparison behind [ADR-0006](../adr/0006-event-tracking-vs-operational-logging.md).
- [`rls-indexing-strategy.md`](rls-indexing-strategy.md) — how RLS, composite indexes, `pg_trgm` fuzzy search, and faceted filters fit together — the how-to behind [ADR-0008](../adr/0008-rls-and-indexing-strategy.md).
- [`security-practices.md`](security-practices.md) — generic web-security how-to: the Server-Actions-vs-API-Routes decision guide, per-change checklists, and pre-deploy list (the Polaris-specific model is [`SECURITY-HANDBOOK`](../../SECURITY-HANDBOOK.md)).
