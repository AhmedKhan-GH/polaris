import { expect, test } from '@playwright/test';
import pg from 'pg';

import { loginViaSupabase } from './helpers';

/**
 * Time-based UI preferences (ADR-0009), end to end against the live local stack.
 *
 * The top-bar controls are PER ACCOUNT: switching 24h → 12h and changing the zone
 * re-format every rendered timestamp server-side (the action upserts the row and
 * revalidates the shell), and the choice survives a fresh navigation because it is
 * stored on the account, not the browser. A single order is seeded at a FIXED
 * instant so the rendered string is deterministic across zone/clock changes.
 *
 * `user_preferences` is truncated before each test so every run starts at the
 * UTC + 24h default.
 */
let pool: pg.Pool;

const FIXED = '2026-01-01T12:00:00Z'; // noon UTC — 07:00 EST in New York

test.beforeAll(async () => {
  pool = new pg.Pool({ connectionString: process.env.MIGRATE_DATABASE_URL });
});

test.beforeEach(async () => {
  await pool.query('TRUNCATE order_lines, orders');
  await pool.query('TRUNCATE user_preferences');
  await pool.query(
    `insert into orders (created_by, status, created_at)
       values (gen_random_uuid(), 'draft', $1)`,
    [FIXED],
  );
});

test.afterAll(async () => {
  await pool.query('TRUNCATE order_lines, orders');
  await pool.query('TRUNCATE user_preferences');
  await pool.end();
});

test.describe('time preferences', () => {
  test('toggle + zone re-format timestamps and persist per account', async ({
    page,
  }) => {
    await loginViaSupabase(page); // owner reads all orders
    await page.goto('/orders');

    // Default for a fresh account: UTC + 24h.
    await expect(page.getByTestId('order-created')).toHaveText(
      '2026-01-01 · 12:00:00',
    );

    // 24h -> 12h: the same instant gains a PM marker.
    await page
      .getByRole('group', { name: 'Time format' })
      .getByRole('button', { name: '12h' })
      .click();
    await expect(page.getByTestId('order-created')).toHaveText(
      '2026-01-01 · 12:00:00 PM',
    );

    // Change zone to New York (EST, UTC-5): 12:00 UTC reads 07:00, still 12h.
    await page
      .getByRole('combobox', { name: 'Time zone' })
      .selectOption('America/New_York');
    await expect(page.getByTestId('order-created')).toHaveText(
      '2026-01-01 · 07:00:00 AM',
    );

    // Stored on the ACCOUNT, not the device: a fresh navigation keeps zone + 12h.
    await page.goto('/orders');
    await expect(page.getByTestId('order-created')).toHaveText(
      '2026-01-01 · 07:00:00 AM',
    );
  });
});
