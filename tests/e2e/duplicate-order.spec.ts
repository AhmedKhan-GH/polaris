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

function draftCount(page: Page) {
  return page
    .getByRole("heading", { name: "Draft", level: 2 })
    .locator("xpath=following-sibling::span[1]");
}

test.describe("duplicate order", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("duplicating a confirmed order creates a new draft", async ({
    page,
  }) => {
    await login(page);

    const draftHeading = page.getByRole("heading", {
      name: "Draft",
      level: 2,
    });
    await expect(draftHeading).toBeVisible();

    // Create and confirm an order so we have a non-draft to duplicate
    await page.getByRole("button", { name: "Draft", exact: true }).click();

    const draftColumn = draftHeading.locator(
      "xpath=ancestor::section[1]",
    );
    const firstCard = draftColumn.locator(".overflow-y-auto button").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    // Confirm the draft
    const confirmBtn = sidebar.getByRole("button", {
      name: "Confirm",
      exact: true,
    });
    await expect(confirmBtn).toBeEnabled({ timeout: 10_000 });
    await confirmBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Wait for sidebar to show the confirmed-state buttons
    await expect(
      sidebar.getByRole("button", { name: "Process", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // Record draft count before duplicating
    const beforeText = await draftCount(page).textContent();
    const before = Number(beforeText ?? "0");

    // Click Duplicate
    const duplicateBtn = sidebar.getByRole("button", {
      name: "Duplicate",
      exact: true,
    });
    await expect(duplicateBtn).toBeEnabled({ timeout: 10_000 });
    await duplicateBtn.click();

    const dupDialog = page.getByRole("dialog");
    await expect(dupDialog).toBeVisible();
    await dupDialog
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    await expect(dupDialog).not.toBeVisible({ timeout: 10_000 });

    // The duplicate creates a new draft — count should increment
    await expect(draftCount(page)).toHaveText(String(before + 1), {
      timeout: 10_000,
    });
  });
});
