// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { shellAbilities } from '@/app/_features/shell/permissions';
import { buildAbility } from '@/lib/permissions/ability';

/**
 * The shell surface contributes the `Preferences` subject (ADR-0009): any
 * authenticated caller may UPDATE their own preferences. Unconditional in CASL —
 * the guard fails closed on no session, and RLS scopes the write to the caller's
 * own row. Exercised in isolation by passing the contributor explicitly.
 */
describe('shell abilities — Preferences', () => {
  const ability = buildAbility({ userId: 'u1', roles: [] }, [shellAbilities]);

  it('lets any authenticated caller update Preferences', () => {
    expect(ability.can('update', 'Preferences')).toBe(true);
  });

  it('grants nothing else (fail closed)', () => {
    expect(ability.can('delete', 'Preferences')).toBe(false);
    expect(ability.can('update', 'Widget')).toBe(false);
  });
});
