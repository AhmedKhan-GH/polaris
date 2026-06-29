// The Brand & Identity route page. A SYNC server component (no session, no async),
// so unlike the other dashboard pages it is cheaply unit-testable: this proves the
// composition — palette + downloadable assets — reads from lib/branding and renders.
// The nav + auth journey is covered by e2e/brand.spec.ts.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BrandPage from './page';

afterEach(cleanup);

describe('Brand & Identity page', () => {
  it('renders the page heading', () => {
    render(<BrandPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /brand & identity/i }),
    ).toBeInTheDocument();
  });

  it('shows the canonical colors', () => {
    render(<BrandPage />);
    expect(screen.getByText('#00447c')).toBeInTheDocument();
    expect(screen.getByText('#67953f')).toBeInTheDocument();
  });

  it('serves the brand SVGs as downloads', () => {
    const { container } = render(<BrandPage />);
    // Each asset card now offers several colorway links; collect every download.
    const hrefs = Array.from(container.querySelectorAll('a[download]')).map(
      (a) => a.getAttribute('href') ?? '',
    );
    // hrefs are cache-busted ("…svg?v=<hash>"); assert each canonical asset is present.
    for (const name of [
      '/zeefoods_lockup.svg',
      '/zeefoods_logo.svg',
      '/zeefoods_cutout.svg',
      '/zeefoods_leaf.svg',
      '/zeefoods_letters.svg',
    ]) {
      expect(hrefs.some((h) => h.startsWith(name))).toBe(true);
    }
  });

  it('offers a Black + White colorway selector on each mark', () => {
    render(<BrandPage />);
    // every mark exposes a Black and a reversed-White colorway to pick
    expect(screen.getAllByRole('button', { name: 'White' }).length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByRole('button', { name: 'Black' }).length).toBeGreaterThanOrEqual(4);
  });

  it('shows the naming guide with the legal name and domain', () => {
    render(<BrandPage />);
    expect(screen.getByRole('heading', { name: 'Naming' })).toBeInTheDocument();
    expect(screen.getByText('Zee Foods, LLC.')).toBeInTheDocument();
    expect(screen.getByText('zeefoods.com')).toBeInTheDocument();
  });

  it('documents the usage rules, one section each', () => {
    render(<BrandPage />);
    for (const name of [
      'Color use',
      'One mark per piece',
      'Keep the proportions',
      "Don't split the lockup",
      'Placement',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    // one Don't example per rule
    expect(screen.getAllByText("Don't").length).toBeGreaterThanOrEqual(4);
  });
});
