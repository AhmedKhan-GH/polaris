import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { type UserRole } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'
import { ROLE_LABELS, ROLE_BADGE_COLORS } from '@/lib/roles'
import { CreateAccountForm } from './CreateAccountForm'
import { ResetPasswordButton } from './ResetPasswordButton'

interface TeamMember {
  id: string
  email: string
  role: UserRole
  createdAt: number
}

async function getTeamMembers(): Promise<TeamMember[]> {
  const rows = await db.execute<{
    id: string
    email: string
    role: UserRole
    created_at: string
  }>(sql`
    SELECT p.id, u.email, p.role, p.created_at
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at ASC
  `)
  return rows.rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: Number(r.created_at),
  }))
}

interface SettingsPageProps {
  profile: { id: string; role: UserRole }
}

export async function SettingsPage({ profile }: SettingsPageProps) {
  const ability = defineAbilityFor(profile.role)
  const canManageTeam = ability.can('manage', 'Settings')
  const members = canManageTeam ? await getTeamMembers() : []

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-1 text-xl font-semibold text-zinc-50">Settings</h1>

      {canManageTeam && (
        <>
      <h2 className="mt-8 mb-1 text-lg font-semibold text-zinc-50">Team</h2>
      <p className="mb-8 text-sm text-zinc-400">
        {members.length} {members.length === 1 ? 'account' : 'accounts'}
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-400">Email</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Role</th>
              {profile.role === 'system' && (
                <th className="px-4 py-3 font-medium text-zinc-400">Password</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-zinc-200">{m.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_COLORS[m.role]}`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                </td>
                {profile.role === 'system' && (
                  <td className="px-4 py-3">
                    <ResetPasswordButton userId={m.id} email={m.email} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile.role === 'system' && (
        <section className="mt-12">
          <h2 className="mb-1 text-lg font-semibold text-zinc-50">
            Create new account
          </h2>
          <p className="mb-6 text-sm text-zinc-400">
            The new user will be able to sign in immediately.
          </p>
          <CreateAccountForm />
        </section>
      )}
        </>
      )}
    </main>
  )
}
