// @vitest-environment node
//
// orders nav manifest, proven through the REAL composition root
// (lib/registry/nav). Orders carries no `permission`: every rep has orders (they
// see their own, owners see all), so the dashboard shows the link to everyone —
// the per-row scoping is the actions' + RLS's job, not the nav's.

import { describe, expect, it } from 'vitest';

import { navItems } from '@/lib/registry/nav';

import { ordersNav } from './nav';

describe('app/_features/orders nav', () => {
  it('declares an ungated Orders entry pointing at /orders', () => {
    expect(ordersNav).toEqual({ label: 'Orders', href: '/orders' });
    expect(ordersNav.permission).toBeUndefined();
  });

  it('is registered in the nav composition root', () => {
    expect(navItems).toContainEqual(ordersNav);
  });
});
