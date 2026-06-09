import { test, expect } from '@playwright/test'
import { loginViaSupabase } from './helpers'

test('log out clears the app session and redirects to the landing page', async ({ page }) => {
  await loginViaSupabase(page)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})

test('after logout, reaching the app again requires credentials', async ({ page }) => {
  await loginViaSupabase(page)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  // Session cleared: visiting a protected route lands on the login form, not the
  // dashboard (no lingering SSO session as there was with Keycloak).
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
  await expect(page.locator('input[name="password"]')).toBeVisible()
})
