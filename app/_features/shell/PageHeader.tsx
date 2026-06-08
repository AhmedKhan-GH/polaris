import Link from 'next/link'
import type { AuthUser } from '@/lib/auth/user'
import { signInAction, signOutAction } from '@/app/_features/auth/actions'

export function PageHeader({ user }: { user: AuthUser | null }) {
  return (
    <header className="w-full border-b border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-16 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          Polaris
        </Link>
        {user ? (
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-lg border border-black/[.08] px-5 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Log out
            </button>
          </form>
        ) : (
          <form action={signInAction}>
            <button
              type="submit"
              className="flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Log in
            </button>
          </form>
        )}
      </div>
    </header>
  )
}
