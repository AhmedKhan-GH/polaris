import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

// Runs against the fresh ephemeral E2E DB (orders empty at start). Proves the
// REAL Keycloak-session → CASL/RLS wiring end-to-end (what mocked-session
// integration tests can't). Tests are ordered and share the run's DB.

test('a signed-in user can create an order and see it', async ({ page }) => {
  await loginViaKeycloak(page) // owner@example.com
  await page.goto('/orders')

  await expect(page.getByTestId('order-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'New order' }).click()
  await expect(page.getByTestId('order-row')).toHaveCount(1)
})

test("a non-owner sees only their own orders, not another user's", async ({
  page,
}) => {
  await loginViaKeycloak(page, 'member@example.com')
  await page.goto('/orders')

  // The owner's order from the previous test is invisible to this member.
  await expect(page.getByTestId('order-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'New order' }).click()
  await expect(page.getByTestId('order-row')).toHaveCount(1)
})

test('the owner sees all orders', async ({ page }) => {
  await loginViaKeycloak(page) // owner@example.com
  await page.goto('/orders')

  // Owner sees their own order + the member's order.
  await expect(page.getByTestId('order-row')).toHaveCount(2)
})

test('the dashboard links to orders for any signed-in user', async ({ page }) => {
  await loginViaKeycloak(page, 'member@example.com') // non-owner

  const link = page.getByRole('link', { name: 'Orders' })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL('/orders')
})
