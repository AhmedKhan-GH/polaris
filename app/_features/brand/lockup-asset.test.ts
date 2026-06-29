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
    expect(svg).toContain(branding.colors.green.hex); // #67953f — emblem disc
  });
});

// The COLOR lockups PAINT the sprout solid white (Color, On dark) — the green disc is the
// brand mark, so its sprout is real white ink. The one-color forms (Black, White) punch
// the sprout OUT instead (own describe) — a one-color mark takes the sprout from the ground.
describe('the color lockups carry a solid white sprout (filled, not a knockout)', () => {
  const read = (publicPath: string) => {
    const file = join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  };

  it('Color: green disc + solid white sprout + blue wordmark', () => {
    const s = read(branding.lockup.src);
    expect(s).toContain('#67953f'); // green disc
    expect(s).toContain('#fff'); // solid white sprout
    expect(s).toContain('#00447c'); // blue wordmark
  });

  it('On dark: green disc + solid white sprout + white wordmark (no blue)', () => {
    const s = read(branding.lockup.onDark);
    expect(s).toContain('#67953f'); // emblem stays in brand green
    expect(s).toContain('#fff'); // white sprout + white wordmark
    expect(s).not.toContain('#00447c'); // the wordmark is reversed to white, not blue
  });

});

describe('the one-color lockups are punchouts (disc with the sprout knocked out)', () => {
  const read = (publicPath: string) => {
    const file = join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  };

  it('Black: black only — black disc + black wordmark, sprout transparent (not painted white)', () => {
    const s = read(branding.lockup.black);
    expect(s).toContain('#000'); // black disc + black wordmark
    expect(s).not.toContain('#fff'); // sprout is punched out (transparent), not white
    expect(s).not.toContain('#67953f'); // no green
    expect(s).not.toContain('#00447c'); // no blue
  });

  it('White: white only — white disc + white wordmark, sprout transparent (not painted black)', () => {
    const s = read(branding.lockup.white);
    expect(s).toContain('#fff'); // white disc + white wordmark
    expect(s).not.toContain('#000'); // sprout is punched out (transparent), not black
    expect(s).not.toContain('#67953f'); // no green
    expect(s).not.toContain('#00447c'); // no blue
  });
});
