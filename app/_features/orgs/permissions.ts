import type { AbilityContributor } from '@/lib/permissions/ability';

// Route-level permission for the org creation action.
export const orgAbilities: AbilityContributor = (can) => {
  // Any authenticated user may start an organization.
  can('create', 'Organization');
};
