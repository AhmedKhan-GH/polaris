import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { defineAbilityFor } from '@/lib/permissions/ability'
import { getSignInLog } from '@/app/_features/activity/getSignInLog'

export default async function ActivityPage() {
  const session = await auth()
  const roles = session?.roles ?? []

  // Non-owners get redirected (the guard in getSignInLog is the real backstop).
  if (!defineAbilityFor(roles).can('read', 'SignInLog')) {
    redirect('/dashboard')
  }

  const rows = await getSignInLog()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign-in log</h1>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-black/[.08] dark:border-white/[.145]">
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 font-medium">When (UTC)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-black/[.04] dark:border-white/[.08]"
            >
              <td className="py-2 pr-4">{row.email}</td>
              <td className="py-2 pr-4 font-mono text-xs">
                {row.userId ?? '—'}
              </td>
              <td className="py-2">{row.createdAt.toISOString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-2 text-zinc-500" colSpan={3}>
                No sign-ins recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
