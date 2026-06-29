// LandingPage presentational hero (app/_features/landing/LandingPage).
//
// jsdom environment (vitest default here). `@/lib/branding` is partially mocked
// — the two text strings are overridden to prove the copy is sourced from config
// (no hardcoded tenant strings), while the real logo/wordmark asset records are
// preserved so the brand <img>s still render. The shared PageHeader is composed
// by the route, not by this component (cross-feature edges are forbidden), so it
// is not involved here. Auto-cleanup is off (vitest `globals` disabled), so we
// unmount explicitly after each test.

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/branding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/branding')>();
  return {
    branding: {
      ...actual.branding,
      productName: 'TestCo',
      tagline: 'Test tagline.',
    },
  };
});

import { LandingPage } from './LandingPage';

afterEach(cleanup);

describe('LandingPage', () => {
  it('renders product name and tagline from branding config', () => {
    render(<LandingPage user={null} />);

    expect(
      screen.getByRole('heading', { name: 'TestCo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Test tagline.')).toBeInTheDocument();
  });

  it('hides the Dashboard link when anonymous', () => {
    render(<LandingPage user={null} />);

    expect(
      screen.queryByRole('link', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
  });

  it('shows a Dashboard link to /dashboard in main when authed', () => {
    render(<LandingPage user={{ email: 'a@b.com' }} />);

    const dashboard = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboard).toHaveAttribute('href', '/dashboard');
    expect(dashboard.closest('main')).not.toBeNull();
  });

  // Brand rule (see /brand → "Don't split the lockup"): use the combined lockup —
  // the emblem and wordmark together as one mark — never placed separately on the
  // same piece of media.
  it('uses the combined lockup, not a split emblem + wordmark', () => {
    const { container } = render(<LandingPage user={null} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.getAttribute('src')).toBe('/zeefoods_lockup.svg');
  });
});
