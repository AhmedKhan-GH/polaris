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

  const draftedColumn = page
    .getByRole("heading", { name: "Drafted", level: 2 })
    .locator("xpath=ancestor::section[1]");
  const firstCard = draftedColumn.locator(".overflow-y-auto button").first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
    timeout: 5_000,
  });
}

test.describe("reject and void paths", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("rejecting a submitted order closes the sidebar", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Drafted", level: 2 }),
    ).toBeVisible();

    await createAndOpenDraft(page);
    await confirmAction(page, "Submit");

    // Sidebar stays open with submitted-state buttons
    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("button", { name: "Reject", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Reject");

    // Rejected is terminal — sidebar closes
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });

  test("voiding an invoiced order closes the sidebar", async ({ page }) => {
    await login(page);
    await expect(
      page.getByRole("heading", { name: "Drafted", level: 2 }),
    ).toBeVisible();

    await createAndOpenDraft(page);
    await confirmAction(page, "Submit");

    const sidebar = page.locator("aside");
    await expect(
      sidebar.getByRole("button", { name: "Invoice", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Invoice");

    await expect(
      sidebar.getByRole("button", { name: "Void", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    await confirmAction(page, "Void");

    // Voided is terminal — sidebar closes
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });
  });
});
