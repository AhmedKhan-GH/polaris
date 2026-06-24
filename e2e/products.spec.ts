import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * The products catalog, end to end against the live local stack. These journeys
 * are ORDER-DEPENDENT (like the activity suite) and SHARE state: global-setup
 * truncates `products` once at the start of the run, so each test builds on the
 * prior one's rows. Playwright runs serially here (workers: 1, fullyParallel:
 * false), so this ordering holds.
 *
 * Together they prove the role split the CASL + RLS layers enforce, surfaced
 * through the real page: an owner manages the catalog (create + retire), a
 * member reads it but sees NO management controls, and the nav link is ungated
 * (everyone sees it).
 */
test.describe('products catalog', () => {
  test('owner starts empty and adds a product', async ({ page }) => {
    await loginViaSupabase(page);
    await page.goto('/products');

    await expect(page.getByTestId('product-row')).toHaveCount(0);

    await page.getByLabel('Product name').fill('Test Widget');
    await page.getByLabel('SKU').fill('SKU-100');
    await page.getByLabel('Price (cents)').fill('1500');
    await page.getByRole('button', { name: 'Add product' }).click();

    const row = page.getByTestId('product-row');
    await expect(row).toHaveCount(1);
    // Owner manages the catalog, so name and price are inline-editable inputs
    // (price shown in dollars); SKU and status stay plain text.
    await expect(row.getByLabel('Name for SKU-100')).toHaveValue('Test Widget');
    await expect(row.getByText('SKU-100')).toBeVisible();
    await expect(row.getByLabel('Price for SKU-100')).toHaveValue('15.00');
    await expect(row.getByText('Active')).toBeVisible();
  });

  test('member reads the catalog but sees no management controls', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/products');

    // Read-all: the owner's product is visible to the member.
    await expect(page.getByTestId('product-row')).toHaveCount(1);
    await expect(page.getByText('Test Widget')).toBeVisible();

    // No owner-only controls: no create form, no row actions.
    await expect(page.getByRole('button', { name: 'Add product' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retire' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('owner retires the product (soft delete) and the controls disappear', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.goto('/products');

    await page.getByRole('button', { name: 'Retire' }).click();

    const row = page.getByTestId('product-row');
    await expect(row).toHaveCount(1); // still listed, not deleted
    await expect(row.getByText('Retired')).toBeVisible();
    // A retired row exposes no further controls.
    await expect(page.getByRole('button', { name: 'Retire' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('the dashboard shows the ungated Products link for any user', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');

    const link = page.getByRole('link', { name: 'Products' });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/products$/);
  });
});
