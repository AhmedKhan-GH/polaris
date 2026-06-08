import Link from 'next/link'
import { auth } from '@/lib/auth'
import { defineAbilityFor } from '@/lib/permissions/ability'

export default async function DashboardPage() {
  const session = await auth()
  const roles = (session as { roles?: string[] } | null)?.roles ?? []
  const canViewActivity = defineAbilityFor(roles).can('read', 'SignInLog')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <nav className="flex flex-wrap gap-3">
        {/* Orders: available to every signed-in user (rows are scoped). */}
        <Link
          href="/orders"
          className="flex h-12 w-fit items-center justify-center rounded-lg bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Orders
        </Link>
        {/* Activity (sign-in log): owners only. */}
        {canViewActivity && (
          <Link
            href="/activity"
            className="flex h-12 w-fit items-center justify-center rounded-lg border border-black/[.08] px-5 text-base font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Activity
          </Link>
        )}
      </nav>
    </div>
  )
}
