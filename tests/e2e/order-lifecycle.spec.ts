import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(TEST_EMAIL!);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD!);
  await Promise.all([
    page.waitForURL("**/apps"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.goto("/orders");
  await page.getByRole("tab", { name: "Board" }).click();
}

async function confirmAction(page: Page, label: string) {
  const sidebar = page.locator("aside");
  const actionBtn = sidebar.getByRole("button", { name: label, exact: true });
  await expect(actionBtn).toBeEnabled({ timeout: 10_000 });
  await actionBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: label, exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
}

test.describe("order lifecycle", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("draft -> submit -> invoice -> close -> archive", async ({ page }) => {
    await login(page);

    const draftedColumn = page.locator('section[aria-label="Drafted"]');
    await expect(draftedColumn).toBeVisible();

    await page.getByRole("button", { name: "Draft", exact: true }).click();

    const firstCard = draftedColumn.locator(".overflow-y-auto button").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    await confirmAction(page, "Submit");
    await confirmAction(page, "Invoice");
    await confirmAction(page, "Close");
    await confirmAction(page, "Archive");

    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });
});
