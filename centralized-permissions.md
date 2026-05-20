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

If a permission changes in CASL but not in RLS, a direct Supabase REST call bypasses the app layer entirely. Two sources of truth is zero sources of truth.

## Approach

**Policy-as-Code with a single declarative schema.** One typed definition drives every enforcement layer. This is the pattern behind Oso, Cerbos, and Google Zanzibar (OpenFGA) — applied without the external service overhead.

### Why not an external policy engine?

| Option | When it fits | Why not now |
|--------|-------------|-------------|
| Oso / Cerbos | 10+ microservices, polyglot stack | Adds sidecar, network hop, operational cost |
| OpenFGA (Zanzibar) | Relationship-based AC, Google Docs-style sharing | Over-engineered for role-based, single-tenant |
| CASL + declarative schema | Single app, <10 roles, <20 subjects | Already integrated, zero infra, type-safe |

Revisit external engines at multi-tenancy or cross-service authorization.

## Architecture

```
lib/permissions/
  schema.ts        The source of truth. Declarative permission rules.
  abilities.ts     Derives CASL MongoAbility from schema.
  policies.ts      Derives Drizzle pgPolicy() objects from schema (used in lib/schema.ts).
  guard.ts         withPermission() wrapper for server actions.
  hooks.ts         useAbility() React hook via context.
  routes.ts        Derives route access from schema.
```

### The Schema

```typescript
// lib/permissions/schema.ts

export const permissions = {
  Order: {
    create:     { roles: ['guest', 'member', 'admin', 'owner'] },
    read:       { roles: ['guest', 'member', 'admin', 'owner'],
                  condition: { guest: { created_by: '$user.id' } } },
    transition: { roles: ['guest', 'admin', 'owner'] },
    discard:    { roles: ['guest', 'member', 'admin', 'owner'] },
    duplicate:  { roles: ['admin', 'owner'] },
  },
  Settings: {
    manage:     { roles: ['owner', 'system'] },
  },
} as const satisfies PermissionSchema
```

Adding a new feature means adding one block. Every downstream layer updates automatically.

### Derived Layers

**CASL abilities** — iterates the schema, calls `can()` per matching rule:

```typescript
for (const [subject, actions] of Object.entries(permissions)) {
  for (const [action, rule] of Object.entries(actions)) {
    if (!rule.roles.includes(role)) continue
    const cond = rule.condition?.[role]
    cond ? can(action, subject, resolve(cond, userId)) : can(action, subject)
  }
}
```

**RLS policies** — Drizzle has built-in `pgPolicy()` ([`drizzle-orm/pg-core/policies`](https://orm.drizzle.team/docs/rls)). No custom SQL generation needed — the permissions schema produces Drizzle policy objects that live in the table definition, and `drizzle-kit generate` produces the migration SQL.

```typescript
// lib/permissions/policies.ts
// Derives Drizzle pgPolicy() objects from the centralized schema.

import { sql } from 'drizzle-orm'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { authenticatedRole } from 'drizzle-orm/supabase/rls'
import { permissions, type PermissionSchema } from './schema'

type RoleString = 'system' | 'owner' | 'admin' | 'member' | 'guest'

const SUBJECT_TO_TABLE: Record<string, string> = {
  Order: 'orders',
  Settings: 'settings',
  Profile: 'profiles',
}

const ACTION_TO_OPERATION: Record<string, 'select' | 'insert' | 'update' | 'delete'> = {
  read: 'select',
  create: 'insert',
  transition: 'update',
  discard: 'delete',
  manage: 'all',
}

function roleCheck(roles: readonly RoleString[]) {
  const list = roles.map(r => `'${r}'`).join(', ')
  return sql.raw(`(auth.jwt() ->> 'user_role') IN (${list})`)
}

function ownershipCheck(column: string) {
  return sql.raw(`auth.uid() = ${column}`)
}

export function derivePolicies(subject: string, action: string, rule: PermissionSchema[string][string]) {
  const table = SUBJECT_TO_TABLE[subject]
  const operation = ACTION_TO_OPERATION[action]
  const policies = []

  const unconditionalRoles = rule.roles.filter(
    (r: RoleString) => !rule.condition?.[r]
  )
  const conditionalRoles = rule.roles.filter(
    (r: RoleString) => rule.condition?.[r]
  )

  if (unconditionalRoles.length > 0) {
    policies.push(
      pgPolicy(`${table}_${action}_full`, {
        for: operation,
        to: authenticatedRole,
        using: roleCheck(unconditionalRoles),
      })
    )
  }

  for (const role of conditionalRoles) {
    const cond = rule.condition![role]
    const column = Object.keys(cond)[0]          // e.g. 'created_by'
    const token = cond[column]                    // e.g. '$user.id'
    const resolved = token === '$user.id' ? 'auth.uid()' : token

    policies.push(
      pgPolicy(`${table}_${action}_${role}`, {
        for: operation,
        to: authenticatedRole,
        using: sql.raw(
          `(auth.jwt() ->> 'user_role') = '${role}' AND ${column} = ${resolved}`
        ),
      })
    )
  }

  return policies
}
```

These policy objects are then spread into the Drizzle table definition:

```typescript
// lib/schema.ts (table definition excerpt)
import { derivePolicies } from './permissions/policies'
import { permissions } from './permissions/schema'

export const orders = pgTable(
  'orders',
  { /* columns */ },
  (table) => [
    // indexes...
    ...derivePolicies('Order', 'read', permissions.Order.read),
    ...derivePolicies('Order', 'create', permissions.Order.create),
    ...derivePolicies('Order', 'transition', permissions.Order.transition),
    ...derivePolicies('Order', 'discard', permissions.Order.discard),
  ],
)
```

Running `npx drizzle-kit generate` produces the migration SQL automatically:

```sql
-- Auto-generated by drizzle-kit from the pgPolicy() definitions above
CREATE POLICY "orders_read_full" ON "orders"
  FOR SELECT TO "authenticated"
  USING ((auth.jwt() ->> 'user_role') IN ('member', 'admin', 'owner'));

CREATE POLICY "orders_read_guest" ON "orders"
  FOR SELECT TO "authenticated"
  USING ((auth.jwt() ->> 'user_role') = 'guest' AND created_by = auth.uid());
```

### Why Drizzle-native instead of raw SQL generation?

| Approach | Pros | Cons |
|----------|------|------|
| Custom `rls.ts` generating SQL strings | Full control, no dependencies | Hand-rolled SQL escaping, no migration diffing, must track policy drops/renames manually |
| **Drizzle `pgPolicy()` (what we use)** | Declarative, type-safe, Drizzle Kit generates + diffs migrations, policies live next to tables | Tied to Drizzle (already our ORM) |
| `crudPolicy()` from `drizzle-orm/neon/rls` | Even simpler for basic read/modify splits | Too coarse — collapses insert/update/delete into one "modify" policy, can't express per-action rules |

Drizzle's `pgPolicy()` is the right level of abstraction: it's a built-in feature of our existing ORM, produces correct migration SQL, and handles diffs (adding/removing/renaming policies) across `drizzle-kit generate` runs. The only custom code is `policies.ts` — a ~50 line function that maps the permissions schema to `pgPolicy()` calls.

**Server actions** — declarative wrapper replaces boilerplate:

```typescript
// Before: manual in every action
const { ability } = await getAbility()
ForbiddenError.from(ability).throwUnlessCan('create', 'Order')

// After: declarative
export const createOrderAction = withPermission('create', 'Order', async ({ profile }) => {
  // business logic only
})
```

**UI rendering** — context provider replaces prop drilling:

```tsx
// Dashboard layout provides once
<AbilityProvider value={defineAbilityFor(profile.role, profile.id)}>
  {children}
</AbilityProvider>

// Any component consumes
const ability = useAbility()
ability.can('transition', 'Order') && <TransitionButton />
```

**Route access** — derived, not maintained separately:

```typescript
// A role can access /orders if it has any permission on Order
const subject = routeToSubject[pathname]
return Object.values(permissions[subject]).some(r => r.roles.includes(role))
```

## Enforcement Layers

After migration, permissions are enforced at four depth levels:

```
Request
  1. Middleware        → route access check (derived from schema)
  2. Server Component  → ability check before render
  3. Server Action     → withPermission() guard
  4. Database (RLS)    → generated policies from same schema
```

If any layer is bypassed (e.g., direct Supabase REST call skips layers 1-3), layer 4 still enforces the same rules. Defense in depth from a single definition.

## Condition System

Row-level conditions use placeholder tokens resolved at each layer:

| Token | CASL (app) | RLS (Drizzle pgPolicy) |
|-------|-----------|----------------|
| `$user.id` | `profile.id` | `auth.uid()` |
| `$user.role` | `profile.role` | `auth.jwt() ->> 'user_role'` |

The `policies.ts` resolver maps these tokens when building `pgPolicy()` objects — `$user.id` becomes `auth.uid()` in the `sql.raw()` expression. CASL resolves the same tokens to runtime values. Both read from the same schema declaration.

This eliminates the current hardcoded `if (role === 'guest')` checks in server actions. The schema declares that guests see only their own orders; CASL and RLS both enforce it from that single declaration.

## Migration Path

| Step | Change | Risk |
|------|--------|------|
| 1 | Create `lib/permissions/schema.ts` — transcribe current rules | None, additive |
| 2 | Rewrite `lib/abilities.ts` to derive from schema | Low, same runtime behavior |
| 3 | Add `guard.ts`, refactor server actions one at a time | Low, incremental |
| 4 | Add `AbilityProvider`, replace role prop drilling | Low, incremental |
| 5 | Add `policies.ts`, attach `pgPolicy()` to tables, `drizzle-kit generate` replaces blanket policies | Medium, requires testing |
| 6 | Delete `lib/routes.ts`, derive route access from schema | Low, after step 1 verified |

Steps 2-4 are mechanical refactors with no behavioral change. Step 5 is the security improvement — RLS will finally enforce role-based rules instead of just blocking anonymous access.

## Invariant

> If you can change a permission in one place and have it silently not apply in another layer, the system is broken.

The schema makes this structurally impossible. One file to audit, one file to update, one file to test.

## What enforces what

| Layer | Service | What it does | Bypassed by |
|-------|---------|-------------|-------------|
| Route gating | `lib/permissions/routes.ts` (middleware) | Blocks navigation to pages the role has zero permissions on | Nothing — runs on every request |
| Component visibility | `useAbility()` hook (React context) | Hides buttons, tabs, form sections the role can't use | Direct API calls (no UI involved) |
| Server action guard | `withPermission()` wrapper (`guard.ts`) | Rejects the action before business logic runs | Direct Supabase REST/client calls |
| Row-level security | Drizzle `pgPolicy()` → Postgres RLS | Filters/blocks rows at the database level | Nothing — enforced by Postgres itself |

Each layer catches what the one above it misses. A guest who somehow reaches a server action is stopped by `withPermission()`. A direct Supabase REST call that bypasses all app code is stopped by RLS. The schema guarantees all four layers agree on the rules.

## How to add a new permission

Permissions are defined **per subject and action**, not per server action or per page. A subject is a business concept (Order, Settings, Profile). An action is what you can do with it (create, read, transition, discard).

### Steps

1. **Add the rule to `lib/permissions/schema.ts`.**

   ```typescript
   // Example: allow admins and owners to export orders
   Order: {
     // ...existing rules...
     export: { roles: ['admin', 'owner'] },
   },
   ```

   This is the only place you define the permission. Everything else derives from it.

2. **Wrap the server action with `withPermission()`.**

   ```typescript
   export const exportOrdersAction = withPermission('export', 'Order', async ({ profile }) => {
     // business logic
   })
   ```

   The action name in `withPermission('export', 'Order')` must match the key in the schema. TypeScript enforces this.

3. **Gate UI elements with `useAbility()`.**

   ```tsx
   const ability = useAbility()
   ability.can('export', 'Order') && <ExportButton />
   ```

   No new prop drilling. The ability is already in context.

4. **If the action needs an RLS policy** (i.e. the action maps to a SQL operation that isn't already covered), add the `derivePolicies()` call to the table definition in `lib/schema.ts` and run `drizzle-kit generate`.

   Not every permission needs its own RLS policy. `export` is a read operation — if `Order.read` already grants SELECT to admins and owners, no new policy is needed. RLS policies map to SQL operations (SELECT, INSERT, UPDATE, DELETE), not to business actions. Only add a new policy when a business action implies a SQL operation with different row-level rules than what's already covered.

5. **Route access updates automatically.** If the role has any permission on the subject, middleware allows navigation to that subject's pages. No manual route list to update.

### What maps to what

| Concept | Defined in | Granularity |
|---------|-----------|-------------|
| Permission rule | `schema.ts` | Per subject + action (e.g. `Order.export`) |
| Server action guard | `withPermission()` in the action file | Per server action — references a schema rule |
| UI visibility | `useAbility()` in the component | Per UI element — references a schema rule |
| RLS policy | `pgPolicy()` in `lib/schema.ts` | Per SQL operation + table — derived from schema rules |
| Route access | `routes.ts` (middleware) | Per page — derived automatically from schema |

### When you don't need a new permission

- **New page for an existing subject** — route access derives from existing permissions. If the role can `read` Order, it can access `/orders/analytics` too.
- **New server action that reuses an existing action** — e.g. a "bulk discard" action still uses `withPermission('discard', 'Order')`.
- **New UI component showing existing data** — `ability.can('read', 'Order')` already works.

### When you do

- **New capability that no existing action covers** — e.g. "export" is not "read." A user might be able to view orders but not export them.
- **New subject** — e.g. adding an `Invoice` entity means a new block in the schema with its own actions.
- **New row-level condition** — e.g. members can only transition orders assigned to them. This is a new condition on an existing rule, not a new rule.
