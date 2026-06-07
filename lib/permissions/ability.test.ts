import { describe, expect, test } from 'vitest'
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
