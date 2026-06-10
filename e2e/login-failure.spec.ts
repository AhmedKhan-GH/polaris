import { expect, test } from '@playwright/test';

/**
 * Bad credentials must NOT navigate anywhere. The form posts a Server Action,
 * GoTrue rejects it, and the action returns `{ error }` for the form to render —
 * so the URL stays on `/login` and an "invalid" message becomes visible. This is
 * the raw form (no helper), since the helper asserts a successful redirect.
 */
test('invalid credentials stay on /login and surface an error', async ({
  page,
}) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'nobody@example.com');
  await page.fill('input[name="password"]', 'wrong-password');
  await page.click('button:has-text("Sign in")');

  await expect(page).toHaveURL('/login');
  await expect(page.locator('text=/invalid/i')).toBeVisible();
});
