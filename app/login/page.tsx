import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/app/_features/auth';
import { getServerSupabase } from '@/lib/supabase/server';

/**
 * The sign-in route. An already-authenticated visitor has no business here, so
 * we resolve the user server-side first and bounce them to the dashboard before
 * rendering anything. (The redirect's behaviour is covered by the Task 23 E2E
 * suite — a recorded deviation — rather than a unit test for this page.)
 */
export default async function LoginPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <LoginForm />
    </main>
  );
}
