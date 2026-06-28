// @vitest-environment node
//
// The logo proportions shown on the Brand & Identity page are DERIVED from the
// lockup's source geometry, never hand-typed — so the page can never quote a
// ratio the artwork disagrees with. The source emblem in `Asset 3222.svg` is a
// slightly squished ellipse (rx 16.11 > ry 15.52): a decades-old non-uniform
// resize. `computeLogoRatios` un-stretches the whole lockup horizontally by
// `ry / rx`, restoring a true 1:1 circle and reporting the corrected ratios.

import { describe, expect, it } from 'vitest';

import { computeLogoRatios } from './ratios';

describe('computeLogoRatios', () => {
  // The real Zee Foods lockup geometry, straight from Asset 3222's viewBox + ellipse.
  const ASSET_3222 = {
    viewBox: { width: 111.51, height: 38.39 },
    emblem: { rx: 16.11, ry: 15.52 },
  };

  it('corrects the squished emblem to a true 1:1 circle', () => {
    expect(computeLogoRatios(ASSET_3222).emblemAspect).toBeCloseTo(1, 6);
  });

  it('derives the horizontal un-stretch factor from the emblem ellipse', () => {
    const { correction } = computeLogoRatios(ASSET_3222);
    expect(correction.sourceEmblemAspect).toBeCloseTo(1.038, 3); // rx / ry — wider than tall
    expect(correction.scaleX).toBeCloseTo(0.9634, 4); // ry / rx — the inverse un-stretch
  });

  it('computes the corrected lockup aspect ratio (~2.80:1, down from the source 2.90:1)', () => {
    expect(computeLogoRatios(ASSET_3222).lockupAspect).toBeCloseTo(2.7983, 3);
  });

  it('computes how much of the lockup the emblem covers', () => {
    const r = computeLogoRatios(ASSET_3222);
    expect(r.emblemWidthPct).toBeCloseTo(0.2889, 3); // ~29% of the width
    expect(r.emblemHeightPct).toBeCloseTo(0.8085, 3); // ~81% of the height
  });

  it('un-stretches any horizontally-distorted lockup to a circular emblem', () => {
    // A clean synthetic case: a 2:1 ellipse in a 200x100 box. Un-stretching X by
    // 0.5 makes the emblem circular and the lockup square.
    const r = computeLogoRatios({
      viewBox: { width: 200, height: 100 },
      emblem: { rx: 20, ry: 10 },
    });
    expect(r.correction.scaleX).toBeCloseTo(0.5, 6);
    expect(r.emblemAspect).toBeCloseTo(1, 6);
    expect(r.lockupAspect).toBeCloseTo(1, 6); // (200 * 0.5) / 100
    expect(r.emblemWidthPct).toBeCloseTo(0.2, 6); // (2 * 20 * 0.5) / 100
    expect(r.emblemHeightPct).toBeCloseTo(0.2, 6); // (2 * 10) / 100
  });
});
