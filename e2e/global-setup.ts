import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

// Prepares the live local Supabase for the E2E run: migrate the DB (idempotent —
// same migrations as prod) and seed the owner + member test users via the GoTrue
// admin API, each with a matching profiles row + role.
//
// NOTE: unlike the former Keycloak setup, this targets the RUNNING local Supabase
// (`supabase start`) — Supabase Auth E2E needs GoTrue + the auth schema, which a
// throwaway plain-Postgres container can't provide. Requires .env.test to carry
// the real local Supabase keys (see .env.test.example) and DATABASE_URL/
// MIGRATE_DATABASE_URL pointed at the Supabase Postgres (:54322).
export default async function globalSetup() {
  const adminUrl = process.env.MIGRATE_DATABASE_URL
  const appUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !appUrl) throw new Error('DATABASE_URL/MIGRATE_DATABASE_URL not set (.env.test)')
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase URL/service-role key not set (.env.test)')

  // Migrate as the privileged admin, then make app_user the app's LOGIN role.
  const pool = new pg.Pool({ connectionString: adminUrl })
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const app = new URL(appUrl)
    await pool.query(`ALTER ROLE "${app.username}" WITH LOGIN PASSWORD '${app.password}'`)
    // E2E runs against the persistent local Supabase DB (not a throwaway), so
    // reset the test-owned tables to a clean slate each run. Specs assert exact
    // row counts and a single stable sign-in user_id — both require a fresh start.
    // (auth.users + profiles keep the seeded users; only app data is cleared.)
    await pool.query('TRUNCATE orders, sign_in_log')
  } finally {
    await pool.end()
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await seedUser(admin, adminUrl, process.env.TEST_USER_EMAIL!, process.env.TEST_USER_PASSWORD!, 'owner')
  await seedUser(admin, adminUrl, 'member@example.com', process.env.TEST_USER_PASSWORD!, 'member')
}

// Idempotent: create the auth user (ignore "already exists"), upsert the profile.
async function seedUser(
  admin: SupabaseClient,
  adminUrl: string,
  email: string,
  password: string,
  role: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  let userId = data?.user?.id
  if (error && !/already.*registered|exists/i.test(error.message)) throw error
  if (!userId) {
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users.find((u) => u.email === email)?.id
  }
  if (!userId) throw new Error(`could not resolve seeded user id for ${email}`)

  const pool = new pg.Pool({ connectionString: adminUrl })
  try {
    await pool.query(
      `insert into profiles (id, email, role) values ($1,$2,$3)
       on conflict (id) do update set role = excluded.role`,
      [userId, email, role],
    )
  } finally {
    await pool.end()
  }
}
