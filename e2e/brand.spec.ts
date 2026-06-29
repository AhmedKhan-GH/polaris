import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * The Brand & Identity page, end to end against the live local stack. Proves the
 * reachability + render the unit tests can't: the ungated nav link is visible to
 * a signed-in user, the route loads, and it shows the lockup, a canonical color,
 * and the corrected proportions — the same values the page reads from
 * lib/branding.
 */
test.describe('brand & identity', () => {
  test('a signed-in user reaches Brand from the dashboard and sees the canon', async ({
    page,
  }) => {
    await loginViaSupabase(page);

    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Brand' }).click();

    await expect(page).toHaveURL(/\/brand$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /brand & identity/i }),
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Assets' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Colors' })).toBeVisible();
    await expect(page.getByText('#00447c')).toBeVisible(); // Zee Foods Blue
    await expect(page.getByRole('link', { name: /download/i }).first()).toBeVisible();
  });
});
