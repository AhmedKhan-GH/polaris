import { getServerSupabase } from '@/lib/supabase/server'

export type SessionUser = {
  userId: string
  email: string | null
  roles: string[]
}

// The single identity resolver — replaces NextAuth's auth(). Reads the user from
// the Supabase session and the role from profiles (via the authenticated client,
// so profiles RLS applies). Roles is an array for CASL/withUserContext parity.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    email: user.email ?? null,
    roles: profile?.role ? [profile.role] : [],
  }
}
