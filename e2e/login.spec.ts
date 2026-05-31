import { test, expect } from '@playwright/test'

test('login with valid credentials redirects to /dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!)
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('login with invalid credentials shows error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('wrong@example.com')
  await page.getByLabel('Password').fill('wrongpassword')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Invalid login credentials')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('login with empty fields shows validation errors', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Valid email is required')).toBeVisible()
  await expect(page.getByText('Password is required')).toBeVisible()
})
