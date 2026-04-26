'use server'

import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
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
  redirect('/')
}
