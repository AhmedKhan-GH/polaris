import { expect, test } from '@playwright/test';
import pg from 'pg';

import { loginViaSupabase } from './helpers';

/**
 * Orders intake + lifecycle, end to end against the live local stack.
 *
 * Proves the role split the CASL + RLS + state-machine layers enforce, through
 * the real pages: a contractor (member) records, merges-on-duplicate, and
 * confirms their OWN order but cannot process it; the office (admin) sees every
 * order (read-all) and drives a submitted one through to completion.
 *
 * Each test is INDEPENDENT: `beforeEach` truncates orders so a retry (or a prior
 * test) never leaks state, and the admin test SEEDS its own submitted order
 * rather than depending on the member test. The product is seeded once and
 * cleaned up, so this suite never pollutes the products-table counts.
 */
const SKU = 'SKU-OE2E';
const PRODUCT_LABEL = 'Order E2E Widget ($5.00)';
let pool: pg.Pool;
let productId: string;

test.beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });
  await pool.query(
    `insert into products (name, sku, price_cents) values ('Order E2E Widget', $1, 500)
       on conflict (sku) do nothing`,
    [SKU],
  );
  productId = (await pool.query('select id from products where sku = $1', [SKU]))
    .rows[0].id;
});

test.beforeEach(async () => {
  // Clean orders before every test so each one is self-contained (retry-safe).
  await pool.query('TRUNCATE order_lines, orders');
});

test.afterAll(async () => {
  await pool.query('TRUNCATE order_lines, orders');
  await pool.query('delete from products where sku = $1', [SKU]);
  await pool.end();
});

test.describe('orders intake + lifecycle', () => {
  test('a contractor records an order, adds a duplicate-SKU line, and confirms it', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/orders');
    await expect(page.getByTestId('order-row')).toHaveCount(0);

    await page.getByRole('button', { name: 'New order' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    await expect(page.getByTestId('order-status')).toHaveText('draft');

    // Add a line; the total uses the snapshot price (500c × 3 = $15.00).
    // `exact: true` — once a line exists, its inline edit field is also labelled
    // "Quantity for <product>", which a substring match would collide with.
    await page.getByLabel('Product').selectOption({ label: PRODUCT_LABEL });
    await page.getByLabel('Quantity', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Add line' }).click();
    await expect(page.getByTestId('line-row')).toHaveCount(1);
    await expect(page.getByTestId('line-row').getByText('$15.00')).toBeVisible();

    // Re-adding the SAME product appends a SECOND line (no merge) — duplicate
    // SKUs are allowed, each line its own row/price.
    await page.getByLabel('Product').selectOption({ label: PRODUCT_LABEL });
    await page.getByLabel('Quantity', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Add line' }).click();
    await expect(page.getByTestId('line-row')).toHaveCount(2);

    // A member can submit but NEVER process.
    await expect(page.getByRole('button', { name: 'Process' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('submitted');
    await expect(page.getByRole('button', { name: 'Process' })).toHaveCount(0);
  });

  test('the office (admin) sees a submitted order and processes it to completion', async ({
    page,
  }) => {
    // Seed a submitted order owned by some user (created_by is a bare uuid; the
    // admin reads ALL orders) so this test never depends on the member test.
    const orderId = (
      await pool.query(
        `insert into orders (created_by, status) values (gen_random_uuid(), 'submitted') returning id`,
      )
    ).rows[0].id;
    await pool.query(
      `insert into order_lines (order_id, product_id, quantity, unit_price_cents)
         values ($1, $2, 2, 500)`,
      [orderId, productId],
    );

    await loginViaSupabase(page, 'admin@example.com');
    await page.goto('/orders');

    // Read-all: the order is visible to the admin even though they don't own it.
    await expect(page.getByTestId('order-row')).toHaveCount(1);
    await page.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('submitted');

    await page.getByRole('button', { name: 'Process' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('processing');

    await page.getByRole('button', { name: 'Complete' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('completed');
  });

  test('a contractor can cancel their own draft', async ({ page }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/orders');
    await page.getByRole('button', { name: 'New order' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('draft');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('cancelled');
  });
});
