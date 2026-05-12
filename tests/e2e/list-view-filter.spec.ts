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

test.describe("list view filtering", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("switching to list view and toggling status filter", async ({
    page,
  }) => {
    await login(page);

    // Switch to list view
    const listTab = page.getByRole("tab", { name: "List" });
    await expect(listTab).toBeVisible();
    await listTab.click();
    await expect(listTab).toHaveAttribute("aria-selected", "true");

    // The list table should be visible
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Open the status filter dropdown
    const statusButton = page
      .getByRole("button", { name: /Status/ })
      .first();
    await statusButton.click();

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // Uncheck all active statuses by clicking "Reset filters" first
    // to get to default, then uncheck each default one.
    // Instead, let's check that the checkboxes exist for key statuses.
    const draftedCheckbox = menu.getByRole("checkbox", {
      name: /drafted/i,
    });
    const submittedCheckbox = menu.getByRole("checkbox", {
      name: /submitted/i,
    });

    await expect(draftedCheckbox).toBeVisible();
    await expect(submittedCheckbox).toBeVisible();

    // Uncheck drafted (it's checked by default as an active status)
    if (await draftedCheckbox.isChecked()) {
      await draftedCheckbox.click();
    }

    // Close the dropdown by clicking the status button again
    await statusButton.click();
    await expect(menu).not.toBeVisible();

    // The filter badge should reflect the change
    // Re-open and verify drafted is unchecked
    await statusButton.click();
    const reopenedMenu = page.getByRole("menu");
    await expect(reopenedMenu).toBeVisible();

    const draftedAfter = reopenedMenu.getByRole("checkbox", {
      name: /drafted/i,
    });
    await expect(draftedAfter).not.toBeChecked();

    // Reset filters back to default
    await reopenedMenu.getByRole("button", { name: /Reset/i }).click();
    await expect(draftedAfter).toBeChecked();
  });
});
