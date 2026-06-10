import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * Sign-out must terminate the session, not just navigate. After clicking
 * "Log out" we return to the landing page; a follow-up hit to `/dashboard` is
 * then bounced to `/login` by the proxy — proof the session is gone, not merely
 * that the URL changed. The second test sharpens that into a positive assertion:
 * the login form's password input is actually rendered after the bounce.
 */
test.describe('logout', () => {
  test('logging out ends the session and reprotects the dashboard', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.click('button:has-text("Log out")');
    await expect(page).toHaveURL('/');

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('after logout the dashboard bounce shows the login form (no lingering session)', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.click('button:has-text("Log out")');
    await expect(page).toHaveURL('/');

    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});
