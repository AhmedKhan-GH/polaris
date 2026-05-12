import Link from 'next/link'
import { getServerSupabase } from '@/lib/supabase/server'
import { getProfile } from '@/lib/profile'
import { Hour12Toggle } from '../preferences/Hour12Toggle'
import { TimezoneSelector } from '../preferences/TimezoneSelector'
import { SignOutForm } from './SignOutForm'

export async function AuthBar() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  const profile = await getProfile()

  return (
    <div className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-6 py-2">
      <div className="flex justify-end items-center gap-4 overflow-hidden">
        {(profile?.role === 'sysadmin' || profile?.role === 'owner') && (
          <Link
            href="/settings/team"
            className="whitespace-nowrap text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Team
          </Link>
        )}
        <Hour12Toggle />
        <TimezoneSelector />
        <SignOutForm email={user.email} />
      </div>
    </div>
  )
}
