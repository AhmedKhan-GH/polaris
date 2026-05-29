import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { UserRole } from '../profile'
import type { OrderStatus } from '../domain/order'
import { permissions } from './schema'

type Actions = 'create' | 'read' | 'transition' | 'cancel' | 'duplicate' | 'manage'
type Subjects = 'Order' | 'Settings' | 'all'

export type AppAbility = MongoAbility<[Actions, Subjects]>

export function defineAbilityFor(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  for (const [subject, actions] of Object.entries(permissions)) {
    for (const [action, rule] of Object.entries(actions)) {
      if (rule.roles.includes(role)) {
        can(action as Actions, subject as Subjects)
      }
    }
  }

  return build()
}

const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft:      ['confirmed', 'cancelled'],
  confirmed:  ['draft', 'processing', 'cancelled'],
  processing: ['fulfilled', 'cancelled'],
  fulfilled:  ['closed', 'cancelled'],
  closed:     [],
  cancelled:  [],
}

export function getAllowedTransitions(role: UserRole, status: OrderStatus): readonly OrderStatus[] {
  const all = VALID_TRANSITIONS[status]
  const ability = defineAbilityFor(role)

  return all.filter((toStatus) => {
    if (toStatus === 'cancelled') return ability.can('cancel', 'Order')
    if (!ability.can('transition', 'Order')) return false
    if (role === 'guest' && status !== 'draft') return false
    return true
  })
}

export function canDuplicate(role: UserRole): boolean {
  return defineAbilityFor(role).can('duplicate', 'Order')
}
