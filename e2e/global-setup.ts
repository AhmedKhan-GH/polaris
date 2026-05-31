import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const testEmail = process.env.TEST_USER_EMAIL!
const testPassword = process.env.TEST_USER_PASSWORD!

export default async function globalSetup() {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing } = await supabase.auth.admin.listUsers()
  const testUser = existing?.users?.find((u) => u.email === testEmail)

  if (!testUser) {
    const { error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to seed test user: ${error.message}`)
  }
}
