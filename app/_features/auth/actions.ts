'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import { signInLog } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export interface LoginState {
  error?: string
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

// No registration here — login + logout only. This is an internal tool; accounts
// are created out-of-band (Supabase admin/dashboard today; invite-code
// provisioning lands at F9). There is no in-app account-creation code path.

export async function signOutAction() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.auth.signOut()
  if (user) logger.info({ email: user.email, userId: user.id }, 'logout succeeded')
  redirect('/')
}
