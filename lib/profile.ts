import { eq } from 'drizzle-orm'
import { db } from './db'
import { profiles } from './schema'
import { getServerSupabase } from './supabase/server'

export type UserRole = 'system' | 'owner' | 'admin' | 'member' | 'guest'

export interface Profile {
  id: string
  role: UserRole
  createdAt: number
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)

  return row ?? null
}

