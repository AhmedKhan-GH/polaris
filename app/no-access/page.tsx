import { getServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NoAccessPage() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-50">No access</h1>
      <p className="text-sm text-zinc-400">
        You are signed in as{' '}
        <span className="text-zinc-200">{user.email}</span>, but your account
        does not have a profile in this system. Contact the account owner to
        get access.
      </p>
      <form action="/auth/signout" method="post" className="mt-6">
        <button
          type="submit"
          className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Sign out
        </button>
      </form>
    </main>
  )
}
