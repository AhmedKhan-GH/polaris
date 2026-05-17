'use server'

import { redirect } from 'next/navigation'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { log } from '@/lib/log'

export interface LoginState {
  error?: string
}

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    log.warn({ email, reason: error.message }, 'login failed')
    return { error: error.message }
  }
  log.info({ email, userId: data.user?.id }, 'login succeeded')
  redirect('/apps')
}

export async function registerAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const confirm = String(formData.get('confirm'))

  if (password !== confirm) {
    return { error: 'Passwords do not match.' }
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }

  const admin = getServiceRoleSupabase()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    log.warn({ email, reason: error.message }, 'registration failed')
    return { error: error.message }
  }

  await db.insert(profiles).values({ id: data.user.id, role: 'guest' })

  const supabase = await getServerSupabase()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    log.error({ email, reason: signInError.message }, 'post-register sign-in failed')
    return { error: 'Account created but sign-in failed. Try signing in.' }
  }

  log.info({ email, userId: data.user.id }, 'guest account registered and signed in')
  redirect('/apps')
}
