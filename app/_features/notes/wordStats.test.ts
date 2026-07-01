// Pure word-count helper for note metadata. No DOM, no I/O.
// Only wordCount is tested: it has real logic (blank -> 0, whitespace-collapsing
// split). charCount is a one-line `text.length` wrapper — a Tier-C stdlib wrapper,
// not a red-green subject (ADR-0010).
import { describe, expect, it } from 'vitest';

import { wordCount } from './wordStats';

describe('wordCount', () => {
  it('counts whitespace-delimited words', () => {
    expect(wordCount('hello world')).toBe(2);
    expect(wordCount('one\n\ntwo   three')).toBe(3);
    expect(wordCount('  spaced  out  ')).toBe(2);
  });

  it('treats empty or blank text as zero', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   \n\t ')).toBe(0);
  });
});
