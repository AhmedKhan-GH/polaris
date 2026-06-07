import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('owner can view the sign-in log at /activity', async ({ page }) => {
  await loginViaKeycloak(page) // owner@example.com (TEST_USER_EMAIL)

  await page.goto('/activity')

  await expect(page.getByRole('heading', { name: /sign-in log/i })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
})

test('a member cannot view the sign-in log', async ({ page }) => {
  await loginViaKeycloak(page, 'member@example.com')

  await page.goto('/activity')

  // Non-owner is redirected away — no log, no table.
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('owner sees an Activity link on the dashboard that opens /activity', async ({
  page,
}) => {
  await loginViaKeycloak(page) // lands on /dashboard as owner

  const link = page.getByRole('link', { name: 'Activity' })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL('/activity')
})

test('member does not see an Activity link on the dashboard', async ({ page }) => {
  await loginViaKeycloak(page, 'member@example.com')

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('link', { name: 'Activity' })).toHaveCount(0)
})
