# Centralized Permissions Architecture

Polaris currently enforces permissions in two places:

| Layer | Source | Purpose |
| --- | --- | --- |
| App authorization | `lib/abilities.ts` | CASL rules for server actions and UI affordances |
| Database authorization | Drizzle SQL migrations | Postgres RLS backstop for direct Supabase access |

The invariant is simple: a role should never be able to do more through a direct database/API path than it can do through the app.

## Current Subjects

| Subject | Meaning |
| --- | --- |
| `Order` | Order lifecycle, reads, duplication, discard/transition actions |
| `OrderItem` | SKU-backed line items on drafted orders |
| `Sku` | SKU catalog reads and admin/owner catalog management |
| `Settings` | Team/account administration |

## Current Role Rules

| Role | Order | OrderItem | Sku | Settings |
| --- | --- | --- | --- | --- |
| `guest` | create/read own orders, submit/discard drafts, duplicate | create/read/update/delete on own drafted orders | read active SKUs | none |
| `member` | create/read, discard, duplicate | create/read/update/delete on drafted orders | read active SKUs | none |
| `admin` | create/read/transition/discard/duplicate | create/read/update/delete on drafted orders | manage catalog | none |
| `owner` | create/read/transition/discard/duplicate | create/read/update/delete on drafted orders | manage catalog | manage |
| `system` | manage all | manage all | manage all | manage |

CASL expresses coarse capability. Server actions add row and state checks:

- Guests are scoped to orders they created.
- Line items can only be edited while the order is `drafted`.
- SKU creation and updates require `manage` on `Sku`.

## RLS Backstop

RLS keeps the database aligned with those same boundaries:

- `skus`: authenticated users can read active SKUs; `system`, `owner`, and `admin` can create/update.
- `order_line_items`: authenticated users can read/edit only line items whose parent order is visible and still drafted for writes; guests are scoped by `orders.created_by = auth.uid()`.
- Existing order policies still block anonymous access and app code performs the detailed lifecycle checks.

The RLS policies live in migrations because the current schema uses raw SQL migrations. If the project moves to Drizzle-native `pgPolicy()` definitions later, the policy source can move next to the table definitions in `lib/schema.ts`.

## Target Single Source

The next cleanup step is to replace hand-maintained CASL and RLS definitions with one typed policy map:

```ts
export const permissions = {
  OrderItem: {
    read: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
    create: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
    update: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
    delete: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
  },
  Sku: {
    read: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
    manage: { roles: ['admin', 'owner', 'system'] },
  },
} as const
```

Derived outputs should include:

- CASL abilities for server actions and UI.
- Route access rules.
- RLS policy SQL or Drizzle `pgPolicy()` definitions.
- Permission tests that compare CASL intent against generated RLS operations.

Until that refactor lands, every permission change must update `lib/abilities.ts`, the relevant server action guard, and the RLS migration together.
