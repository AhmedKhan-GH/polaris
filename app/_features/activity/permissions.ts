import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Activity feature authorization (Domain Charter D4). The sign-in log is an
 * owner-only observability surface: only an identity carrying the `owner` role
 * may `read` the `SignInLog` subject. Wired into the foundation through
 * lib/registry/abilities — the foundation itself owns no subjects.
 */
export const activityAbilities: AbilityContributor = (can, identity) => {
  if (identity.roles.includes('owner')) can('read', 'SignInLog');
};
