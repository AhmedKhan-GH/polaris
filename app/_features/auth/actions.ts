'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { log } from '@/lib/log'

export interface LoginState {
  error?: string
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  confirm: z.string().min(6),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match.',
  path: ['confirm'],
})

function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {}
  formData.forEach((value, key) => {
    obj[key] = String(value)
  })
  return obj
}

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = signInSchema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data
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
  const parsed = registerSchema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data

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

  await db.insert(profiles).values({ id: data.user.id, email, role: 'guest' })

  const supabase = await getServerSupabase()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    log.error({ email, reason: signInError.message }, 'post-register sign-in failed')
    return { error: 'Account created but sign-in failed. Try signing in.' }
  }

  log.info({ email, userId: data.user.id }, 'guest account registered and signed in')
  redirect('/apps')
}
