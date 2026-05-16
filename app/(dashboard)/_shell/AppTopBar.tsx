import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { Hour12Toggle } from '@/app/_features/preferences/Hour12Toggle'
import { TimezoneSelector } from '@/app/_features/preferences/TimezoneSelector'
import { SignOutForm } from '@/app/_features/auth/SignOutForm'
import { BackLink } from './BackLink'

const ROLE_LABELS: Record<string, string> = {
  system: 'System',
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
}

export async function AppTopBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const profile = await getProfile()

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex items-center gap-4 overflow-hidden">
        <BackLink />
        <div className="flex-1" />
        {profile && (
          <span className="text-xs text-zinc-500">
            {ROLE_LABELS[profile.role]}
          </span>
        )}
        <Hour12Toggle />
        <TimezoneSelector />
        <SignOutForm email={user.email} />
      </div>
    </div>
  )
}
