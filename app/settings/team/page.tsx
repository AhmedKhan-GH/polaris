import { redirect } from 'next/navigation'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { profiles } from '@/lib/schema'
import { getProfile, type UserRole } from '@/lib/profile'

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

const ROLE_LABELS: Record<UserRole, string> = {
  sysadmin: 'Sysadmin',
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
}

const ROLE_COLORS: Record<UserRole, string> = {
  sysadmin: 'bg-red-900/50 text-red-300',
  owner: 'bg-amber-900/50 text-amber-300',
  admin: 'bg-blue-900/50 text-blue-300',
  member: 'bg-zinc-800 text-zinc-300',
  guest: 'bg-zinc-800/50 text-zinc-500',
}

export default async function TeamPage() {
  const profile = await getProfile()
  if (!profile) redirect('/no-access')
  if (profile.role !== 'sysadmin' && profile.role !== 'owner') redirect('/')

  const members = await getTeamMembers()

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-1 text-xl font-semibold text-zinc-50">Team</h1>
      <p className="mb-8 text-sm text-zinc-400">
        {members.length} {members.length === 1 ? 'account' : 'accounts'}
      </p>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-400">Email</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-zinc-200">{m.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
