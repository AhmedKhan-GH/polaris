import Link from 'next/link';

import type { AuthUser } from '@/lib/auth/user';
import { branding } from '@/lib/branding';

import { signOutAction } from '../auth';

/**
 * The shared top-of-page chrome: a brand home link plus an auth affordance.
 *
 * Server component — it carries no interactivity of its own. When authed it
 * renders a sign-out form whose submit button invokes `signOutAction` (the one
 * sanctioned shell -> auth edge); when anonymous it links to the login page.
 * Brand text is read from `@/lib/branding`, never hardcoded.
 */
export function PageHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
      <Link href="/" className="font-semibold tracking-tight">
        {branding.productName}
      </Link>
      {user ? (
        <form action={signOutAction}>
          <button type="submit" className="text-sm">
            Log out
          </button>
        </form>
      ) : (
        <Link href="/login" className="text-sm">
          Log in
        </Link>
      )}
    </header>
  );
}
