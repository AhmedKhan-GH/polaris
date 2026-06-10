import { expect, test, type Page } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * Wait until the page's Supabase realtime channel has finished joining (the
 * Phoenix `phx_reply` with `status: "ok"`), so a broadcast emitted right after is
 * actually received. Broadcast has no replay, and the suite acts in
 * milliseconds, so without this the create can outrun the subscribe handshake.
 * A generous race-fallback keeps an unparsable transport from hanging the test.
 */
async function waitForRealtimeSubscribed(page: Page): Promise<void> {
  const joined = page
    .waitForEvent('websocket', (ws) => ws.url().includes('/realtime/'))
    .then((ws) =>
      ws
        .waitForEvent('framereceived', (frame) => {
          const data = typeof frame.payload === 'string' ? frame.payload : '';
          return data.includes('phx_reply') && data.includes('"status":"ok"');
        })
        .then(() => undefined),
    )
    .catch(() => undefined);
  await Promise.race([joined, page.waitForTimeout(4000)]);
}

/**
 * Realtime delivery + cross-user isolation, end to end against the live stack.
 *
 * Two independent browser contexts log in as DIFFERENT users:
 *  - A = member@example.com, watching their own page (subscribed to
 *    `notes:{member}`).
 *  - B = owner@example.com, watching their own page (subscribed to
 *    `notes:{owner}` — NOT the firehose; the island subscribes to the per-user
 *    topic only).
 *
 * When A creates a note, A's list grows WITHOUT a reload — proof the private
 * broadcast topic delivers live (the M4 trigger → `notes:{member}` → A's
 * subscription). B, subscribed to a different topic, receives nothing live: its
 * count is unchanged after a wait. That isolation is enforced at the
 * subscription layer (which topic each page joins), the dual of the
 * channel-layer policy proven in the integration suite.
 *
 * State note: this file runs after notes.spec in the same Playwright invocation
 * (global-setup truncates `notes` once), so we CAPTURE each context's starting
 * count rather than asserting absolutes.
 */
test('a live note reaches the author but not a different user watching another topic', async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await loginViaSupabase(pageA, 'member@example.com');
    await loginViaSupabase(pageB); // owner (default)

    // Arm the subscription waits BEFORE navigating, then go: each page must have
    // joined its channel before A creates, so A receives its broadcast and B's
    // "received nothing" is a real isolation result (B IS subscribed — to a
    // different topic — not merely not-yet-connected).
    const subA = waitForRealtimeSubscribed(pageA);
    const subB = waitForRealtimeSubscribed(pageB);
    await pageA.goto('/notes');
    await pageB.goto('/notes');
    await Promise.all([subA, subB]);

    // Snapshot the starting counts (state inherited from notes.spec in this run).
    const countA = await pageA.getByTestId('note-row').count();
    const countB = await pageB.getByTestId('note-row').count();

    // A creates a note. Its own page subscribes to `notes:{member}`, so the row
    // arrives via broadcast — no reload.
    await pageA.getByLabel('Note body').fill('live ping');
    await pageA.getByRole('button', { name: 'New note' }).click();

    await expect
      .poll(async () => pageA.getByTestId('note-row').count())
      .toBe(countA + 1);
    await expect(pageA.getByText('live ping')).toBeVisible();

    // B watches a DIFFERENT topic (`notes:{owner}`), so the member's note is not
    // delivered live. Give realtime ample time to (not) arrive, then assert B's
    // count is unchanged and B never saw the row without a reload.
    await pageB.waitForTimeout(2000);
    expect(await pageB.getByTestId('note-row').count()).toBe(countB);
    await expect(pageB.getByText('live ping')).toHaveCount(0);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
