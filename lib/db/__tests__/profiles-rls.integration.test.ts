import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { liveDbGate } from './live-db'

// profiles RLS uses auth.uid() and the `authenticated` role — both Supabase-only,
// absent from the plain-Postgres testcontainer harness. So this suite runs
// against the live local Supabase DB and self-skips if it isn't reachable
// (same contract as main's realtime E2E). Run `supabase start` first. In CI the
// e2e job sets CI_REQUIRE_LIVE_DB so an unreachable DB is a hard failure, not a
// silent skip (this is the only coverage of the auth.uid() RLS path).
const LIVE_DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const REQUIRE_LIVE = !!process.env.CI_REQUIRE_LIVE_DB

const MEMBER_A = '1a000000-0000-4000-8000-000000000001'
const MEMBER_B = '1b000000-0000-4000-8000-000000000002'
const OWNER = '10000000-0000-4000-8000-000000000003'

// Read profiles as the `authenticated` role with auth.uid() = `sub`, inside a
// rolled-back transaction so the GUC + role are scoped and seed data is left clean.
async function readProfilesAs(admin: pg.Pool, sub: string): Promise<string[]> {
  const client = await admin.connect()
  try {
    await client.query('begin')
    await client.query(`set local role authenticated`)
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub, role: 'authenticated' }),
    ])
    const { rows } = await client.query<{ id: string }>(`select id from profiles`)
    await client.query('rollback')
    return rows.map((r) => r.id)
  } finally {
    client.release()
  }
}

describe('profiles RLS (self OR owner)', () => {
  let admin: pg.Pool
  let reachable = false

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: LIVE_DB, connectionTimeoutMillis: 1500 })
    try {
      await admin.query('select 1')
      reachable = true
    } catch {
      reachable = false
    }
    // Hard-fail in CI (CI_REQUIRE_LIVE_DB) instead of silently skipping; only
    // seed when we are actually going to run.
    if (liveDbGate(reachable, REQUIRE_LIVE) === 'skip') return
    await admin.query(
      `insert into profiles (id, email, role) values
         ($1,'a@x.com','member'), ($2,'b@x.com','member'), ($3,'o@x.com','owner')
       on conflict (id) do update set role = excluded.role`,
      [MEMBER_A, MEMBER_B, OWNER],
    )
  }, 60_000)

  afterAll(async () => {
    if (reachable) {
      await admin.query(`delete from profiles where id = any($1::uuid[])`, [
        [MEMBER_A, MEMBER_B, OWNER],
      ])
    }
    await admin?.end()
  })

  it('a member sees only their own profile', async ({ skip }) => {
    if (!reachable) return skip()
    const seen = await readProfilesAs(admin, MEMBER_A)
    expect(seen).toContain(MEMBER_A)
    expect(seen).not.toContain(MEMBER_B)
    expect(seen).not.toContain(OWNER)
  })

  // Self-read only for now. An owner reading ALL profiles needs a non-recursive
  // policy (SECURITY DEFINER helper or JWT role claim) and lands with F9 user
  // management — until then even an owner sees only their own row.
  it('an owner sees only their own profile (owner-reads-all deferred to F9)', async ({
    skip,
  }) => {
    if (!reachable) return skip()
    const seen = await readProfilesAs(admin, OWNER)
    expect(seen).toContain(OWNER)
    expect(seen).not.toContain(MEMBER_A)
    expect(seen).not.toContain(MEMBER_B)
  })
})
