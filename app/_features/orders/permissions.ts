import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Orders feature authorization (Domain Charter D4) — the CASL twin of the
 * Postgres RLS on `orders`; both layers must pass. Wired into the foundation
 * through lib/registry/abilities.
 *
 * `create` is UNCONDITIONAL on purpose: denying an unauthenticated caller is the
 * GUARD's fail-closed job, not a rule concern.
 *
 * `read` is ownership-scoped — a `member` reads their OWN orders via the
 * `{ createdBy: identity.userId }` condition; an `owner` or `admin` additionally
 * gets an unconditional `read` (the read-all branch), mirroring the RLS USING
 * clause. Write/transition rules arrive with the transition slice.
 */
export const ordersAbilities: AbilityContributor = (can, identity) => {
  can('create', 'Order');
  can('read', 'Order', { createdBy: identity.userId });
  if (identity.roles.includes('owner') || identity.roles.includes('admin')) {
    can('read', 'Order');
  }
};
