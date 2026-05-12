import { eq } from 'drizzle-orm'
import { db } from './db'
import { profiles } from './schema'
import { getServerSupabase } from './supabase/server'

export type UserRole = 'owner' | 'admin' | 'member' | 'guest'

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

export async function requireOwner(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') {
    throw new Error('Forbidden: owner role required')
  }
  return profile
}
