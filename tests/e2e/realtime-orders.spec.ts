import { expect, test, type Page } from "@playwright/test";

// Two-context realtime proof of life. One browser observes the kanban,
// another creates a draft, and we assert the observer sees the Drafted
// column count tick up without reloading. Exercises the full wire:
// server action -> orders trigger -> order_status_counts update ->
// Supabase realtime publication -> WebSocket -> React Query cache ->
// KanbanColumnShell re-render.
//
// Prerequisites for this test to actually run:
//   1. `npm run dev:up` (local Supabase) is up.
//   2. The dev DB has an auth user matching E2E_TEST_EMAIL +
//      E2E_TEST_PASSWORD. Create one in the Supabase Studio Auth tab,
//      or via `supabase auth admin create-user` if scripted.
//   3. Both env vars are set when invoking `npm run test:e2e`.
// Without those, the test self-skips with a clear message.

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

// The Drafted column count is rendered as a <span> immediately after
// the column's <h2>Drafted</h2>. There is no semantic landmark linking
// them, so we walk the sibling axis to find it. This is brittle to
// markup changes in KanbanColumnShell; if that template moves the
// badge, update this locator.
function draftedCount(page: Page) {
  return page
    .getByRole("heading", { name: "Drafted", level: 2 })
    .locator('xpath=following-sibling::span[1]');
}

test.describe("realtime kanban", () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set E2E_TEST_EMAIL + E2E_TEST_PASSWORD with credentials for a user provisioned in local Supabase to run this suite.",
  );

  test("a draft created in one tab appears in another without reload", async ({
    browser,
  }) => {
    const observerCtx = await browser.newContext();
    const actorCtx = await browser.newContext();
    const observer = await observerCtx.newPage();
    const actor = await actorCtx.newPage();

    try {
      await login(observer);
      await login(actor);

      // Wait until both pages have the kanban mounted. The observer's
      // realtime subscription is set up in a useEffect once the orders
      // page mounts, so seeing the column heading is a reasonable
      // proxy for "subscribed and listening".
      await expect(
        observer.getByRole("heading", { name: "Drafted", level: 2 }),
      ).toBeVisible();
      await expect(
        actor.getByRole("heading", { name: "Drafted", level: 2 }),
      ).toBeVisible();

      // Give the WebSocket a moment to actually open after the page
      // settles. 500ms is empirical; Supabase typically connects in
      // <100ms locally but the heartbeat handshake is asynchronous.
      await observer.waitForTimeout(500);

      const beforeText = await draftedCount(observer).textContent();
      const before = Number(beforeText ?? "0");
      expect(Number.isFinite(before)).toBe(true);

      // Trigger the mutation in the actor tab. The "Draft" button is
      // the only one with that exact name on the page.
      await actor
        .getByRole("button", { name: "Draft", exact: true })
        .click();

      // Observer should see the count increment via realtime, no
      // reload. Generous timeout because the chain spans Postgres
      // replication + Supabase fan-out + React Query setQueryData.
      await expect(draftedCount(observer)).toHaveText(String(before + 1), {
        timeout: 10_000,
      });
    } finally {
      await observerCtx.close();
      await actorCtx.close();
    }
  });
});
