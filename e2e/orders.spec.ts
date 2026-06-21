import { expect, test } from '@playwright/test';
import pg from 'pg';

import { loginViaSupabase } from './helpers';

/**
 * The orders catalog + line-item intake, end to end against the live local
 * stack. ORDER-DEPENDENT and serial (workers: 1): the member's order created in
 * the first test is read by the owner in the second.
 *
 * This suite seeds (and cleans up) its OWN product directly via the admin
 * connection rather than the shared global-setup, so it never pollutes the
 * products-table counts that the products suite asserts — it leaves that table
 * exactly as it found it.
 */
const SKU = 'SKU-OE2E';
const PRODUCT_LABEL = 'Order E2E Product ($5.00)';
let pool: pg.Pool;

test.beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });
  await pool.query(
    `insert into products (name, sku, price_cents) values ('Order E2E Product', $1, 500)
       on conflict (sku) do nothing`,
    [SKU],
  );
});

test.afterAll(async () => {
  // Restore the products table to pre-suite state; orders/lines are run-scoped.
  await pool.query('TRUNCATE order_line_items, orders');
  await pool.query('delete from products where sku = $1', [SKU]);
  await pool.end();
});

test.describe('orders catalog', () => {
  test('a rep creates an order and adds a product line', async ({ page }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/orders');

    await expect(page.getByTestId('order-row')).toHaveCount(0);

    await page.getByRole('button', { name: 'New order' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);

    // No lines yet, then add one.
    await expect(page.getByTestId('line-row')).toHaveCount(0);
    await page.getByLabel('Product').selectOption({ label: PRODUCT_LABEL });
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Add line' }).click();

    const row = page.getByTestId('line-row');
    await expect(row).toHaveCount(1);
    await expect(row.getByText('Order E2E Product')).toBeVisible();
    await expect(row.getByText('$15.00')).toBeVisible(); // 500c × 3
  });

  test('an owner sees the rep’s order (read-all) but cannot edit it', async ({
    page,
  }) => {
    await loginViaSupabase(page); // owner (default)
    await page.goto('/orders');

    // Owner reads all orders, so the member's order is visible.
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open' }).click();

    // Owner can view the line but sees NO edit controls (not their order).
    await expect(page.getByTestId('line-row')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Add line' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });

  test('the dashboard shows the ungated Orders link for any user', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');

    const link = page.getByRole('link', { name: 'Orders' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/orders$/);
  });
});
