# ADR-0008: RLS and indexing strategy (Tier 1)

**Status:** Accepted
**Date:** 2026-06-26

## Context

Polaris is multi-tenant Postgres with RLS. An RLS policy is an invisible `WHERE org_id = …` that the planner *sees and combines* with the user's filters, so indexes must be designed with the RLS column in mind, and a faceted filter UI produces multi-`AND` queries. We need an index strategy that keeps tenant-scoped reads fast without index sprawl, plus an explicit ladder for when — if ever — to add search or authorization infrastructure.

## Decision

Run **Tier 1**: Postgres RLS + composite indexes, no new infrastructure until a concrete query is measurably slow.

- **RLS/tenant column leftmost** in every composite index (`(org_id, status, created_at)`) — it is applied on every query, so it is the anchor.
- **Index budget 3–6 per tenant table**: PK, FK columns, one hot-path composite, 1–2 secondary composites, single-column indexes on common facets (the planner `BitmapAnd`s them). Then stop — `EXPLAIN ANALYZE`, add more only on observed seq scans of hot paths.
- **All filtering server-side** (RLS + facets merged in one query); client-side only reorders/formats already-loaded rows (≲1000).
- **`pg_trgm` GIN indexes** for typeahead / fuzzy / substring search on text columns users type into (already backs fuzzy SKU search).
- RLS policies reference `org_id` **directly**, never via chained joins (which kill index usage).

## Consequences

- Scales to ~10–100M rows per tenant on Postgres alone — no Elasticsearch or OpenFGA to operate.
- Constrains schema: every tenant-scoped table needs a real `org_id` column, leftmost in its composites — a direct input to the F12 customer-scoped-RLS / org-scoping work ([orders org-scoping spec](../superpowers/specs/2026-06-26-orders-org-scoping-design.md)).
- Revisit **Tier 2** (Elasticsearch / Typesense, synced via CDC) only if filter/search UX gets heavy; **Tier 3** (ReBAC: OpenFGA / SpiceDB) only if we add cross-org sharing or hierarchical permissions.
