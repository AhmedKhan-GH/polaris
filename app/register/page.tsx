import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase/server'
import { RegisterForm } from '@/app/_features/auth/RegisterForm'

export default async function RegisterPage() {
  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <main className="mx-auto mt-32 w-full max-w-sm px-6">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        &larr; Back
      </Link>
      <h1 className="mb-6 text-xl font-semibold text-zinc-50">Create account</h1>
      <RegisterForm />
      <p className="mt-4 text-sm text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-zinc-300 hover:text-zinc-100">
          Sign in
        </Link>
      </p>
    </main>
  )
}
