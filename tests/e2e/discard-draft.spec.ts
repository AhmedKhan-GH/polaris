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

test.describe("cancel draft", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("cancelling a draft removes it from the kanban", async ({ page }) => {
    await login(page);

    const draftHeading = page.getByRole("heading", {
      name: "Draft",
      level: 2,
    });
    await expect(draftHeading).toBeVisible();

    const beforeText = await draftCount(page).textContent();
    const before = Number(beforeText ?? "0");

    await page.getByRole("button", { name: "Draft", exact: true }).click();

    await expect(draftCount(page)).toHaveText(String(before + 1), {
      timeout: 10_000,
    });

    const draftColumn = draftHeading.locator(
      "xpath=ancestor::section[1]",
    );
    await draftColumn.locator(".overflow-y-auto button").first().click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    const cancelBtn = sidebar.getByRole("button", {
      name: "Cancel",
      exact: true,
    });
    await expect(cancelBtn).toBeEnabled({ timeout: 10_000 });
    await cancelBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Cancel is terminal — sidebar should close
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });

    // Draft count should decrement back
    await expect(draftCount(page)).toHaveText(String(before), {
      timeout: 10_000,
    });
  });
});
