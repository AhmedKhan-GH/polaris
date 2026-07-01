// Pure word-count helper for note metadata. No DOM, no I/O.
import { describe, expect, it } from 'vitest';

import { charCount, wordCount } from './identity';

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

describe('charCount', () => {
  it('counts every character, whitespace included', () => {
    expect(charCount('hello')).toBe(5);
    expect(charCount('hello world')).toBe(11);
  });

  it('is zero for the empty string', () => {
    expect(charCount('')).toBe(0);
  });
});
