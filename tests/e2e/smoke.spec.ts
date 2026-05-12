import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in" }),
  ).toBeEnabled();
});
