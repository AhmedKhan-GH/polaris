import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { log } from '@/lib/log'

async function signOut() {
  'use server'
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.auth.signOut()
  if (user) {
    log.info({ email: user.email, userId: user.id }, 'logout succeeded')
  }
  redirect('/login')
}

interface SignOutFormProps {
  email: string
}

export function SignOutForm({ email }: SignOutFormProps) {
  return (
    <form action={signOut} className="flex items-center gap-3">
      <span className="text-sm text-zinc-400">{email}</span>
      <button
        type="submit"
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Sign out
      </button>
    </form>
  )
}
