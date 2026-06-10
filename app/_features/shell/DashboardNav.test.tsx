// DashboardNav presentational filter+render (app/_features/shell/DashboardNav).
//
// jsdom environment (vitest default here). Pure presentational unit — it takes
// nav items and a minimal `ability` (just `can(action, subject)`) and renders a
// <nav> of links, dropping any item whose permission gate the ability denies.
// Items with no `permission` are always shown. The ability is a hand-rolled stub
// so the filter is exercised in isolation from CASL. Auto-cleanup is off (vitest
// `globals` disabled), so we unmount explicitly after each test.

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { NavItem } from '@/lib/registry/nav';

import { DashboardNav } from './DashboardNav';

afterEach(cleanup);

const items: NavItem[] = [
  { label: 'A', href: '/a' },
  { label: 'B', href: '/b', permission: { action: 'read', subject: 'X' } },
];

describe('DashboardNav', () => {
  it('renders only ungated items when the ability grants nothing', () => {
    render(<DashboardNav items={items} ability={{ can: () => false }} />);

    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '/a');
    expect(
      screen.queryByRole('link', { name: 'B' }),
    ).not.toBeInTheDocument();
  });

  it('renders a gated item when the ability grants its permission', () => {
    const ability = {
      can: (action: string, subject: string) =>
        action === 'read' && subject === 'X',
    };

    render(<DashboardNav items={items} ability={ability} />);

    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute('href', '/a');
    expect(screen.getByRole('link', { name: 'B' })).toHaveAttribute('href', '/b');
  });
});
