import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'

// App-layer authorization rules, keyed by the user's roles (from session.roles).
// Only the `owner` role grants anything for now — everyone else is denied by
// default (no rule → no access).
export function defineAbilityFor(roles: string[]): MongoAbility {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (roles.includes('owner')) {
    can('read', 'SignInLog')
  }

  return build()
}
