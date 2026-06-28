// @vitest-environment node
//
// The weld that makes "single source that propagates" real: the globals.css
// @theme brand colors MUST equal lib/branding's canonical hexes. Change a token
// and forget the CSS (or vice versa) → this goes red. Reads the stylesheet as
// text (not an import), so it crosses no module boundary.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { branding } from '@/lib/branding';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

function brandVar(name: string): string | null {
  const m = css.match(new RegExp(`--color-brand-${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  return m ? m[1].toLowerCase() : null;
}

describe('globals.css @theme brand colors (welded to lib/branding)', () => {
  it('declares --color-brand-* matching the canonical hexes', () => {
    expect(brandVar('blue')).toBe(branding.colors.blue.hex);
    expect(brandVar('green')).toBe(branding.colors.green.hex);
    expect(brandVar('white')).toBe(branding.colors.white.hex);
  });
});
