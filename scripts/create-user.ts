import { createClient } from '@supabase/supabase-js'
import { db } from '../lib/db'
import { profiles } from '../lib/schema'
import { clientEnv, serverEnv } from '../lib/env'
import { log } from '../lib/log'
import type { UserRole } from '../lib/profile'

const VALID_ROLES: UserRole[] = ['system', 'owner', 'admin', 'member', 'guest']

async function main() {
  const [email, password, role] = process.argv.slice(2)

  if (!email || !password || !role) {
    console.error('Usage: npx tsx scripts/create-user.ts <email> <password> <role>')
    console.error(`Roles: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  if (!VALID_ROLES.includes(role as UserRole)) {
    console.error(`Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  const supabase = createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv!.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    log.error({ error: error.message }, 'failed to create auth user')
    process.exit(1)
  }

  await db.insert(profiles).values({ id: data.user.id, role: role as UserRole })

  log.info({ email, role, id: data.user.id }, 'user created')
  await db.$client.end()
}

main().catch((err) => {
  log.error({ err }, 'script failed')
  process.exit(1)
})
