// visibleNavItems (app/_features/shell/nav-visibility) — the pure filter over
// registry nav entries. An item without a permission gate is always visible; a
// gated item is visible only when the ability grants its action on its subject.
// Extracted from DashboardNav so the dashboard chrome (the burger menu) and the
// landing nav share exactly one filter, exercised here against a stub ability.

import { describe, expect, it } from 'vitest';

import type { NavItem } from '@/lib/registry/nav';

import { visibleNavItems } from './nav-visibility';

const items: NavItem[] = [
  { label: 'A', href: '/a' },
  { label: 'B', href: '/b', permission: { action: 'read', subject: 'X' } },
];

describe('visibleNavItems', () => {
  it('keeps ungated items and drops gated items the ability denies', () => {
    expect(visibleNavItems(items, { can: () => false })).toEqual([
      { label: 'A', href: '/a' },
    ]);
  });

  it('keeps a gated item when the ability grants its permission', () => {
    const ability = {
      can: (action: string, subject: string) =>
        action === 'read' && subject === 'X',
    };

    expect(visibleNavItems(items, ability)).toEqual(items);
  });
});
