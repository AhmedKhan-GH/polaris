import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'

// App-layer authorization rules, derived from the user's roles and id (the
// Supabase auth user id). RLS enforces row ownership at the DB; CASL gates actions.
export function defineAbilityFor(
  roles: string[],
  userId?: string,
): MongoAbility {
  const { can, build } = new AbilityBuilder(createMongoAbility)

  if (roles.includes('owner')) {
    can('read', 'SignInLog')
  }

  // Orders: any signed-in user creates and reads their own; the owner reads all.
  can('create', 'Order')
  can('read', 'Order', { createdBy: userId })
  if (roles.includes('owner')) {
    can('read', 'Order')
  }

  return build()
}
