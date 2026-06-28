// LogoRatios — presentational table of the logo proportions. Takes the
// already-computed ratios as a prop (no math of its own). jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

import { LogoRatios } from './LogoRatios';
import { computeLogoRatios } from './ratios';

afterEach(cleanup);

const ratios = computeLogoRatios(branding.logoGeometry);

describe('LogoRatios', () => {
  it('shows the lockup and emblem ratios', () => {
    render(<LogoRatios ratios={ratios} />);
    expect(screen.getByText('2.92 : 1')).toBeInTheDocument(); // lockup
    expect(screen.getByText('1 : 1')).toBeInTheDocument(); // emblem, a true circle
  });

  it('shows the emblem coverage within the lockup', () => {
    render(<LogoRatios ratios={ratios} />);
    expect(screen.getByText('31%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });
});
