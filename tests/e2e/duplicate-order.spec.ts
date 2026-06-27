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

function draftedCount(page: Page) {
  return draftedColumn(page)
    .getByText("DRAFTED")
    .locator("xpath=following-sibling::span[1]");
}

function draftedColumn(page: Page) {
  return page.locator('section[aria-label="Drafted"]');
}

test.describe("duplicate order", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("duplicating a submitted order creates a new draft", async ({
    page,
  }) => {
    await login(page);

    await expect(draftedColumn(page)).toBeVisible();

    const initialDraftCount = Number((await draftedCount(page).textContent()) ?? "0");

    // Create and submit an order so we have a non-draft to duplicate
    await page.getByRole("button", { name: "Draft", exact: true }).click();

    const firstCard = draftedColumn(page).locator(".overflow-y-auto button").first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    await firstCard.click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    // Submit the draft
    const submitBtn = sidebar.getByRole("button", {
      name: "Submit",
      exact: true,
    });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Wait for sidebar to show the submitted-state buttons
    await expect(
      sidebar.getByRole("button", { name: "Invoice", exact: true }),
    ).toBeVisible({ timeout: 10_000 });

    // The submitted source left the Drafted column; wait for that realtime
    // count before asserting the duplicate adds a fresh draft.
    await expect(draftedCount(page)).toHaveText(String(initialDraftCount), {
      timeout: 10_000,
    });

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
    await expect(draftedCount(page)).toHaveText(String(initialDraftCount + 1), {
      timeout: 10_000,
    });
  });
});
