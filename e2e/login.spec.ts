import { test, expect } from '@playwright/test'
import { loginViaKeycloak } from './helpers'

test('clicking Log in redirects to the Keycloak login page', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/realms\/polaris\/protocol\/openid-connect\/auth/)
})

test('login via Keycloak with valid credentials reaches /dashboard', async ({ page }) => {
  await loginViaKeycloak(page)
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})

test('authenticated user visiting /login is redirected to /dashboard', async ({ page }) => {
  await loginViaKeycloak(page)
  await page.goto('/login')
  await expect(page).toHaveURL('/dashboard')
})
