'use server'

import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { getProfile } from '@/lib/profile'
import { getServiceRoleSupabase } from '@/lib/supabase/server'

export async function createOwnerAction(formData: FormData): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'sysadmin') {
    return { error: 'Forbidden' }
  }

  const email = formData.get('email') as string | null
  const password = formData.get('password') as string | null

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  const supabase = getServiceRoleSupabase()

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) {
    return { error: error.message }
  }

  await db.insert(profiles).values({ id: data.user.id, role: 'owner' })

  return {}
}
