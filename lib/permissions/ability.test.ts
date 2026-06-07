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
})
