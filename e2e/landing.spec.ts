import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * The public landing route, from both sides of the auth line. Anonymous visitors
 * get a "Log in" affordance into the sign-in route; authenticated visitors get a
 * "Dashboard" link back into the app. (The header's "Log out" affordance is
 * covered by login/logout specs.)
 */
test.describe('landing', () => {
  test('anonymous visitor can navigate to the login page', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("Log in")');
    await expect(page).toHaveURL('/login');
  });

  test('authenticated visitor sees a Dashboard link on the landing page', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.goto('/');
    await expect(page.locator('a:has-text("Dashboard")')).toBeVisible();
  });
});
