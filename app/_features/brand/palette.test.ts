// @vitest-environment node
//
// The Interface System palette (palette.ts) is DOCUMENTATION that must not drift
// from the running theme: every tone's light/dark hex is welded to the matching
// globals.css custom property (:root / .dark), exactly like theme.test welds the
// brand hexes. Every text/status pair it presents is re-checked for WCAG AA with
// the same contrast helper the Brand page uses to label swatches.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { contrastRatio } from './contrast';
import { interfacePalette, statusMarkers } from './palette';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

/** The `--name: #hex;` custom properties declared in one CSS rule block. */
function block(selector: string): Record<string, string> {
  const m = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
  if (!m) throw new Error(`no ${selector} block in globals.css`);
  const out: Record<string, string> = {};
  for (const d of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[d[1]] = d[2].toLowerCase();
  return out;
}
const root = block(':root');
const dark = block('\\.dark');

const tones = interfacePalette.flatMap((g) => g.tones);

describe('interface palette welded to globals.css', () => {
  it.each(tones)('$token matches the :root and .dark tokens', (t) => {
    expect(t.light.toLowerCase()).toBe(root[t.token]);
    expect(t.dark.toLowerCase()).toBe(dark[t.token]);
  });

  it.each(statusMarkers)('$token (and its -soft) matches the tokens', (s) => {
    expect(s.light.toLowerCase()).toBe(root[s.token]);
    expect(s.dark.toLowerCase()).toBe(dark[s.token]);
    expect(s.lightSoft.toLowerCase()).toBe(root[`${s.token}-soft`]);
    expect(s.darkSoft.toLowerCase()).toBe(dark[`${s.token}-soft`]);
  });
});

describe('documented pairs clear WCAG AA', () => {
  it('the contrast helper is correct (black on white = 21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  const textTones = interfacePalette.find((g) => g.group === 'Text')!.tones;
  it.each(textTones)('$token text reads on surface in both themes', (t) => {
    expect(contrastRatio(t.light, root.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t.dark, dark.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(statusMarkers)('$token chip text reads on its soft fill', (s) => {
    expect(contrastRatio(s.light, s.lightSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(s.dark, s.darkSoft)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('the palette documents the header brand line', () => {
  it('includes the sky (light) / indigo (dark) brand-line tokens', () => {
    const tokens = interfacePalette.flatMap((g) => g.tones).map((t) => t.token);
    expect(tokens).toContain('brand-line');
    expect(tokens).toContain('brand-line-soft');
  });
});
