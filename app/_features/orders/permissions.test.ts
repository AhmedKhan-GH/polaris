// @vitest-environment node
//
// orders permissions manifest, proven through the REAL composition root
// (app/_features/orders/permissions registered in lib/registry/abilities). These
// cycles call `buildAbility(identity)` with NO contributors argument, so they
// exercise the production wiring: the rules take effect only once the manifest is
// registered in the ability root.
//
// `subject('Order', { createdBy })` is required for the conditional rules: CASL
// evaluates `{ createdBy: identity.userId }` against a typed subject instance, so
// a bare string subject cannot exercise ownership scoping.

import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';

import { buildAbility } from '@/lib/permissions/ability';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('app/_features/orders permissions', () => {
  it('lets anyone create an Order (guard owns the unauthenticated denial)', () => {
    expect(buildAbility({ roles: [] }).can('create', 'Order')).toBe(true);
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('create', 'Order')).toBe(
      true,
    );
  });

  it('lets a member read and update their OWN order but not another rep’s', () => {
    const ability = buildAbility({ userId: ME, roles: ['member'] });
    expect(ability.can('read', subject('Order', { createdBy: ME }))).toBe(true);
    expect(ability.can('update', subject('Order', { createdBy: ME }))).toBe(true);
    expect(ability.can('read', subject('Order', { createdBy: OTHER }))).toBe(false);
    expect(ability.can('update', subject('Order', { createdBy: OTHER }))).toBe(false);
  });

  it('lets an owner read ANY order (read-all), but not write another rep’s', () => {
    const ability = buildAbility({ userId: ME, roles: ['owner'] });
    expect(ability.can('read', subject('Order', { createdBy: OTHER }))).toBe(true);
    // Owner is a read-all privilege, never write-as-anyone (mirrors the RLS
    // WITH CHECK, which has no owner branch).
    expect(ability.can('update', subject('Order', { createdBy: OTHER }))).toBe(false);
  });
});
