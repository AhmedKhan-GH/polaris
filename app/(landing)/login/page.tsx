import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { LoginForm } from '@/app/_features/auth/LoginForm'

export default async function LoginPage() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/apps')
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      <div className="overflow-hidden">
        <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          &larr; Back
        </Link>
        <h1 className="mb-6 text-xl font-semibold text-zinc-50">Sign in</h1>
        <LoginForm />
      </div>
    </main>
  )
}
