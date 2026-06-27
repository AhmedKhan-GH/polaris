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

test.describe("discard draft", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD to run this suite.",
  );

  test("discarding a draft removes it from the kanban", async ({ page }) => {
    await login(page);

    await expect(draftedColumn(page)).toBeVisible();

    const beforeText = await draftedCount(page).textContent();
    const before = Number(beforeText ?? "0");

    await page.getByRole("button", { name: "Draft", exact: true }).click();

    await expect(draftedCount(page)).toHaveText(String(before + 1), {
      timeout: 10_000,
    });

    await draftedColumn(page).locator(".overflow-y-auto button").first().click();

    const sidebar = page.locator("aside");
    await expect(sidebar).toHaveAttribute("aria-hidden", "false", {
      timeout: 5_000,
    });

    const discardBtn = sidebar.getByRole("button", {
      name: "Discard",
      exact: true,
    });
    await expect(discardBtn).toBeEnabled({ timeout: 10_000 });
    await discardBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Discard", exact: true })
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Discard is terminal — sidebar should close
    await expect(sidebar).toHaveAttribute("aria-hidden", "true", {
      timeout: 10_000,
    });

    // Drafted count should decrement back
    await expect(draftedCount(page)).toHaveText(String(before), {
      timeout: 10_000,
    });
  });
});
