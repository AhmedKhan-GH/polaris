// The Brand & Identity route page. A SYNC server component (no session, no async),
// so unlike the other dashboard pages it is cheaply unit-testable: this proves the
// composition — lockup, palette, corrected ratios — reads from lib/branding and
// renders. The full nav + auth journey is covered by e2e/brand.spec.ts.

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

  it('shows the lockup, a canonical hex, and the corrected ratios', () => {
    render(<BrandPage />);
    expect(screen.getByAltText('Zee Foods')).toBeInTheDocument(); // the lockup <img>
    expect(screen.getByText('#00447c')).toBeInTheDocument(); // Zee Foods Blue
    expect(screen.getByText('2.80 : 1')).toBeInTheDocument(); // corrected lockup ratio
    expect(screen.getByText('1 : 1')).toBeInTheDocument(); // the circular emblem
  });
});
