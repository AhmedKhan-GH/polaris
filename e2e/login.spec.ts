import { expect, test } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * Sign-in happy path plus the proxy's protected-route gate. The helper already
 * asserts the post-login URL is `/dashboard`; here we additionally confirm the
 * authenticated chrome (the "Log out" button) is present, and that an anonymous
 * hit to a protected route is bounced to `/login`.
 */
test.describe('login', () => {
  test('valid credentials land on an authenticated dashboard', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await expect(page.locator('button:has-text("Log out")')).toBeVisible();
  });

  test('anonymous visit to /dashboard is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
