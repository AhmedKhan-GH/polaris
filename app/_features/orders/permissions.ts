import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Orders feature authorization (Domain Charter D4). Wired into the foundation
 * through lib/registry/abilities — the foundation itself owns no subjects.
 *
 * `create` is UNCONDITIONAL in the ability on purpose: denying an unauthenticated
 * caller is the GUARD's fail-closed job, not a rule concern.
 *
 * `read`/`update`/`delete` are ownership-scoped: a rep acts on their OWN orders
 * via the `{ createdBy: identity.userId }` condition; an `owner` additionally
 * gets an unconditional `read` (the read-all branch) but NO write-all — owner is
 * a read-all privilege, never write-as-anyone. This is the CASL twin of the
 * Postgres RLS policy on `orders`; both layers must pass.
 */
export const ordersAbilities: AbilityContributor = (can, identity) => {
  can('create', 'Order');
  can('read', 'Order', { createdBy: identity.userId });
  can('update', 'Order', { createdBy: identity.userId });
  can('delete', 'Order', { createdBy: identity.userId });
  if (identity.roles.includes('owner')) can('read', 'Order');
};
