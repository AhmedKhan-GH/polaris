// @vitest-environment node
//
// The logo proportions shown on the Brand & Identity page are DERIVED from the
// lockup's geometry, never hand-typed — so the page can never quote a ratio the
// artwork disagrees with. The emblem is a true circle (a literal <circle r> in
// the SVG), so it is always 1:1.

import { describe, expect, it } from 'vitest';

import { computeLogoRatios } from './ratios';

describe('computeLogoRatios', () => {
  // The Zee Foods banner: viewBox 112.26 x 38.39, emblem circle r = 17.58.
  const BANNER = { viewBox: { width: 112.26, height: 38.39 }, emblem: { r: 17.58 } };

  it('reports the lockup aspect ratio (~2.92:1)', () => {
    expect(computeLogoRatios(BANNER).lockupAspect).toBeCloseTo(2.924, 3);
  });

  it('reports the emblem as a 1:1 circle', () => {
    expect(computeLogoRatios(BANNER).emblemAspect).toBe(1);
  });

  it('computes how much of the lockup the emblem covers', () => {
    const r = computeLogoRatios(BANNER);
    expect(r.emblemWidthPct).toBeCloseTo(0.313, 3); // ~31% of the width
    expect(r.emblemHeightPct).toBeCloseTo(0.916, 3); // ~92% of the height
  });

  it('works for any lockup geometry (clean synthetic case)', () => {
    const r = computeLogoRatios({ viewBox: { width: 200, height: 100 }, emblem: { r: 25 } });
    expect(r.lockupAspect).toBeCloseTo(2, 6);
    expect(r.emblemAspect).toBe(1);
    expect(r.emblemWidthPct).toBeCloseTo(0.25, 6); // 50 / 200
    expect(r.emblemHeightPct).toBeCloseTo(0.5, 6); // 50 / 100
  });
});
