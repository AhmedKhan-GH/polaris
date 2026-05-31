import { test, expect } from '@playwright/test'

test('login with valid credentials redirects to /dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})
