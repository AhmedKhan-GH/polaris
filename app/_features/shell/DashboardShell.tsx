import Link from 'next/link'
import { signOutAction } from '@/app/_features/auth/actions'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4 dark:border-white/[.145]">
        <Link href="/" className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          Polaris
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex h-12 items-center justify-center rounded-lg border border-black/[.08] px-5 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
