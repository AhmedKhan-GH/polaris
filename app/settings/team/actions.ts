'use server'

import { ForbiddenError } from '@casl/ability'
import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { getProfile, type UserRole } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'
import { getServiceRoleSupabase } from '@/lib/supabase/server'

const ALLOWED_ROLES: UserRole[] = ['owner', 'admin', 'member', 'guest']

export async function createAccountAction(formData: FormData): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthenticated' }

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('manage', 'Settings')) {
    return { error: 'Forbidden' }
  }

  const email = formData.get('email') as string | null
  const password = formData.get('password') as string | null
  const confirmPassword = formData.get('confirmPassword') as string | null
  const role = formData.get('role') as UserRole | null

  if (!email || !password || !confirmPassword || !role) {
    return { error: 'Email, password, and role are required' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return { error: 'Invalid role' }
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

  await db.insert(profiles).values({ id: data.user.id, role })

  return {}
}

export async function resetPasswordAction(formData: FormData): Promise<{ error?: string }> {
  const profile = await getProfile()
  if (!profile) return { error: 'Unauthenticated' }

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('manage', 'Settings')) {
    return { error: 'Forbidden' }
  }

  const userId = formData.get('userId') as string | null
  const password = formData.get('password') as string | null
  const confirmPassword = formData.get('confirmPassword') as string | null

  if (!userId || !password || !confirmPassword) {
    return { error: 'User and password are required' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  const supabase = getServiceRoleSupabase()

  const { error } = await supabase.auth.admin.updateUserById(userId, { password })

  if (error) {
    return { error: error.message }
  }

  return {}
}
