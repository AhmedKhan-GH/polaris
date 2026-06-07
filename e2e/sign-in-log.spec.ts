import { test, expect } from '@playwright/test'
import { Client } from 'pg'
import { loginViaKeycloak } from './helpers'

async function db<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// The runtime regression guard for the sign_in_log bug: a real Keycloak login
// must write a row keyed by the *stable* Keycloak sub. The original bug used
// Auth.js's user.id, which is random per login — two logins would yield two
// distinct user_ids. Logging in twice and asserting a single, non-null user_id
// reproduces that bug class automatically (and catches events.signIn not firing).
test('real logins record sign_in_log rows keyed by a stable, non-null Keycloak sub', async ({
  page,
}) => {
  await db((c) => c.query('delete from sign_in_log'))

  await loginViaKeycloak(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL('/')
  await loginViaKeycloak(page)

  // events.signIn writes asynchronously — poll until both logins are recorded.
  await expect
    .poll(
      async () => {
        const { rows } = await db((c) =>
          c.query(
            `select count(*)::int as total,
                    count(distinct user_id)::int as distinct_users,
                    bool_and(user_id is not null) as all_set
             from sign_in_log`,
          ),
        )
        return rows[0]
      },
      { timeout: 8000 },
    )
    .toEqual({ total: 2, distinct_users: 1, all_set: true })
})
