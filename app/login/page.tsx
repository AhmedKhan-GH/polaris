import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'

async function signIn(formData: FormData) {
  'use server'
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)
  redirect('/')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      <h1 className="mb-6 text-xl font-semibold text-zinc-50">Sign in</h1>
      {error && (
        <p className="mb-3 text-sm text-red-400">{decodeURIComponent(error)}</p>
      )}
      <form
        action={signIn}
        className="flex flex-col gap-3"
        suppressHydrationWarning
      >
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          autoComplete="email"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
        <button
          type="submit"
          className="rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-opacity hover:bg-zinc-200"
        >
          Sign in
        </button>
      </form>
    </main>
  )
}
