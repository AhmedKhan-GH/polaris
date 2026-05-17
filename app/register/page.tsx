import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { RegisterForm } from '@/app/_features/auth/RegisterForm'

export default async function RegisterPage() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/apps')
  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      <div className="overflow-hidden">
        <h1 className="mb-6 text-xl font-semibold text-zinc-50">Register</h1>
        <RegisterForm />
      </div>
    </main>
  )
}
