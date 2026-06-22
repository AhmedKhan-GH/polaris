import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Products feature authorization (Domain Charter D4). Wired into the foundation
 * through lib/registry/abilities — the foundation itself owns no subjects.
 *
 * Products is a flat reference catalog. `read` is UNCONDITIONAL: every signed-in
 * caller can read the catalog (members need it for the line-item picker), and
 * denying an unauthenticated caller is the GUARD's fail-closed job, not a rule
 * concern. `manage` (create/update/retire) is owner-only — the CASL twin of the
 * Postgres RLS policy on `products`; both layers must pass to write a row.
 */
export const productsAbilities: AbilityContributor = (can, identity) => {
  can('read', 'Product');
  if (identity.roles.includes('owner')) can('manage', 'Product');
};
