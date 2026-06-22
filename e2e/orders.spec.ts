import { expect, test } from '@playwright/test';
import pg from 'pg';

import { loginViaSupabase } from './helpers';

/**
 * Orders intake + lifecycle, end to end against the live local stack. ORDER-
 * DEPENDENT and serial (workers: 1): the member's order created and submitted in
 * the first test is processed by the admin in the second.
 *
 * Proves the role split the CASL + RLS + state-machine layers enforce, through
 * the real pages: a contractor (member) records and confirms their OWN order but
 * cannot process it; the office (admin) sees every order (read-all) and drives it
 * through processing to completion.
 *
 * Seeds (and cleans up) its OWN product via the admin connection so it never
 * pollutes the products-table counts the products suite asserts.
 */
const SKU = 'SKU-OE2E';
const PRODUCT_LABEL = 'Order E2E Widget ($5.00)';
let pool: pg.Pool;

test.beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });
  await pool.query(
    `insert into products (name, sku, price_cents) values ('Order E2E Widget', $1, 500)
       on conflict (sku) do nothing`,
    [SKU],
  );
});

test.afterAll(async () => {
  await pool.query('TRUNCATE order_lines, orders');
  await pool.query('delete from products where sku = $1', [SKU]);
  await pool.end();
});

test.describe('orders intake + lifecycle', () => {
  test('a contractor records an order, adds a line, and confirms it', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/orders');
    await expect(page.getByTestId('order-row')).toHaveCount(0);

    await page.getByRole('button', { name: 'New order' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    await expect(page.getByTestId('order-status')).toHaveText('draft');

    // Add a line; the total uses the snapshot price (500c × 3 = $15.00).
    await page.getByLabel('Product').selectOption({ label: PRODUCT_LABEL });
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Add line' }).click();

    const row = page.getByTestId('line-row');
    await expect(row).toHaveCount(1);
    await expect(row.getByText('$15.00')).toBeVisible();

    // A member can submit but NEVER process.
    await expect(page.getByRole('button', { name: 'Process' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('submitted');
    await expect(page.getByRole('button', { name: 'Process' })).toHaveCount(0);
  });

  test('the office (admin) sees the order and processes it to completion', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'admin@example.com');
    await page.goto('/orders');

    // Read-all: the member's order is visible to the admin.
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('submitted');

    await page.getByRole('button', { name: 'Process' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('processing');

    await page.getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('completed');
  });
});
