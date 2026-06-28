import { describe, expect, it } from 'vitest';

import { normalizeDollarInput } from './money';

// A money input should "snap" to a fixed two-decimal display on blur, the way
// financial apps do — never showing a bare integer or a third decimal. The rule
// must round to the nearest cent the SAME way the server does
// (`Math.round(dollars * 100)`), so the box shows exactly what will be stored.
describe('normalizeDollarInput', () => {
  it('pads a whole-dollar entry to two decimals (12 → 12.00)', () => {
    expect(normalizeDollarInput('12')).toBe('12.00');
  });

  it('keeps a single-decimal entry as two decimals (12.5 → 12.50)', () => {
    expect(normalizeDollarInput('12.5')).toBe('12.50');
  });

  it('rounds a third decimal up to the nearest cent (12.999 → 13.00)', () => {
    expect(normalizeDollarInput('12.999')).toBe('13.00');
  });

  it('rounds a third decimal down to the nearest cent (12.994 → 12.99)', () => {
    expect(normalizeDollarInput('12.994')).toBe('12.99');
  });

  it('tolerates surrounding whitespace', () => {
    expect(normalizeDollarInput('  7.1 ')).toBe('7.10');
  });

  it('returns null for a blank entry so the caller can leave it untouched', () => {
    expect(normalizeDollarInput('')).toBeNull();
    expect(normalizeDollarInput('   ')).toBeNull();
  });

  it('returns null for a non-numeric entry', () => {
    expect(normalizeDollarInput('abc')).toBeNull();
  });
});
