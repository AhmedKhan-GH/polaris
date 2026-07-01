// NavMenu chrome (app/_features/shell/NavMenu) — the top-left burger that opens a
// left drawer of app navigation. jsdom (vitest default). It takes an already
// permission-filtered NavItem[] (plain data — no ability, no registry beyond the
// type) and owns only open/close state. `usePathname` is mocked so the active
// route highlight is observable without a real router. Fixtures use generic
// Alpha/Beta entries — the component is feature-agnostic, and the confinement law
// (Charter §4) keeps real feature tokens out of shared chrome tests.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NavItem } from '@/lib/registry/nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/beta',
}));

// Stand in for next/link: a plain anchor that preserves href + forwarded props
// (aria-current, className) but swallows the default navigation, which jsdom does
// not implement, so a link click observably runs NavMenu's onClick without noise.
vi.mock('next/link', () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: {
    href: string;
    onClick?: (e: React.MouseEvent) => void;
    children: React.ReactNode;
  }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}));

import { NavMenu } from './NavMenu';

afterEach(cleanup);

const items: NavItem[] = [
  { label: 'Alpha', href: '/alpha' },
  { label: 'Beta', href: '/beta' },
];

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));

describe('NavMenu', () => {
  it('renders a burger and no drawer until opened', () => {
    render(<NavMenu items={items} />);

    expect(
      screen.getByRole('button', { name: /open navigation/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the drawer with the nav links when the burger is clicked', () => {
    render(<NavMenu items={items} />);
    openMenu();

    expect(
      screen.getByRole('button', { name: /open navigation/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute(
      'href',
      '/alpha',
    );
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'href',
      '/beta',
    );
  });

  it('closes on Escape', () => {
    render(<NavMenu items={items} />);
    openMenu();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when a nav link is clicked', () => {
    render(<NavMenu items={items} />);
    openMenu();

    fireEvent.click(screen.getByRole('link', { name: 'Alpha' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes via the close button', () => {
    render(<NavMenu items={items} />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: /close navigation/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked', () => {
    render(<NavMenu items={items} />);
    openMenu();

    fireEvent.click(screen.getByTestId('nav-scrim'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the active route with aria-current', () => {
    render(<NavMenu items={items} />);
    openMenu();

    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: 'Alpha' }),
    ).not.toHaveAttribute('aria-current');
  });
});
