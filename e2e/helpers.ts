import { expect, type Page } from '@playwright/test';

/**
 * Drive the real sign-in UI to a logged-in dashboard.
 *
 * This is the genuine browser flow — fill the email/password inputs and submit
 * the form — not a programmatic token injection, so journeys exercise the same
 * path a human would. The password comes from the committed `.env.test`
 * (`TEST_USER_PASSWORD`); the email defaults to the owner (`TEST_USER_EMAIL`)
 * but callers can pass `member@example.com` to sign in as the other seed user.
 */
export async function loginViaSupabase(
  page: Page,
  email: string = process.env.TEST_USER_EMAIL!,
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button:has-text("Sign in")');
  await expect(page).toHaveURL('/dashboard');
}
