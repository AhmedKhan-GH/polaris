'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getServerSupabase, getServiceRoleSupabase } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import { profiles, signInLog } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export interface LoginState {
  error?: string
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirm: z.string().min(6),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  })

function toObject(formData: FormData): Record<string, string> {
  const o: Record<string, string> = {}
  formData.forEach((v, k) => (o[k] = String(v)))
  return o
}

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = signInSchema.safeParse(toObject(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, password } = parsed.data
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    logger.warn({ email, reason: error.message }, 'login failed')
    return { error: error.message }
  }

  // Best-effort sign-in record (former recordSignIn). A DB outage must never
  // block login, so failures are swallowed.
  try {
    await db.insert(signInLog).values({ userId: data.user?.id ?? null, email })
  } catch (err) {
    logger.warn({ email, err }, 'failed to write sign_in_log')
  }

  logger.info({ email, userId: data.user?.id }, 'login succeeded')
  redirect('/dashboard')
}

export async function registerAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = registerSchema.safeParse(toObject(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { email, password } = parsed.data
  const admin = getServiceRoleSupabase()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) {
    logger.warn({ email, reason: error.message }, 'registration failed')
    return { error: error.message }
  }

  await db.insert(profiles).values({ id: data.user.id, email, role: 'member' })

  const supabase = await getServerSupabase()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError) {
    logger.error({ email, reason: signInError.message }, 'post-register sign-in failed')
    return { error: 'Account created but sign-in failed. Try signing in.' }
  }

  logger.info({ email, userId: data.user.id }, 'member account registered')
  redirect('/dashboard')
}

export async function signOutAction() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.auth.signOut()
  if (user) logger.info({ email: user.email, userId: user.id }, 'logout succeeded')
  redirect('/')
}
