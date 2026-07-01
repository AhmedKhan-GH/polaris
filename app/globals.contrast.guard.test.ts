// The Polaris Interface System promises WCAG AA (4.5:1) for body text on every
// ground it can land on, in BOTH themes. Contrast is relational — a tone that
// clears `surface` can still fail on the slightly lighter `surface-alt` — so this
// reads the shipped tokens straight from globals.css and checks each text/ground
// pair by measured ratio. A CI drift-guard (ADR-0010): a Tier-C token subject with
// real a11y regression risk — run once in CI, not a per-edit red-green driver.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

/** The `--name: #hex;` custom properties declared in one CSS rule block. */
function tokens(selector: string): Record<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no ${selector} block in globals.css`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const themes = { light: tokens(':root'), dark: tokens('\\.dark') };

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every (text tone, ground) pair body text can form, plus the action/status text.
const grounds = ['surface', 'surface-alt', 'bg'] as const;
const tones = ['ink', 'ink-muted', 'ink-faint'] as const;
const pairs: Array<[string, string]> = [
  ...tones.flatMap((t) => grounds.map((g) => [t, g] as [string, string])),
  ['accent-text', 'surface'],
  ['accent-fg', 'accent'],
  ...(['success', 'warning', 'danger'] as const).flatMap(
    (s) => [[s, `${s}-soft`], [s, 'surface']] as Array<[string, string]>,
  ),
];

describe.each(Object.entries(themes))('%s theme — WCAG AA (4.5:1) text contrast', (_theme, t) => {
  it.each(pairs)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
