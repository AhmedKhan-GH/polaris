// withPermission — Domain Charter D4 guard. EVERY server action self-guards by
// wrapping its body in this call.
//
// Iron Rule 5: the proxy/middleware matcher is route HYGIENE, not authorization.
// A Server Action is a POST to the page's own route and can bypass route
// matchers entirely, so authorization can never live in the edge proxy — it must
// be enforced here, at the action, on every invocation.
//
// Two error messages are CONTRACTUAL and distinct:
//   - 'Not authenticated' — there is no authenticated session at all.
//   - 'Not authorized'    — there is a session, but CASL denied the action.
// Callers (and their tests) rely on this distinction; do not collapse them.

import { getSessionUser } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { buildAbility } from '@/lib/permissions/ability';

export async function withPermission<T>(
  action: string,
  subject: string,
  fn: (ctx: { userId: string; roles: string[] }) => Promise<T>,
): Promise<T> {
  // Resolved ONCE per guarded call: the wrapped action receives the identity it
  // needs via `fn`'s ctx and must never re-fetch the session.
  const session = await getSessionUser();

  // Fail closed BEFORE any ability evaluation. No authenticated identity means
  // there is nothing to authorize, and CASL must never even be consulted. This
  // path's error is contractually DISTINCT from a CASL denial below.
  if (!session?.userId) {
    logger.warn(
      { action, subject },
      'authorization denied: no authenticated session',
    );
    throw new Error('Not authenticated');
  }

  // Normalize a missing `roles` to the empty set. The contract promises
  // `string[]`, but a half-resolved session could omit it; treating undefined as
  // [] means role-gated rules deny cleanly instead of throwing inside a
  // contributor's `roles.includes(...)`.
  const roles = session.roles ?? [];
  const ability = buildAbility({ userId: session.userId, roles });

  // CASL denial → distinct from the no-session case. Log the full caller context
  // (who tried to do what) before throwing so an operator can audit refusals.
  if (!ability.can(action, subject)) {
    logger.warn(
      { email: session.email, userId: session.userId, roles, action, subject },
      'authorization denied',
    );
    throw new Error('Not authorized');
  }

  // Authorized: run the guarded body with the already-resolved identity so it
  // need not (and must not) re-fetch the session.
  return fn({ userId: session.userId, roles });
}
