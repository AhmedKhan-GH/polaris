import { test, expect } from '@playwright/test'

test('log out clears session and redirects to landing page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard')

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')

  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
