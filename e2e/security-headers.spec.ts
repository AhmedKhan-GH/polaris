import { test, expect } from '@playwright/test'

test('responses carry the baseline security headers', async ({ page }) => {
  const res = await page.goto('/')
  expect(res).not.toBeNull()
  const h = res!.headers()

  expect(h['x-frame-options']).toBe('DENY')
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(h['permissions-policy']).toContain('geolocation=()')
  // Framework fingerprint removed.
  expect(h['x-powered-by']).toBeUndefined()
})

test('CSP is present in report-only mode (observe, do not block yet)', async ({
  page,
}) => {
  const res = await page.goto('/')
  const h = res!.headers()

  expect(h['content-security-policy-report-only']).toContain(
    "default-src 'self'",
  )
  expect(h['content-security-policy-report-only']).toContain(
    "frame-ancestors 'none'",
  )
  // Not enforcing yet — the blocking header must be absent until deploy.
  expect(h['content-security-policy']).toBeUndefined()
})
