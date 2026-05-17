import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { ROLE_LABELS, ROLE_BADGE_COLORS } from '@/lib/roles'
import { Hour12Toggle } from '@/app/_features/preferences/Hour12Toggle'
import { TimezoneSelector } from '@/app/_features/preferences/TimezoneSelector'
import { SignOutForm } from '@/app/_features/auth/SignOutForm'
import { BackLink } from './BackLink'

export async function AppTopBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const profile = await getProfile()

  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex items-center gap-4 overflow-hidden">
        <BackLink />
        <div className="flex-1" />
        <Hour12Toggle />
        <TimezoneSelector />
        <div className="flex shrink-0 items-center gap-2">
          <span className="whitespace-nowrap text-sm text-zinc-400">{user.email}</span>
          {profile && (
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[profile.role]}`}>
              {ROLE_LABELS[profile.role]}
            </span>
          )}
        </div>
        <SignOutForm />
      </div>
    </header>
  )
}
