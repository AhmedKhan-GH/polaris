import { test, expect } from '@playwright/test'
import { Client } from 'pg'
import { loginViaSupabase } from './helpers'

// Verify via the admin connection: the app read path (app_user) is now
// owner-only RLS-gated, but this test asserts the *writer* recorded a row, so a
// bypass-RLS admin read is the correct probe.
async function db<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString:
      process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL,
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// Runtime regression guard for the sign_in_log bug class: a real login must
// write a row keyed by the *stable* Supabase user id (auth.users.id), not a
// random per-login id. The original (Auth.js) bug used a random user.id, so
// repeated logins yielded *distinct* user_ids. Asserting an invariant over the
// owner's own rows (one distinct, non-null user_id) guards against that class.
// global-setup truncates sign_in_log, so only this run's logins are present.
const OWNER_EMAIL = process.env.TEST_USER_EMAIL!

test('real logins record sign_in_log rows keyed by a stable, non-null Supabase user id', async ({
  page,
}) => {
  await loginViaSupabase(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')
  await loginViaSupabase(page)

  // events.signIn writes asynchronously — poll until the owner's rows settle.
  await expect
    .poll(
      async () => {
        const { rows } = await db((c) =>
          c.query(
            `select count(*)::int as total,
                    count(distinct user_id)::int as distinct_users,
                    bool_and(user_id is not null) as all_set
             from sign_in_log
             where email = $1`,
            [OWNER_EMAIL],
          ),
        )
        return rows[0]
      },
      { timeout: 8000 },
    )
    // >= 1 row (the event fired), exactly one distinct non-null user_id (stable sub).
    .toMatchObject({ distinct_users: 1, all_set: true })
})
