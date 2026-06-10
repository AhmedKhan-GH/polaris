// @vitest-environment node
//
// activity permissions manifest, proven through the REAL composition root
// (app/_features/activity/permissions registered in lib/registry/abilities).
//
// These cycles deliberately call `buildAbility(identity)` with NO contributors
// argument, so they exercise the production wiring: the manifest only grants
// `read SignInLog` once it is actually registered in the ability root. An empty
// or mis-wired root makes the owner-true expectation fail — that is the seam
// being verified end to end, not the contributor in isolation.

import { describe, expect, it } from 'vitest';

import { buildAbility } from '@/lib/permissions/ability';
import { navItems } from '@/lib/registry/nav';

describe('app/_features/activity permissions', () => {
  it('grants an owner read on SignInLog through the real registry', () => {
    const ability = buildAbility({ roles: ['owner'] });
    expect(ability.can('read', 'SignInLog')).toBe(true);
  });

  it('denies a member read on SignInLog', () => {
    const ability = buildAbility({ roles: ['member'] });
    expect(ability.can('read', 'SignInLog')).toBe(false);
  });

  it('denies a roleless identity read on SignInLog', () => {
    const ability = buildAbility({ roles: [] });
    expect(ability.can('read', 'SignInLog')).toBe(false);
  });
});

describe('app/_features/activity nav registration', () => {
  it('contributes the Activity entry to the real nav registry', () => {
    expect(navItems).toContainEqual({
      label: 'Activity',
      href: '/activity',
      permission: { action: 'read', subject: 'SignInLog' },
    });
  });
});
