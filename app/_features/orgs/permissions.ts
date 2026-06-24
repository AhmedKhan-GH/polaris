import type { AbilityContributor } from '@/lib/permissions/ability';

// Route-level permission for the org creation action.
export const orgAbilities: AbilityContributor = (can) => {
  // Any authenticated user may start an organization.
  can('create', 'Organization');
  // Org role checks happen inside the action.
  can('manage', 'Membership');
  // withOrgContext scopes the actual membership read.
  can('read', 'Membership');
};
