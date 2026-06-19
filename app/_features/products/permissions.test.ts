// @vitest-environment node
//
// products permissions manifest, proven through the REAL composition root
// (app/_features/products/permissions registered in lib/registry/abilities).
//
// These cycles call `buildAbility(identity)` with NO contributors argument, so
// they exercise the production wiring: the manifest's rules only take effect
// once it is actually registered in the ability root.
//
// Products is a flat catalog: every signed-in caller reads it (the line-item
// picker needs it), only an `owner` manages it. There is no ownership scoping,
// so bare string subjects suffice — no `subject('Product', …)` instance needed.

import { describe, expect, it } from 'vitest';

import { buildAbility } from '@/lib/permissions/ability';

const ME = '11111111-1111-1111-1111-111111111111';

describe('app/_features/products permissions', () => {
  it('lets any signed-in caller read a Product', () => {
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('read', 'Product')).toBe(
      true,
    );
    expect(buildAbility({ userId: ME, roles: ['owner'] }).can('read', 'Product')).toBe(
      true,
    );
  });

  it('lets only an owner manage the Product catalog', () => {
    expect(buildAbility({ userId: ME, roles: ['owner'] }).can('manage', 'Product')).toBe(
      true,
    );
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('manage', 'Product')).toBe(
      false,
    );
  });

  it('lets an owner create a Product but denies a member', () => {
    expect(buildAbility({ userId: ME, roles: ['owner'] }).can('create', 'Product')).toBe(
      true,
    );
    expect(buildAbility({ userId: ME, roles: ['member'] }).can('create', 'Product')).toBe(
      false,
    );
  });
});
