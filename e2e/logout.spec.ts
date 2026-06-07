import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('log out clears session and redirects to landing page', async ({ page }) => {
  await loginViaKeycloak(page)

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
