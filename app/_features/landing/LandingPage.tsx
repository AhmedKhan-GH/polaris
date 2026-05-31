import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '@/app/_features/shell/PageHeader'

export function LandingPage({ user }: { user: User | null }) {
  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <PageHeader user={user} />
      <main className="flex flex-1 w-full max-w-3xl mx-auto flex-col items-center justify-between py-32 px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/zeefoods-logo.svg" alt="Zee Foods logo" width={300} height={387} />
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Polaris
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Cold chain logistics platform.
          </p>
        </div>
        {user && (
          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
            <Link
              href="/dashboard"
              className="flex h-12 items-center justify-center rounded-lg bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Dashboard
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
