import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { UserRole } from './profile'

type Actions = 'create' | 'read' | 'transition' | 'discard' | 'duplicate' | 'manage'
type Subjects = 'Order' | 'DraftOrder' | 'Settings' | 'all'

export type AppAbility = MongoAbility<[Actions, Subjects]>

export function defineAbilityFor(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  switch (role) {
    case 'member':
      can('create', 'DraftOrder')
      can('read', 'DraftOrder')
      can('discard', 'DraftOrder')
      can('duplicate', 'DraftOrder')
      break

    case 'admin':
      can('create', 'DraftOrder')
      can('read', 'DraftOrder')
      can('discard', 'DraftOrder')
      can('read', 'Order')
      can('transition', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      break

    case 'owner':
      can('create', 'DraftOrder')
      can('read', 'DraftOrder')
      can('discard', 'DraftOrder')
      can('read', 'Order')
      can('transition', 'Order')
      can('discard', 'Order')
      can('duplicate', 'Order')
      can('manage', 'Settings')
      break

    case 'system':
      can('manage', 'Settings')
      break

    case 'guest':
      break
  }

  return build()
}
