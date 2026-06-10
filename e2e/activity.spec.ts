import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * The activity (sign-in log) viewer, end to end against the live local stack.
 * This is the first feature wired through BOTH composition roots, so these
 * journeys prove the whole chain: the owner-only ability (registry) gates both
 * the page and the dashboard nav link, while a member is bounced and sees no
 * link at all. Owner-sees / member-doesn't emerges from the registry + ability —
 * it is asserted here rather than re-stubbed at the unit level.
 */
test.describe('activity viewer', () => {
  test('owner can open the sign-in log and sees the table', async ({ page }) => {
    await loginViaSupabase(page);

    await page.goto('/activity');

    await expect(
      page.getByRole('heading', { name: /sign-in log/i }),
    ).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('member is redirected from /activity to the dashboard', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');

    await page.goto('/activity');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('owner sees the Activity link on the dashboard and can follow it', async ({
    page,
  }) => {
    await loginViaSupabase(page);

    const link = page.getByRole('link', { name: 'Activity' });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/activity$/);
  });

  test('member does not see the Activity link on the dashboard', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');

    await expect(page.getByRole('link', { name: 'Activity' })).toHaveCount(0);
  });
});
