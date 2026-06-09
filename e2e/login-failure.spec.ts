import { test, expect } from '@playwright/test'

test('invalid credentials show an inline error and stay on /login', async ({ page }) => {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill('nobody@example.com')
  await page.locator('input[name="password"]').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Server action returns an error state rendered above the form; no redirect.
  await expect(page).toHaveURL('/login')
  await expect(page.locator('text=/invalid/i')).toBeVisible()
})
