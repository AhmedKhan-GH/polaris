// @vitest-environment node
//
// orders permissions manifest, proven through the REAL composition root
// (app/_features/orders/permissions registered in lib/registry/abilities).
//
// `buildAbility(identity)` is called with NO contributors argument, so these
// cycles exercise the production wiring — the manifest's rules only take effect
// once it is actually registered in the ability root.
//
// Orders are ownership-scoped, so reads are tested against `subject('Order', …)`
// instances (a bare 'Order' string can't carry the `created_by` a condition
// matches on).

import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';

import { buildAbility } from '@/lib/permissions/ability';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

describe('app/_features/orders permissions', () => {
  it('lets any signed-in caller create an Order', () => {
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('create', 'Order')).toBe(
      true,
    );
  });

  it('lets any signed-in caller read ANY order (open read for now)', () => {
    // Read is intentionally open at the moment — every signed-in caller sees all
    // orders (and their line items), regardless of who created them. Writes stay
    // ownership/role-scoped (see the update cases below).
    const member = buildAbility({ userId: ME, roles: ['member'] });
    expect(member.can('read', subject('Order', { createdBy: ME }))).toBe(true);
    expect(member.can('read', subject('Order', { createdBy: OTHER }))).toBe(true);
  });

  it('lets an admin read any order (read-all)', () => {
    const ability = buildAbility({ userId: ME, roles: ['admin'] });
    expect(ability.can('read', subject('Order', { createdBy: OTHER }))).toBe(true);
  });

  it('lets an owner read any order (read-all)', () => {
    const ability = buildAbility({ userId: ME, roles: ['owner'] });
    expect(ability.can('read', subject('Order', { createdBy: OTHER }))).toBe(true);
  });

  it('grants update Order at the guard level (the bare check withPermission runs)', () => {
    // The write actions (addLine / transitionOrder / ...) self-guard
    // `update Order`; the row gate is RLS. Every signed-in role must clear the
    // guard or all writes throw "Not authorized".
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('update', 'Order')).toBe(
      true,
    );
    expect(buildAbility({ userId: ME, roles: ['admin'] }).can('update', 'Order')).toBe(
      true,
    );
  });

  it('scopes a member’s update to their OWN order; admin/owner update any', () => {
    expect(
      buildAbility({ userId: ME, roles: ['member'] }).can(
        'update',
        subject('Order', { createdBy: ME }),
      ),
    ).toBe(true);
    expect(
      buildAbility({ userId: ME, roles: ['member'] }).can(
        'update',
        subject('Order', { createdBy: OTHER }),
      ),
    ).toBe(false);
    expect(
      buildAbility({ userId: ME, roles: ['admin'] }).can(
        'update',
        subject('Order', { createdBy: OTHER }),
      ),
    ).toBe(true);
    expect(
      buildAbility({ userId: ME, roles: ['owner'] }).can(
        'update',
        subject('Order', { createdBy: OTHER }),
      ),
    ).toBe(true);
  });
});
