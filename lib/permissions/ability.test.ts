// @vitest-environment node
//
// Ability composition seam (lib/permissions/ability) — the Charter D4 seam.
//
// `buildAbility` is the foundation's single authorization gate. It owns NO
// feature subjects: it builds a CASL ability by invoking a flat list of
// `AbilityContributor`s and nothing else. The seam is FAIL-CLOSED — an empty
// contributor list (and the empty real registry) grants NOTHING. Feature
// subjects can only ever enter via contributors registered in the composition
// root (lib/registry/abilities). This inverts clean-rewrite's hardcoded-rules
// weld: rules are contributed by features, never hardcoded in the foundation.

import { subject } from '@casl/ability';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildAbility } from './ability';

describe('lib/permissions ability — fail closed (empty contributors)', () => {
  it('grants nothing when the contributor list is empty', () => {
    // The owner role is the most-privileged role in the system; even so, an
    // empty contributor list must grant it nothing. Authority lives entirely in
    // the contributors, never in the seam.
    const ability = buildAbility({ roles: ['owner'] }, []);

    expect(ability.can('read', 'SignInLog')).toBe(false);
    expect(ability.can('create', 'Note')).toBe(false);
  });
});

describe('lib/permissions ability — composes contributors', () => {
  it('applies a single contributor and grants only what it declares', () => {
    const ability = buildAbility({ roles: [] }, [(can) => can('read', 'Thing')]);

    expect(ability.can('read', 'Thing')).toBe(true);
    // A declared subject does not leak unrelated actions.
    expect(ability.can('write', 'Thing')).toBe(false);
  });

  it('composes multiple contributors granting distinct subjects', () => {
    const ability = buildAbility({ roles: [] }, [
      (can) => can('read', 'Alpha'),
      (can) => can('read', 'Beta'),
    ]);

    // Both contributors' grants are present...
    expect(ability.can('read', 'Alpha')).toBe(true);
    expect(ability.can('read', 'Beta')).toBe(true);
    // ...and nothing beyond what was declared leaks in.
    expect(ability.can('read', 'Gamma')).toBe(false);
  });

  it('passes identity to contributors so rules can be conditioned on the caller', () => {
    const ability = buildAbility({ userId: 'u1', roles: [] }, [
      (can, id) => can('read', 'Thing', { createdBy: id.userId }),
    ]);

    // CASL gotcha: conditional rules (`{ createdBy: ... }`) are only evaluated
    // against `subject()` instances. A bare string subject carries no fields, so
    // CASL skips the condition entirely and the rule matches unconditionally —
    // which is exactly why ownership checks MUST pass `subject('Thing', {...})`,
    // never the bare 'Thing'. We assert the conditional form here.
    expect(ability.can('read', subject('Thing', { createdBy: 'u1' }))).toBe(true);
    expect(ability.can('read', subject('Thing', { createdBy: 'u2' }))).toBe(false);
  });
});

describe('lib/permissions ability — default contributors come from the registry', () => {
  afterEach(() => {
    // Undo the per-test doMock and drop the dynamically imported copies so the
    // static top-level import above keeps using the REAL (empty) registry.
    vi.doUnmock('@/lib/registry/abilities');
    vi.resetModules();
  });

  it('grants nothing when called without an explicit list (real empty registry)', () => {
    // No second argument => the default parameter consults the production
    // registry, which is empty => fail closed.
    const ability = buildAbility({ roles: ['owner'] });

    expect(ability.can('read', 'SignInLog')).toBe(false);
    expect(ability.can('create', 'Note')).toBe(false);
  });

  it('consults the registry for the default list (proven by mocking it)', async () => {
    // Replace the registry with a single contributor, then re-import the seam so
    // its default parameter binds to the mocked registry. If `buildAbility` did
    // not read the registry for its default, this grant could never appear.
    vi.doMock('@/lib/registry/abilities', () => ({
      abilityContributors: [(can: (a: string, s: string) => void) => can('read', 'Mocked')],
    }));
    const { buildAbility: buildWithMockedRegistry } = await import('./ability');

    const ability = buildWithMockedRegistry({ roles: [] });

    expect(ability.can('read', 'Mocked')).toBe(true);
  });
});
