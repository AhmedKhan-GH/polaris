import { createClient } from '@supabase/supabase-js'
import { drizzle } from 'drizzle-orm/node-postgres'
import { config } from 'dotenv'
import { profiles } from '../lib/schema'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const DATABASE_URL = process.env.DATABASE_URL!

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: npx tsx scripts/bootstrap-owner.ts <email> <password>')
  process.exit(1)
}

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    console.error('Failed to create auth user:', error.message)
    process.exit(1)
  }

  console.log(`Auth user created: ${data.user.id} (${email})`)

  const db = drizzle(DATABASE_URL)
  await db.insert(profiles).values({ id: data.user.id, role: 'owner' })
  console.log(`Profile created with role: owner`)

  await db.$client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
