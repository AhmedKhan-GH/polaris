// Ability composition seam (Domain Charter D4) — the foundation's single
// authorization gate.
//
// FAIL CLOSED: this module owns NO feature subjects, ever. It builds a CASL
// ability purely by invoking a flat list of `AbilityContributor`s, so an empty
// registry grants NOTHING. Feature subjects (Note, Order, SignInLog, ...) enter
// authorization ONLY via contributors registered in the composition root
// (lib/registry/abilities). This inverts clean-rewrite's hardcoded-rules weld:
// no rule is ever baked into the foundation; every rule is contributed by a
// feature and wired in at the root.

import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability';

import { abilityContributors } from '@/lib/registry/abilities';

/** The authenticated (or anonymous) caller, as seen by authorization rules. */
export type Identity = { userId?: string; roles: string[] };

/**
 * A unit of authorization policy contributed by a feature. It receives the
 * builder's `can` and the current `identity`, and declares the rules it owns.
 * Contributors never see `cannot`/`build`: the seam composes, features grant.
 */
export type AbilityContributor = (
  can: AbilityBuilder<MongoAbility>['can'],
  identity: Identity,
) => void;

/**
 * Build the caller's ability by composing every contributor.
 *
 * `contributors` defaults to the composition root's registry, so production
 * callers get exactly the rules wired in there (today: none — fail closed).
 * Tests pass an explicit list to exercise the seam in isolation.
 */
export function buildAbility(
  identity: Identity,
  contributors: AbilityContributor[] = abilityContributors,
): MongoAbility {
  const builder = new AbilityBuilder(createMongoAbility);
  for (const contribute of contributors) {
    contribute(builder.can, identity);
  }
  return builder.build();
}
