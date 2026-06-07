import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('unauthenticated user sees "Log in" in the header', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
})

test('authenticated user sees "Dashboard" link on landing', async ({ page }) => {
  await loginViaKeycloak(page)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
})
