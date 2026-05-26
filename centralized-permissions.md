# Centralized Permissions Architecture

## Problem

Permissions are defined in multiple places that can silently drift:

| Layer | Current Source | Risk |
|-------|---------------|------|
| App enforcement | CASL `AbilityBuilder` calls in `lib/abilities.ts` | Manual, imperative |
| Route access | Separate `ROLE_ROUTES` map in `lib/routes.ts` | Parallel definition |
| RLS policies | `TO authenticated USING (true)` in migrations | Binary gate, no role logic |
| UI rendering | `role` prop drilling + helper functions | Duplicated checks |
| Data filtering | Hardcoded `if (role === 'guest')` in actions | Scattered conditions |

## Two Layers

The app layer and database layer answer different questions. Each owns its definitions. They share ownership conditions where they overlap.

| Layer | Question | Source of truth |
|-------|----------|-----------------|
| App (CASL) | Can this role perform this business action? | `lib/permissions/schema.ts` |
| Database (RLS) | Which rows can this role SELECT/INSERT/UPDATE/DELETE? | `pgPolicy()` in `lib/schema.ts` |

Business actions (transition, export, duplicate) don't map 1:1 to SQL operations (SELECT, UPDATE). RLS is a coarser security floor. The app layer handles the fine-grained business logic on top.

### Why decoupled?

Multiple business actions map to the same SQL operation. Forcing them through one schema creates policies that are either too broad or a growing pile of edge cases.

| App action | SQL operation | Why they differ |
|-----------|---------------|-----------------|
| `transition` | UPDATE | One of many things that mutate an order |
| `duplicate` | INSERT | Business logic, not just "can you insert a row" |
| `export` | SELECT | Not every role that can read should export |
| `discard` | UPDATE (status change) | Not a DELETE at the database level |

Each layer does what it's good at. The app layer handles business action granularity. RLS handles row-access boundaries.

### Why not an external policy engine?

| Option | Why not now |
|--------|-------------|
| Oso / Cerbos | Adds sidecar, network hop, operational cost |
| OpenFGA (Zanzibar) | Over-engineered for role-based, single-tenant |
| Cerbos + `@cerbos/orm-drizzle` | Generates app-level WHERE, not Postgres RLS — doesn't protect against direct REST calls |

Revisit at multi-tenancy or cross-service authorization.

## Postgres roles vs app roles

These are different concepts that share the word "role."

**Postgres roles** are database-level identities. Supabase has a handful of built-in ones:

| Postgres role | What it is |
|--------------|------------|
| `anon` | Unauthenticated requests (no JWT) |
| `authenticated` | Any request with a valid JWT |
| `service_role` | Backend admin — bypasses all RLS |
| `postgres` | Superuser |

When a request hits Supabase, PostgREST sets the Postgres role based on whether the JWT is present. Every query runs as either `anon` or `authenticated`.

**App roles** (`system`, `owner`, `admin`, `member`, `guest`) are data — a value stored in the `profiles` table and embedded in the JWT as a custom claim via the access token hook. Postgres doesn't know about them natively.

In a `pgPolicy()` definition, these two concepts appear in different places:

```typescript
pgPolicy('orders_select_guest', {
  to: authenticatedRole,           // ← Postgres role (blocks anon)
  using: sql`
    (auth.jwt() ->> 'user_role')   // ← app role (reads from JWT)
    = 'guest'
    AND created_by = auth.uid()    // ← per-user (reads user ID from JWT)
  `,
})
```

`to: authenticatedRole` is the Postgres role gate. The `using` clause reads the app role and user ID from the JWT for fine-grained checks. CASL only knows about app roles — it never touches Postgres roles.

## Files

```
lib/permissions/
  schema.ts        Business-level permissions. Drives CASL, guards, UI, routes.
  abilities.ts     Derives CASL MongoAbility from schema.
  guard.ts         withPermission() wrapper for server actions.
  hooks.ts         useAbility() React hook via context.
  routes.ts        Route-to-subject mapping + middleware check.

lib/schema.ts      Drizzle schema. pgPolicy() definitions live here alongside tables.
```

## Enforcement Depth

```
Request
  1. Middleware        → route access (derived from permissions schema)
  2. Server Component  → ability check before render
  3. Server Action     → withPermission() guard
  4. Database (RLS)    → pgPolicy() enforced by Postgres
```

Each layer catches what the one above misses. A direct Supabase REST call skips 1-3 but is still stopped by 4.

---

## How to implement a feature

Every feature that needs permissions touches up to 5 files. Below is a blank template showing all the variants — role-only access, per-user ownership, and combined.

### 1. Permissions schema

```typescript
// lib/permissions/schema.ts

export const permissions = {
  Thing: {
    // Role-only: any of these roles can do it, no per-user filtering
    create:  { roles: ['member', 'admin', 'owner'] },

    // Per-user condition: guests can only read their own
    read:    { roles: ['guest', 'member', 'admin', 'owner'],
               condition: { guest: { created_by: '$user.id' } } },

    // Restricted to specific roles
    delete:  { roles: ['admin', 'owner'] },
  },
} as const satisfies PermissionSchema
```

### 2. Server action

```typescript
// lib/actions/thing.ts

export const createThingAction = withPermission('create', 'Thing', async ({ profile }) => {
  // business logic — permission already verified
})

export const readThingAction = withPermission('read', 'Thing', async ({ profile }) => {
  // CASL has already checked the role + condition
})

export const deleteThingAction = withPermission('delete', 'Thing', async ({ profile }) => {
  // only admin/owner reach here
})
```

### 3. UI

```tsx
// components/thing-actions.tsx

const ability = useAbility()

{ability.can('create', 'Thing') && <CreateButton />}
{ability.can('delete', 'Thing') && <DeleteButton />}
```

### 4. RLS policies (only if row access changes)

RLS policy changes follow the same workflow as any Drizzle schema change: update the `pgPolicy()` definitions in `lib/schema.ts`, then run `drizzle-kit generate` to produce a migration, then `drizzle-kit migrate` to apply it. Same as adding a column.

```typescript
// lib/schema.ts

import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, uuid } from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase/rls'

export const things = pgTable(
  'things',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdBy: uuid('created_by'),
    // ...
  },
  (table) => [
    // ---- SELECT ----

    // Role-only: internal roles see all rows
    pgPolicy('things_select_internal', {
      for: 'select',
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin', 'member')`,
    }),

    // Per-user: guests see only rows they created
    pgPolicy('things_select_guest', {
      for: 'select',
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'guest'
        AND ${table.createdBy} = auth.uid()
      `,
    }),

    // ---- INSERT ----

    // Role-only: these roles can insert
    pgPolicy('things_insert', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`(auth.jwt() ->> 'user_role') IN ('member', 'admin', 'owner')`,
    }),

    // Per-user: guest can insert only if created_by is themselves
    pgPolicy('things_insert_guest', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`
        (auth.jwt() ->> 'user_role') = 'guest'
        AND ${table.createdBy} = auth.uid()
      `,
    }),

    // ---- UPDATE ----

    // Role-only: privileged roles update any row
    pgPolicy('things_update_privileged', {
      for: 'update',
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('owner', 'admin')`,
    }),

    // Per-user: members update only rows they created
    pgPolicy('things_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`
        (auth.jwt() ->> 'user_role') = 'member'
        AND ${table.createdBy} = auth.uid()
      `,
    }),

    // ---- DELETE ----

    // Role-only: only admin/owner can delete
    pgPolicy('things_delete', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`(auth.jwt() ->> 'user_role') IN ('admin', 'owner')`,
    }),
  ],
)
```

### 5. Route mapping

When adding a new subject with its own pages, add one line to `routeToSubject`:

```typescript
// lib/permissions/routes.ts

const routeToSubject: Record<string, string> = {
  '/orders':   'Order',
  '/settings': 'Settings',
  '/invoices': 'Invoice',
  '/things':   'Thing',           // ← add this
}

export function canAccessRoute(pathname: string, role: string): boolean {
  const subject = routeToSubject[pathname]
  if (!subject) return true       // no subject = public page
  return Object.values(permissions[subject]).some(r => r.roles.includes(role))
}
```

This is the one mapping you maintain manually. The permissions themselves are derived from the schema — you never list which roles can access which routes.

---

## The three patterns

Every policy is one of these:

| Pattern | App layer (CASL) | RLS (pgPolicy) |
|---------|-----------------|-----------------|
| **Role-only** | `{ roles: ['admin', 'owner'] }` | `(auth.jwt() ->> 'user_role') IN ('admin', 'owner')` |
| **Per-user** | `{ condition: { guest: { created_by: '$user.id' } } }` | `${table.createdBy} = auth.uid()` |
| **Combined** | Role check + condition on specific roles | Role check in `IN (...)` OR role + `auth.uid()` match |

In CASL, `$user.id` resolves to `profile.id` at runtime. In RLS, the same concept is `auth.uid()` — read from the JWT by Postgres. `$user.role` in CASL is `profile.role`; in RLS it's `auth.jwt() ->> 'user_role'`.

---

## When to touch each file

| Change | schema.ts | server action | UI | pgPolicy | routes.ts | drizzle-kit generate |
|--------|:---------:|:------------:|:--:|:--------:|:---------:|:-------------------:|
| New business action, existing row access | Yes | Yes | Yes | No | No | No |
| New business action, new row access | Yes | Yes | Yes | Yes | No | Yes |
| New subject/table | Yes | Yes | Yes | Yes | Yes | Yes |
| New row-level condition on existing action | Yes | Yes | No | Yes | No | Yes |
| New page for existing subject | No | No | Maybe | No | No | No |
| New server action reusing existing permission | No | Yes | Maybe | No | No | No |

Most changes are the first row — a new business action where the existing SELECT/INSERT/UPDATE/DELETE policies already cover which rows the role can access. Only ownership condition changes or new tables require touching RLS.

---

## Migration path

| Step | Change | Risk |
|------|--------|------|
| 1 | Create `lib/permissions/schema.ts` — transcribe current rules | None, additive |
| 2 | Rewrite `lib/abilities.ts` to derive from schema | Low, same runtime behavior |
| 3 | Add `guard.ts`, refactor server actions one at a time | Low, incremental |
| 4 | Add `AbilityProvider`, replace role prop drilling | Low, incremental |
| 5 | Add `pgPolicy()` to table definitions, `drizzle-kit generate` replaces blanket policies | Medium, requires testing |
| 6 | Delete `lib/routes.ts`, derive route access from schema | Low, after step 1 verified |

## Invariant

> The app layer and database layer enforce the same ownership boundaries. Business action granularity lives in the app; row-access boundaries live in Postgres. Neither drifts because each is defined in exactly one place.
