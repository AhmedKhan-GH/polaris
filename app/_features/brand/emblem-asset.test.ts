// @vitest-environment node
//
// The standalone emblem assets must match the canonical mark. The one-color BLACK
// emblem is a SOLID figure-ground — a black disc with the sprout painted white —
// not a knockout (a knockout's leaf is a transparent hole that only reads white on
// a white ground). We weld the durable fills that survive an Illustrator re-export:
// the master is a green disc + solid white sprout; the black recolor swaps only the
// disc to black and keeps the sprout solid white.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

const read = (publicPath: string) => {
  const file = join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

// Match either spelling of a hex fill (e.g. #fff and #ffffff are the same white).
const hasFill = (svg: string, hex: string) => {
  const short = hex.length === 7 ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
  return svg.includes(hex) || svg.includes(short);
};

describe('the standalone emblem assets', () => {
  it('master emblem (Color) is a green disc with a solid white sprout', () => {
    const svg = read(branding.logo.src);
    expect(hasFill(svg, branding.colors.green.hex)).toBe(true); // #67953f disc
    expect(hasFill(svg, '#ffffff')).toBe(true); // solid white sprout
  });

  it('one-color Black emblem is a black-disc PUNCHOUT — the sprout is knocked out, not painted white', () => {
    const svg = read(branding.logo.black);
    expect(hasFill(svg, '#000000')).toBe(true); // black disc
    expect(hasFill(svg, '#ffffff')).toBe(false); // sprout is punched out (transparent), never white
    expect(hasFill(svg, branding.colors.green.hex)).toBe(false); // not the green master
  });

  it('reversed White emblem is a white-disc PUNCHOUT — the sprout is knocked out, not painted black', () => {
    const svg = read(branding.logo.white);
    expect(hasFill(svg, '#ffffff')).toBe(true); // white disc
    expect(hasFill(svg, '#000000')).toBe(false); // sprout is punched out (transparent), never black
    expect(hasFill(svg, branding.colors.green.hex)).toBe(false); // not the green master
  });
});

describe('the standalone leaf asset', () => {
  it('ships white (default), black, and green sprouts — solid fills', () => {
    expect(hasFill(read(branding.leaf.src), '#ffffff')).toBe(true); // white (for dark)
    expect(hasFill(read(branding.leaf.black), '#000000')).toBe(true); // black (light grounds)
    expect(hasFill(read(branding.leaf.green), branding.colors.green.hex)).toBe(true); // brand green
  });
});
