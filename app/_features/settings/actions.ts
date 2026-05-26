'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { getServiceRoleSupabase } from '@/lib/supabase/server'
import { withPermission } from '@/lib/permissions/guard'

const createAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
  role: z.enum(['owner', 'admin', 'member', 'guest']),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {}
  formData.forEach((value, key) => {
    obj[key] = String(value)
  })
  return obj
}

export async function createAccountAction(formData: FormData): Promise<{ error?: string }> {
  const parsed = createAccountSchema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  return withPermission('manage', 'Settings', async () => {
    const { email, password, role } = parsed.data

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
  })
}

export async function resetPasswordAction(formData: FormData): Promise<{ error?: string }> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  return withPermission('manage', 'Settings', async () => {
    const { userId, password } = parsed.data

    const supabase = getServiceRoleSupabase()

    const { error } = await supabase.auth.admin.updateUserById(userId, { password })

    if (error) {
      return { error: error.message }
    }

    return {}
  })
}
