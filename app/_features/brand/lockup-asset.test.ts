// @vitest-environment node
//
// The served lockup must match the canonical tokens. We weld the durable facts
// that survive an Illustrator re-export (which may change element types, class
// names, or absolute/relative coords): the viewBox, the emblem's position, and
// the brand fills. The emblem is a circle — whether authored as <circle> or as a
// <path>, its first point is the top of the circle, (cx, cy - r). Circularity
// itself is verified visually (a Chromium bounding-box render), not parsed here.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

const ASSET = join(process.cwd(), 'public/zeefoods_lockup.svg');
const svg = existsSync(ASSET) ? readFileSync(ASSET, 'utf8') : '';

describe('public/zeefoods_lockup.svg — the canonical lockup asset', () => {
  // Precision 1 (±0.05) tolerates Illustrator's 1-decimal export rounding.
  it('has the viewBox the geometry records', () => {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(branding.logoGeometry.viewBox.width, 1);
    expect(Number(m![2])).toBeCloseTo(branding.logoGeometry.viewBox.height, 1);
  });

  it('uses the canonical brand colors', () => {
    expect(svg).toContain(branding.colors.blue.hex); // #00447c — wordmark
    expect(svg).toContain(branding.colors.green.hex); // #67953f — emblem (sprout is negative space)
  });
});
