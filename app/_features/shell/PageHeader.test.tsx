// PageHeader presentational chrome (app/_features/shell/PageHeader).
//
// jsdom environment (vitest default here). `../auth/actions` is the single
// sanctioned cross-feature edge (shell -> auth); we mock it so no server
// function is invoked when the component wires `signOutAction` into a <form>.
// Auto-cleanup is off (vitest `globals` disabled, so RTL cannot register its
// own afterEach), so we unmount explicitly after each test.

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/actions', () => ({
  signOutAction: vi.fn(),
}));

// PreferenceControls is an async server component that reads the DB; stub it so
// the header's own unit test stays a pure presentational check. Its behaviour is
// covered by the control + action suites.
vi.mock('./PreferenceControls', () => ({
  PreferenceControls: () => null,
}));

// NavMenu is a client island (open/close, focus, drawer) covered by its own
// suite; stub it to a marker so this test checks only PageHeader's wiring —
// whether the burger is rendered — not the drawer's behaviour.
vi.mock('./NavMenu', () => ({
  NavMenu: ({ items }: { items: { href: string }[] }) => (
    <div data-testid="nav-menu">{items.length}</div>
  ),
}));

import type { NavItem } from '@/lib/registry/nav';

import { PageHeader } from './PageHeader';
import { branding } from '@/lib/branding';

afterEach(cleanup);

const navItems: NavItem[] = [{ label: 'Alpha', href: '/alpha' }];

describe('PageHeader', () => {
  it('always renders a home link named by the product brand', () => {
    render(<PageHeader user={null} />);

    const home = screen.getByRole('link', { name: branding.productName });
    expect(home).toHaveAttribute('href', '/');
  });

  it('shows a Log in link to /login and no Log out button when anonymous', () => {
    render(<PageHeader user={null} />);

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(
      screen.queryByRole('button', { name: 'Log out' }),
    ).not.toBeInTheDocument();
  });

  it('shows a Log out submit button in a form and no Log in link when authed', () => {
    render(<PageHeader user={{ email: 'a@b.com' }} />);

    const logout = screen.getByRole('button', { name: 'Log out' });
    expect(logout).toHaveAttribute('type', 'submit');
    expect(logout.closest('form')).not.toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Log in' }),
    ).not.toBeInTheDocument();
  });

  it('renders no navigation menu when no nav items are given', () => {
    render(<PageHeader user={{ email: 'a@b.com' }} />);

    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });

  it('renders the navigation menu when nav items are provided', () => {
    render(<PageHeader user={{ email: 'a@b.com' }} navItems={navItems} />);

    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();
  });
});
