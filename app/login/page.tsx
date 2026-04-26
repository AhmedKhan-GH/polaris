import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/')
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      {/* Padding lives on <main>, overflow on the inner wrapper, so
          a too-wide child clips at the inside of the page padding
          rather than bleeding visually into the page margin. Same
          pattern as the orders page shell. */}
      <div className="overflow-hidden">
        <h1 className="mb-6 text-xl font-semibold text-zinc-50">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  )
}
