import { type Page, expect } from '@playwright/test'

// Drives the full Keycloak redirect login: click "Log in", authenticate on
// Keycloak's hosted page, land back on /dashboard. Defaults to the owner test
// user; pass an email to log in as a different seeded user (same dev password).
export async function loginViaKeycloak(
  page: Page,
  email: string = process.env.TEST_USER_EMAIL!,
) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in' }).click()

  // Now on Keycloak's login page (default theme field ids).
  await page.locator('#username').fill(email)
  await page.locator('#password').fill(process.env.TEST_USER_PASSWORD!)
  await page.locator('#kc-login').click()

  await expect(page).toHaveURL('/dashboard')
}
