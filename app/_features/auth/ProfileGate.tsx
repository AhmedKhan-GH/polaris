import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'

export async function ProfileGate({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return <>{children}</>

  const profile = await getProfile()
  if (!profile) redirect('/no-access')

  return <>{children}</>
}
