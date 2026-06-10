import { expect, test, type Page } from '@playwright/test';

import { loginViaSupabase } from './helpers';

/**
 * Wait until the page's Supabase realtime channel has finished joining, so a
 * broadcast emitted right after is actually received.
 *
 * Live rows arrive via broadcast, which has NO replay: a message sent before the
 * channel is SUBSCRIBED is lost forever. A real user's reading/typing delay hides
 * this, but the suite acts in milliseconds, so on a freshly-loaded (empty) page
 * the create can outrun the subscribe handshake. We watch the realtime websocket
 * for the Phoenix `phx_reply` with `status: "ok"` that confirms the join, with a
 * generous fallback so a transport we can't parse never hangs the test.
 */
async function waitForRealtimeSubscribed(page: Page): Promise<void> {
  const joined = page
    .waitForEvent('websocket', (ws) => ws.url().includes('/realtime/'))
    .then((ws) =>
      ws
        .waitForEvent('framereceived', (frame) => {
          const data =
            typeof frame.payload === 'string' ? frame.payload : '';
          return data.includes('phx_reply') && data.includes('"status":"ok"');
        })
        .then(() => undefined),
    )
    .catch(() => undefined);
  // Cap the wait: if the socket/frame never matches (e.g. a transport change),
  // fall through after a settle rather than stall the whole suite.
  await Promise.race([joined, page.waitForTimeout(4000)]);
}

/**
 * The notes page, end to end against the live local stack. These journeys are
 * ORDER-DEPENDENT (like the activity suite) and SHARE state: global-setup
 * truncates `notes` once at the start of the run, so each test builds on the
 * rows the previous one created. Playwright runs serially here (workers: 1,
 * fullyParallel: false), so this ordering holds.
 *
 * Together they prove the same per-user visibility the CASL + RLS layers enforce,
 * surfaced through the real page: a member writes and sees only their own note,
 * the owner sees ALL notes (owner read-all), and the member still sees only
 * theirs. The final test proves the ungated dashboard nav link.
 */
test.describe('notes page', () => {
  test('member starts empty, creates a note, and sees it appear', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    const subscribed = waitForRealtimeSubscribed(page);
    await page.goto('/notes');

    // Fresh run: the member has no notes yet.
    await expect(page.getByTestId('note-row')).toHaveCount(0);

    // The new row arrives via the member's own broadcast topic; wait for the
    // channel to be joined first so the broadcast isn't missed.
    await subscribed;
    await page.getByLabel('Note body').fill('first note');
    await page.getByRole('button', { name: 'New note' }).click();

    await expect(page.getByTestId('note-row')).toHaveCount(1);
    await expect(page.getByText('first note')).toBeVisible();
  });

  test('owner sees the member note and, after adding one, sees both (read-all)', async ({
    page,
  }) => {
    await loginViaSupabase(page);
    await page.goto('/notes');

    // Owner reads ALL notes, so the member's note from the prior test is visible.
    await expect(page.getByTestId('note-row')).toHaveCount(1);
    await expect(page.getByText('first note')).toBeVisible();

    await page.getByLabel('Note body').fill('owner note');
    await page.getByRole('button', { name: 'New note' }).click();

    await expect(page.getByTestId('note-row')).toHaveCount(2);
    await expect(page.getByText('owner note')).toBeVisible();
  });

  test('member still sees ONLY their own note (ownership scoping)', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');
    await page.goto('/notes');

    // The owner's note is NOT visible to the member: own-rows only.
    await expect(page.getByTestId('note-row')).toHaveCount(1);
    await expect(page.getByText('first note')).toBeVisible();
    await expect(page.getByText('owner note')).toHaveCount(0);
  });

  test('the dashboard shows the ungated Notes link for any user', async ({
    page,
  }) => {
    await loginViaSupabase(page, 'member@example.com');

    const link = page.getByRole('link', { name: 'Notes' });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/notes$/);
  });
});
