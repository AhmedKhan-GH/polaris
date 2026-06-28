// LogoRatios — presentational table of the corrected logo proportions. Takes the
// already-computed ratios as a prop (no math of its own). jsdom (vitest default).

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

import { LogoRatios } from './LogoRatios';
import { computeLogoRatios } from './ratios';

afterEach(cleanup);

const ratios = computeLogoRatios(branding.logoGeometry);

describe('LogoRatios', () => {
  it('shows the corrected lockup and emblem ratios', () => {
    render(<LogoRatios ratios={ratios} />);
    expect(screen.getByText('2.80 : 1')).toBeInTheDocument(); // lockup, corrected
    expect(screen.getByText('1 : 1')).toBeInTheDocument(); // emblem, a true circle
  });

  it('shows the emblem coverage within the lockup', () => {
    render(<LogoRatios ratios={ratios} />);
    expect(screen.getByText('29%')).toBeInTheDocument();
    expect(screen.getByText('81%')).toBeInTheDocument();
  });

  it('records the source squish it corrected from', () => {
    render(<LogoRatios ratios={ratios} />);
    expect(screen.getByText(/1\.04 : 1/)).toBeInTheDocument(); // source emblem aspect
  });
});
