// @vitest-environment node
//
// Security-headers contract (lib/security-headers). This is the single source
// of truth for the response headers that next.config.ts attaches to every
// route, so the test pins the EXACT set: the six keys, in no particular order,
// each with its exact value — no more, no fewer.
//
// Two properties matter beyond the literal values:
//   1. The CSP is deliberately *Report-Only* (realtime later adds
//      `connect-src wss://`; we flip to an enforcing policy + nonce at deploy).
//      So we assert the enforcing `Content-Security-Policy` key is ABSENT.
//   2. The policy still carries its load-bearing directives — `default-src
//      'self'` and `frame-ancestors 'none'` — so report-only mode is
//      meaningfully scoped even before enforcement.

import { describe, expect, it } from 'vitest';

import { securityHeaders } from './security-headers';

// The exact contract, as a key→value map. Kept here (not imported) so the test
// is an independent restatement of the spec, not a tautology against the source.
const EXPECTED: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy-Report-Only':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; " +
    "font-src 'self'; connect-src 'self'; object-src 'none'; " +
    "base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

describe('lib/security-headers', () => {
  it('exposes an array of { key, value } entries', () => {
    expect(Array.isArray(securityHeaders)).toBe(true);
    for (const entry of securityHeaders) {
      expect(typeof entry.key).toBe('string');
      expect(typeof entry.value).toBe('string');
    }
  });

  it('contains exactly the six expected keys — no more, no fewer', () => {
    const keys = securityHeaders.map((h) => h.key).sort();
    expect(keys).toEqual(Object.keys(EXPECTED).sort());
    // No duplicate keys.
    expect(new Set(keys).size).toBe(securityHeaders.length);
  });

  it('maps every key to its exact value', () => {
    const actual = Object.fromEntries(securityHeaders.map((h) => [h.key, h.value]));
    expect(actual).toEqual(EXPECTED);
  });

  it('ships a Report-Only CSP and no enforcing Content-Security-Policy', () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy-Report-Only');
    expect(keys).not.toContain('Content-Security-Policy');
  });

  it('keeps the load-bearing CSP directives even in report-only mode', () => {
    const csp = securityHeaders.find(
      (h) => h.key === 'Content-Security-Policy-Report-Only',
    )?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
