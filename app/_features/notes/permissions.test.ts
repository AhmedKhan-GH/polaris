// @vitest-environment node
//
// notes permissions manifest, proven through the REAL composition root
// (app/_features/notes/permissions registered in lib/registry/abilities).
//
// Like the activity suite, these cycles call `buildAbility(identity)` with NO
// contributors argument, so they exercise the production wiring: the manifest's
// rules only take effect once it is actually registered in the ability root. An
// empty or mis-wired root makes these expectations fail — that is the seam being
// verified end to end, not the contributor in isolation.
//
// `subject('Note', { createdBy })` is required for the conditional `read` rule:
// CASL evaluates `{ createdBy: identity.userId }` against a typed subject
// instance, so a bare string subject cannot exercise ownership scoping.

import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';

import { buildAbility } from '@/lib/permissions/ability';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('app/_features/notes permissions', () => {
  it('lets anyone create a Note (guard owns the unauthenticated denial)', () => {
    expect(buildAbility({ roles: [] }).can('create', 'Note')).toBe(true);
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('create', 'Note')).toBe(
      true,
    );
  });

  it('lets a member read their OWN note but not another user’s', () => {
    const ability = buildAbility({ userId: ME, roles: ['member'] });
    expect(ability.can('read', subject('Note', { createdBy: ME }))).toBe(true);
    expect(ability.can('read', subject('Note', { createdBy: OTHER }))).toBe(false);
  });

  it('lets an owner read ANY note', () => {
    const ability = buildAbility({ userId: ME, roles: ['owner'] });
    expect(ability.can('read', subject('Note', { createdBy: ME }))).toBe(true);
    expect(ability.can('read', subject('Note', { createdBy: OTHER }))).toBe(true);
  });
});
