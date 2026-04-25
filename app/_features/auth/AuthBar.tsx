import { getServerSupabase } from '@/lib/supabase/server'
import { SignOutForm } from './SignOutForm'

export async function AuthBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  return (
    <div className="shrink-0 flex justify-end border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <SignOutForm email={user.email} />
    </div>
  )
}
