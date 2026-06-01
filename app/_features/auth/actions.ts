'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db/client'
import { signInLog } from '@/lib/db/schema'

const SignInSchema = z.object({
  email: z.email({ error: 'Valid email is required' }),
  password: z.string().min(1, { error: 'Password is required' }),
})

export type AuthState = {
  errors?: {
    email?: string[]
    password?: string[]
    form?: string[]
  }
}

export async function signInAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { errors: { form: [error.message] } }
  }

  const { data: { user } } = await supabase.auth.getUser()

  try {
    await db.insert(signInLog).values({
      userId: user!.id,
      createdAt: Math.floor(Date.now() / 1000),
    })
  } catch {
    // Sign-in succeeds even if logging fails
  }

  redirect('/dashboard')
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
