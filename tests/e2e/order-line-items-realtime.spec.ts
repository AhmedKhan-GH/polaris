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
}

test.describe("realtime order line items", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD for a local Supabase user to run this suite.",
  );

  test("two tabs see collaborative line item edits", async ({ browser }) => {
    const observerCtx = await browser.newContext();
    const actorCtx = await browser.newContext();
    const observer = await observerCtx.newPage();
    const actor = await actorCtx.newPage();

    try {
      await login(observer);
      await login(actor);

      await actor.getByRole("button", { name: "Draft", exact: true }).click();
      const createdOrderButton = actor
        .getByRole("button")
        .filter({ hasText: /#?\d{7}/ })
        .first();
      await expect(createdOrderButton).toBeVisible({ timeout: 10_000 });
      const orderText = await createdOrderButton.textContent();
      const orderNumber = orderText?.match(/\d{7}/)?.[0] ?? null;

      expect(orderNumber).toBeTruthy();

      const orderButtonName = new RegExp(orderNumber!);
      await actor.getByRole("button", { name: orderButtonName }).click();
      await observer.getByRole("button", { name: orderButtonName }).click();

      await expect(actor.getByRole("heading", { name: "Line items" })).toBeVisible();
      await expect(observer.getByRole("heading", { name: "Line items" })).toBeVisible();

      const newSkuButton = actor.getByRole("button", { name: "New SKU" });
      await newSkuButton.scrollIntoViewIfNeeded();
      await expect(newSkuButton).toBeVisible();

      const sku = `E2E-${Date.now()}`;
      await actor.getByLabel("New SKU number").fill(sku);
      await actor.getByLabel("New SKU name").fill("Realtime test item");
      await actor.getByLabel("New SKU unit").fill("case");
      await newSkuButton.click();

      await actor.getByRole("combobox", { name: "SKU" }).fill(`${sku} - Realtime test item`);
      await actor.getByLabel("Quantity").fill("2");
      await actor.getByRole("textbox", { name: "Unit", exact: true }).fill("case");
      await actor.getByRole("button", { name: "Add" }).click();

      await expect(observer.getByText(sku)).toBeVisible({ timeout: 10_000 });

      await actor.getByLabel(`${sku} quantity`).fill("3");
      await actor.getByRole("button", { name: "Save" }).click();

      await expect(observer.getByLabel(`${sku} quantity`)).toHaveValue("3", {
        timeout: 10_000,
      });
    } finally {
      await observerCtx.close();
      await actorCtx.close();
    }
  });
});
