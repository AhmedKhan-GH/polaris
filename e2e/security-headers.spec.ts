import { expect, test } from '@playwright/test';

/**
 * The hardening headers must be present on a real HTTP response from the running
 * app (not just asserted against the static `securityHeaders` array in a unit
 * test). We read them off the navigation response for `/`: the framework banner
 * is suppressed, the CSP is still Report-Only (so the enforcing header is
 * absent), and the usual anti-clickjacking / anti-sniffing controls are set.
 */
test('security headers are present on a live response', async ({ page }) => {
  const res = await page.goto('/');
  expect(res).not.toBeNull();
  const headers = res!.headers();

  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('geolocation=()');
  expect(headers['x-powered-by']).toBeUndefined();

  expect(headers['content-security-policy-report-only']).toContain(
    "default-src 'self'",
  );
  expect(headers['content-security-policy-report-only']).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers['content-security-policy']).toBeUndefined();
});
