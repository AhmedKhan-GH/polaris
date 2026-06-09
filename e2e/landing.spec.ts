import { test, expect } from '@playwright/test'
import { loginViaSupabase } from './helpers'

test('clicking "Log in" in the header goes to /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/login')
})

test('authenticated user sees "Dashboard" link on landing', async ({ page }) => {
  await loginViaSupabase(page)

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
})
