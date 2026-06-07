import { describe, expect, test } from 'vitest'
import { subject } from '@casl/ability'
import { defineAbilityFor } from './ability'

describe('defineAbilityFor', () => {
  test('owner can read the sign-in log', () => {
    expect(defineAbilityFor(['owner']).can('read', 'SignInLog')).toBe(true)
  })

  test('a user with no roles cannot read the sign-in log', () => {
    expect(defineAbilityFor([]).can('read', 'SignInLog')).toBe(false)
  })

  test('a non-owner role cannot read the sign-in log', () => {
    expect(defineAbilityFor(['not-owner']).can('read', 'SignInLog')).toBe(false)
  })

  // Regression guard: the concrete `member` role must never gain log access.
  // Fails if a future rule accidentally grants `member` read on SignInLog.
  test('the member role cannot read the sign-in log', () => {
    expect(defineAbilityFor(['member']).can('read', 'SignInLog')).toBe(false)
  })
})

describe('defineAbilityFor — Order', () => {
  test('any signed-in user can create an order', () => {
    expect(defineAbilityFor([], 'u1').can('create', 'Order')).toBe(true)
  })

  test('a user can read their own order but not another user’s', () => {
    const ability = defineAbilityFor([], 'u1')
    expect(ability.can('read', subject('Order', { createdBy: 'u1' }))).toBe(true)
    expect(ability.can('read', subject('Order', { createdBy: 'u2' }))).toBe(
      false,
    )
  })

  test('an owner can read any order', () => {
    const ability = defineAbilityFor(['owner'], 'u1')
    expect(ability.can('read', subject('Order', { createdBy: 'u2' }))).toBe(true)
  })
})
