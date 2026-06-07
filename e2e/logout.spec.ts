import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('log out clears the app session and redirects to landing page', async ({ page }) => {
  await loginViaKeycloak(page)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})

test('log out ends the Keycloak SSO session so re-login requires credentials', async ({ page }) => {
  await loginViaKeycloak(page)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  // If only the app cookie were cleared, clicking Log in would silently pass
  // back through Keycloak's still-active SSO session straight to /dashboard.
  // A real logout means Keycloak shows its login form again.
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.locator('#username')).toBeVisible()
  await expect(page).not.toHaveURL('/dashboard')
})
