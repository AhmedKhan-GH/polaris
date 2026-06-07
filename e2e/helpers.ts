import { type Page, expect } from '@playwright/test'

// Drives the full Keycloak redirect login: click "Log in", authenticate on
// Keycloak's hosted page with the seeded test user, land back on /dashboard.
export async function loginViaKeycloak(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log in' }).click()

  // Now on Keycloak's login page (default theme field ids).
  await page.locator('#username').fill(process.env.TEST_USER_EMAIL!)
  await page.locator('#password').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('#kc-login').click()

  await expect(page).toHaveURL('/dashboard')
}
