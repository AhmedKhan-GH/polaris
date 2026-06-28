import type { AbilityContributor } from '@/lib/permissions/ability';

/**
 * Shell-surface authorization (Domain Charter D4), wired into the foundation via
 * lib/registry/abilities. One subject today: `Preferences` (ADR-0009) — the
 * shell owns the preference controls, so it owns their authz.
 *
 * `update Preferences` is UNCONDITIONAL on purpose: denying an unauthenticated
 * caller is the GUARD's fail-closed job (no session → 'Not authenticated' before
 * CASL), and WHICH row a caller may write is enforced by the `user_preferences`
 * RLS policy (`user_id = app.user_id`). Encoding a session/ownership check here
 * would duplicate those gates and leak request state into a pure policy — the
 * same unconditional-grant shape the exemplar uses for its create rule.
 */
export const shellAbilities: AbilityContributor = (can) => {
  can('update', 'Preferences');
};
