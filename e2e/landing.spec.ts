import { test, expect } from '@playwright/test'

test('unauthenticated user sees "Log in" in the header', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
})
