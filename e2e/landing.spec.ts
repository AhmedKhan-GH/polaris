import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('clicking "Log in" in the header goes straight to Keycloak', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/realms\/polaris\/protocol\/openid-connect\/auth/)
})

test('authenticated user sees "Dashboard" link on landing', async ({ page }) => {
  await loginViaKeycloak(page)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
})
