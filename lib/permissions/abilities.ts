import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability'
import type { UserRole } from '../profile'
import type { OrderStatus } from '../domain/order'
import { permissions } from './schema'

type Actions = 'create' | 'read' | 'transition' | 'discard' | 'duplicate' | 'manage'
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
  drafted:   ['submitted', 'discarded'],
  submitted: ['invoiced',  'rejected'],
  invoiced:  ['closed',    'voided'],
  closed:    ['archived'],
  archived:  [],
  discarded: [],
  rejected:  [],
  voided:    [],
}

export function getAllowedTransitions(role: UserRole, status: OrderStatus): readonly OrderStatus[] {
  const all = VALID_TRANSITIONS[status]
  const ability = defineAbilityFor(role)

  return all.filter((toStatus) => {
    if (toStatus === 'discarded') return ability.can('discard', 'Order')
    if (!ability.can('transition', 'Order')) return false
    if (role === 'guest' && status !== 'drafted') return false
    return true
  })
}

export function canDuplicate(role: UserRole): boolean {
  return defineAbilityFor(role).can('duplicate', 'Order')
}
