import { getServerSupabase } from '@/lib/supabase/server'
import { SignOutForm } from './SignOutForm'

export async function AuthBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      {/* Padding on the outer band, overflow on the inner alignment
          row, so the form clips at the inside of the page padding
          instead of bleeding past it when the email + button row gets
          wider than the viewport. */}
      <div className="flex justify-end overflow-hidden">
        <SignOutForm email={user.email} />
      </div>
    </div>
  )
}
