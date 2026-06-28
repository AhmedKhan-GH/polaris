// @vitest-environment node
//
// The brand tokens are the single source of truth the Brand & Identity page
// renders from (and that the app styles against). These tests pin the
// USER-CONFIRMED canonical hexes and the lockup geometry, so neither can drift
// silently. No app import — foundation never depends on a feature (Iron Rule 1);
// the ratio derivation is proven in the brand feature's own tests.

import { describe, expect, it } from 'vitest';

import { branding } from './branding';

describe('branding brand tokens', () => {
  it('exposes the three canonical brand colors (the confirmed hexes)', () => {
    expect(branding.colors.blue.hex).toBe('#00447c');
    expect(branding.colors.green.hex).toBe('#67953f');
    expect(branding.colors.white.hex).toBe('#ffffff');
  });

  it('names each color and gives it a usage role', () => {
    for (const c of [branding.colors.blue, branding.colors.green, branding.colors.white]) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.role.length).toBeGreaterThan(0);
    }
  });

  it('references the canonical lockup asset served from /public (~2.92:1)', () => {
    expect(branding.lockup.src).toBe('/zeefoods_lockup.svg');
    expect(branding.lockup.alt.length).toBeGreaterThan(0);
    expect(branding.lockup.width / branding.lockup.height).toBeCloseTo(2.92, 1);
  });

  it('records the lockup geometry so the displayed ratios stay derived', () => {
    expect(branding.logoGeometry).toEqual({
      viewBox: { width: 112.26, height: 38.39 },
      emblem: { r: 17.58 },
    });
  });
});
