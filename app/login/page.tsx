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
      <h1 className="mb-6 text-xl font-semibold text-zinc-50">Sign in</h1>
      <LoginForm />
    </main>
  )
}
