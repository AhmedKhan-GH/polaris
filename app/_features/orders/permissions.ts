import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Orders feature authorization (Domain Charter D4) — the CASL twin of the
 * Postgres RLS on `orders`; both layers must pass. Wired into the foundation
 * through lib/registry/abilities.
 *
 * `create` is UNCONDITIONAL on purpose: denying an unauthenticated caller is the
 * GUARD's fail-closed job, not a rule concern.
 *
 * `read` and `update` are ownership-scoped — a `member` acts on their OWN orders
 * via the `{ createdBy: identity.userId }` condition; an `owner` or `admin`
 * additionally gets the unconditional form (the read-all / write-all branch),
 * mirroring the RLS USING clauses.
 *
 * `update` is the guard for ALL order writes — add/edit/remove line, AND status
 * transitions (every write action self-guards `update Order`). The guard is a
 * COARSE bare check (`can('update','Order')`); the row-level "may I write THIS
 * order" gate is the Postgres RLS, and the legal transition target is the
 * action's `canTransition`. All three must pass.
 */
export const ordersAbilities: AbilityContributor = (can, identity) => {
  can('create', 'Order');
  can('read', 'Order', { createdBy: identity.userId });
  can('update', 'Order', { createdBy: identity.userId });
  if (identity.roles.includes('owner') || identity.roles.includes('admin')) {
    can('read', 'Order');
    can('update', 'Order');
  }
};
