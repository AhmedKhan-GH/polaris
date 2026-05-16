import { getServerSupabase } from '@/lib/supabase/server'
import { Hour12Toggle } from '@/app/_features/preferences/Hour12Toggle'
import { TimezoneSelector } from '@/app/_features/preferences/TimezoneSelector'
import { SignOutForm } from '@/app/_features/auth/SignOutForm'

export async function AppTopBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex justify-end items-center gap-4 overflow-hidden">
        <Hour12Toggle />
        <TimezoneSelector />
        <SignOutForm email={user.email} />
      </div>
    </div>
  )
}
