import { type Page, expect } from '@playwright/test'

// Drives the app-hosted Supabase login: go to /login, fill the email/password
// form, land on /dashboard. Defaults to the owner test user; pass an email to log
// in as a different seeded user (same dev password).
export async function loginViaSupabase(
  page: Page,
  email: string = process.env.TEST_USER_EMAIL!,
) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dashboard')
}
