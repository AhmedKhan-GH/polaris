import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(TEST_EMAIL!);
  await page.locator('input[name="password"]').fill(TEST_PASSWORD!);
  await Promise.all([
    page.waitForURL("/"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
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

async function createAndOpenDraft(page: Page) {
  await page.getByRole("button", { name: "Draft", exact: true }).click();

  const draftColumn = page
    .getByRole("heading", { name: "Draft", level: 2 })
    .locator("xpath=ancestor::section[1]");
  const firstCard = draftColumn.locator(".overflow-y-auto button").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
    timeout: 5_000,
  });
}

test.describe("cancellation paths", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("cancelling a confirmed order closes the sidebar", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Draft", level: 2 }),
    ).toBeVisible();

    await createAndOpenDraft(page);
    await confirmAction(page, "Confirm");

    // Sidebar stays open with confirmed-state buttons
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Cancel");

    // Cancelled is terminal — sidebar closes
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });

  test("cancelling a processing order closes the sidebar", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Draft", level: 2 }),
    ).toBeVisible();

    await createAndOpenDraft(page);
    await confirmAction(page, "Confirm");

    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("button", { name: "Process", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Process");

    await expect(
      sidebar.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Cancel");

    // Cancelled is terminal — sidebar closes
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });
});
