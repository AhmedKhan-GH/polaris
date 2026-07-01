import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * The app-navigation burger — the dashboard chrome's primary wayfinding,
 * reachable from every page (it replaced the history-based back button). These
 * journeys prove the whole seam end to end: the dashboard layout builds the
 * caller's ability, filters the registry nav through `visibleNavItems`, and feeds
 * it to the header's `NavMenu`, whose drawer navigates. The permission path is
 * asserted here (owner sees the gated Activity entry, a member does not) rather
 * than re-stubbed at the unit level, because the layout is zero-logic composition
 * proven only end to end.
 */
test.describe('app navigation menu', () => {
  test('the burger opens the app nav from any page and navigates', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.goto('/orders');

    // The old history-based back button is gone.
    await expect(page.getByRole('button', { name: /back/i })).toHaveCount(0);

    await page.getByRole('button', { name: /open navigation/i }).click();
    const drawer = page.getByRole('dialog', { name: /navigation/i });
    await expect(drawer).toBeVisible();

    await drawer.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test('an owner sees the gated Activity entry in the drawer', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.goto('/orders');

    await page.getByRole('button', { name: /open navigation/i }).click();
    await expect(
      page.getByRole('dialog').getByRole('link', { name: 'Activity' }),
    ).toBeVisible();
  });

  test('a member sees ungated entries but not the gated Activity entry', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/orders');

    await page.getByRole('button', { name: /open navigation/i }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(
      drawer.getByRole('link', { name: 'Activity' }),
    ).toHaveCount(0);
  });
});
