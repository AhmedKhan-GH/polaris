import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { UserRole } from './profile'

type Actions = 'create' | 'read' | 'transition' | 'discard' | 'duplicate' | 'manage'
type Subjects = 'Order' | 'Settings' | 'all'

export type AppAbility = MongoAbility<[Actions, Subjects]>

export function defineAbilityFor(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  switch (role) {
    case 'guest':
      can('create', 'Order')
      can('read', 'Order')
      can('transition', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      break

    case 'member':
      can('create', 'Order')
      can('read', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      break

    case 'admin':
      can('create', 'Order')
      can('read', 'Order')
      can('transition', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      break

    case 'owner':
      can('create', 'Order')
      can('read', 'Order')
      can('transition', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      can('manage', 'Settings')
      break

    case 'system':
      can('manage', 'Settings')
      break
  }

  return build()
}
