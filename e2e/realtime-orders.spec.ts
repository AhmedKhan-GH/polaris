import { expect, test, type Page } from '@playwright/test'
import { loginViaSupabase } from './helpers'

// Per-user realtime delivery: an order created by one user appears live in that
// user's tab and NOT in another user's tab. Uses the two seeded users (owner +
// member); each subscribes only to their own private topic (orders:<uid>).
const OWNER = process.env.TEST_USER_EMAIL!
const MEMBER = 'member@example.com'

async function gotoOrders(page: Page, email: string) {
  await loginViaSupabase(page, email)
  await page.goto('/orders')
}

test('a new order appears live for its owner, not for another user', async ({
  browser,
}) => {
  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  try {
    await gotoOrders(a, OWNER)
    await gotoOrders(b, MEMBER)

    const beforeA = await a.getByTestId('order-row').count()
    const beforeB = await b.getByTestId('order-row').count()

    await a.getByRole('button', { name: 'New order' }).click()

    // A sees its own new row appear live (no reload)
    await expect
      .poll(() => a.getByTestId('order-row').count())
      .toBeGreaterThan(beforeA)

    // B must NOT receive A's order over realtime
    await b.waitForTimeout(2000)
    expect(await b.getByTestId('order-row').count()).toBe(beforeB)
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
