import { test, expect } from '@playwright/test'
import { loginViaSupabase } from './helpers'

test('clicking Log in on the landing page goes to /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/login')
})

test('login with valid credentials reaches /dashboard', async ({ page }) => {
  await loginViaSupabase(page)
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
