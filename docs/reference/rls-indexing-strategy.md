# RLS, Indexing, and Faceted Search

> **Reference** — the how-to behind [ADR-0008](../adr/0008-rls-and-indexing-strategy.md) (the Tier-1 decision): planner strategies, `pg_trgm` setup, the index budget, and faceted-search SQL for the live multi-tenant Postgres stack.

How row-level security, indexes, and the filter UI fit together in a multi-tenant Postgres app.

## How RLS and indexes interact

RLS policies are **invisible `WHERE` clauses** that Postgres injects into every query. They don't bypass the planner — they extend it.

```sql
-- What the user writes
SELECT * FROM orders WHERE status = 'active';

-- What Postgres actually executes
SELECT * FROM orders
WHERE status = 'active'
  AND org_id = auth.uid();   -- RLS predicate
```

The planner sees one combined predicate and picks an index strategy. So **indexes still work normally** — you just need to design them with the RLS column in mind.

### Rule of thumb

The RLS-filtered column should be the **leftmost column** in composite indexes. It's applied on every query, so it's the natural anchor.

```sql
-- Good
CREATE INDEX ON orders (org_id, status, created_at);

-- Weak — planner can still use it via skip scan, but slower
CREATE INDEX ON orders (status, org_id, created_at);
```

## Filter intersections

A faceted filter UI produces queries with multiple `AND`s:

```sql
WHERE org_id = $1            -- RLS
  AND status = 'active'      -- user filter
  AND created_at > '2026-01-01'  -- user filter
```

Postgres handles these in one of three ways:

1. **Composite index scan** — uses an index like `(org_id, status, created_at)` directly
2. **BitmapAnd** — scans two single-column indexes, intersects the row bitmaps
3. **Index + filter** — uses one index, applies remaining predicates as a post-filter

You don't need an index per filter combination. Build composites for hot paths; rely on BitmapAnd for ad-hoc combinations.

## Server vs. client filtering

**Both RLS and user filters happen server-side.** Client-side filtering only works when the entire result set already fits in the browser (≲1000 rows).

```
Client filter UI → query params → server query → composite index → 50 rows back
                                  (RLS + filters merged here)
```

Why not client-side:

- A tenant might have 500K rows — can't ship to the browser
- Pagination breaks (you'd filter page 1 of 50, not the full set)
- Counts are wrong ("23 results" when it's really 23 of 5000)

Client side is for: filter UI state, sort order of loaded rows, display formatting.

## How facets stay within RLS

Every query — including the ones that populate facet dropdowns — runs under RLS. The user "navigates the whole DB" but it's their tenant's slice the whole time.

```sql
-- Result list
SELECT * FROM orders WHERE status = 'active' LIMIT 50;
-- + RLS: AND org_id = auth.uid()

-- Status facet counts
SELECT status, COUNT(*) FROM orders GROUP BY status;
-- + RLS: WHERE org_id = auth.uid()

-- Customer facet dropdown
SELECT DISTINCT customer_id, customer_name FROM orders;
-- + RLS: WHERE org_id = auth.uid()
```

### Drill-down facets

When facets narrow each other (Status=Active → Customer dropdown only shows customers with active orders), each facet query includes the *other* applied filters:

```sql
SELECT DISTINCT customer_id, customer_name
FROM orders
WHERE status = 'active'    -- the other applied filter
-- + RLS: AND org_id = auth.uid()
```

Same composite index `(org_id, status, ...)` serves it.

## Index budget

Per multi-tenant table, expect **3–6 indexes**. Above 10 you're paying real write cost.

| Index | Why |
|---|---|
| Primary key | Automatic |
| Foreign keys | Joins + cascade deletes |
| Hot-path composite (`org_id`, main filter, sort) | Default list view |
| 1–2 secondary composites | Other access patterns |
| Single-column on common facets | Planner BitmapAnds them together |

### Cost of each index

- ~10–30% of indexed columns' size on disk
- Write amplification on every INSERT/UPDATE/DELETE
- VACUUM and planner overhead

### Decision flow

1. Identify the 1–2 hot queries → composite indexes, RLS column first
2. Index every FK column
3. Add single-column indexes on commonly-filtered facets
4. **Stop.** Run `EXPLAIN ANALYZE`. Add more only when you see seq scans on hot paths.

## Fuzzy text search with `pg_trgm`

For typeahead, substring search, and typo-tolerant matching, B-tree indexes don't help. `pg_trgm` does.

### What it does

Splits strings into 3-character chunks (trigrams). Two strings are "similar" if they share many trigrams.

```
"order" → {"  o", " or", "ord", "rde", "der", "er "}
```

### Setup

```sql
CREATE EXTENSION pg_trgm;

CREATE INDEX orders_customer_name_trgm
  ON orders USING GIN (customer_name gin_trgm_ops);
```

Now these are fast:

```sql
SELECT * FROM orders WHERE customer_name ILIKE '%acme%';
SELECT * FROM orders WHERE customer_name % 'acmee';        -- fuzzy
SELECT * FROM orders ORDER BY customer_name <-> 'acme';    -- by similarity
```

### When to use

- Typeahead / autocomplete (names, SKUs, addresses)
- "Did you mean…" search
- Substring search (`%foo%` patterns)

### When not to use

- Full-document search → use `tsvector` + `tsquery` (Postgres FTS)
- Exact lookups → B-tree is faster
- Tables under ~10K rows → seq scan is fine

GIN indexes are larger and slower to write than B-trees. Fine for reference data; think twice on hot write paths.

## Industry tiers

Where this approach sits among production patterns:

### Tier 1 — most SaaS (the 90% case)

Postgres RLS + composite indexes led by tenant column. Supabase, PostgREST stacks, mid-market SaaS. Scales to ~10–100M rows per tenant.

### Tier 2 — search-heavy or faceted UX

Postgres (source of truth) + dedicated search layer:
- **Elasticsearch / OpenSearch** — Shopify, Stripe Dashboard, GitHub
- **Typesense / Meilisearch** — smaller teams
- **Algolia** — managed

Tenant filter goes into the search query as a mandatory clause. Sync via CDC or dual-writes.

### Tier 3 — complex authorization

Beyond simple ownership (sharing, hierarchies, role inheritance) → Google Zanzibar–style ReBAC:
- **OpenFGA** (Auth0/Okta)
- **SpiceDB** (AuthZed)
- **Permify, Oso**

Authorization service returns allowed resource IDs → Postgres query with `WHERE id = ANY($allowed_ids)`.

## What we run

Tier 1. Default to:

1. Every multi-tenant table: composite indexes leading with `org_id`
2. RLS policies referencing `org_id` directly (not chained joins — those kill index usage)
3. `EXPLAIN ANALYZE` on hot queries to verify index scans
4. `pg_trgm` GIN indexes on text columns users type into
5. No new infrastructure until a concrete query is actually slow

Tier 2 is the next jump if filter/search UI gets heavy. Tier 3 is overkill unless we add cross-org sharing or hierarchical permissions.
