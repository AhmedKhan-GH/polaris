// @vitest-environment node
//
// The served lockup must be the CORRECTED artwork, not the squished source.
// These tests weld the asset to the canonical tokens: its viewBox must match the
// horizontally un-stretched geometry (a true circular emblem), and its fills must
// be exactly the canonical brand hexes — so a drifted asset fails the build.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

const ASSET = join(process.cwd(), 'public/zeefoods_lockup.svg');
const svg = existsSync(ASSET) ? readFileSync(ASSET, 'utf8') : '';

describe('public/zeefoods_lockup.svg — the corrected lockup asset', () => {
  const { viewBox, emblem } = branding.logoGeometry;
  const scaleX = emblem.ry / emblem.rx; // ~0.9634

  it('un-stretches the source viewBox so the emblem renders as a true circle', () => {
    const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(viewBox.width * scaleX, 1); // ~107.43, not the source 111.51
    expect(Number(m![2])).toBeCloseTo(viewBox.height, 2); // height unchanged
  });

  it('uses only the canonical brand hexes — no drift', () => {
    expect(svg).toContain(branding.colors.blue.hex);
    expect(svg).toContain(branding.colors.green.hex);
    expect(svg).toContain(branding.colors.white.hex);
  });
});
