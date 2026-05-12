import { expect, test } from "@playwright/test";

test("shows error and stays on login page with wrong credentials", async ({
  page,
}) => {
  await page.goto("/login");

  await page.locator('input[name="email"]').fill("wrong@example.com");
  await page.locator('input[name="password"]').fill("WrongPassword123");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.locator("p.text-red-400")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});
