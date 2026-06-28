// @vitest-environment node
//
// The served lockup must match the canonical tokens: its emblem must be a TRUE
// CIRCLE (a literal <circle> whose radius matches the recorded geometry), its
// viewBox must match, and its fills must be the canonical brand colors — so a
// drifted or re-squished asset fails the build.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

const ASSET = join(process.cwd(), 'public/zeefoods_lockup.svg');
const svg = existsSync(ASSET) ? readFileSync(ASSET, 'utf8') : '';

describe('public/zeefoods_lockup.svg — the canonical lockup asset', () => {
  it('draws the emblem as a true circle matching the recorded radius', () => {
    const m = svg.match(/<circle[^>]*\br="([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(branding.logoGeometry.emblem.r, 2);
  });

  it('has the viewBox the geometry records', () => {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(branding.logoGeometry.viewBox.width, 2);
    expect(Number(m![2])).toBeCloseTo(branding.logoGeometry.viewBox.height, 2);
  });

  it('uses the canonical brand colors', () => {
    expect(svg).toContain(branding.colors.blue.hex); // #00447c — the wordmark
    expect(svg).toContain(branding.colors.green.hex); // #67953f — the emblem circle
    expect(svg).toMatch(/#fff(fff)?\b/i); // white sprout (#fff or #ffffff)
  });
});
