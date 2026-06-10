import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Notes feature authorization (Domain Charter D4). Wired into the foundation
 * through lib/registry/abilities — the foundation itself owns no subjects.
 *
 * `create` is UNCONDITIONAL in the ability on purpose: denying an unauthenticated
 * caller is the GUARD's fail-closed job (no session → 'Not authenticated' before
 * CASL is ever consulted), not a rule concern. Encoding a session check here
 * would duplicate that gate and leak request state into a pure policy. This
 * mirrors the predecessor convention; do not "fix" it by inspecting the session.
 *
 * `read` is ownership-scoped: a caller reads their OWN notes via the
 * `{ createdBy: identity.userId }` condition, and an `owner` additionally gets an
 * unconditional `read` (the read-all branch). This is the CASL twin of the
 * Postgres RLS policy on `notes`; both layers must pass to return a row.
 */
export const notesAbilities: AbilityContributor = (can, identity) => {
  can('create', 'Note');
  can('read', 'Note', { createdBy: identity.userId });
  if (identity.roles.includes('owner')) can('read', 'Note');
};
