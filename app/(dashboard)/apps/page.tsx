import Link from 'next/link'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

interface AppTile {
  label: string
  description: string
  href: string
  check: (ability: ReturnType<typeof defineAbilityFor>) => boolean
}

const APPS: AppTile[] = [
  {
    label: 'Draft Orders',
    description: 'Create and manage draft orders',
    href: '/draft-orders',
    check: (ability) => ability.can('read', 'DraftOrder'),
  },
  {
    label: 'Manage Orders',
    description: 'Track and transition orders through the pipeline',
    href: '/orders',
    check: (ability) => ability.can('read', 'Order'),
  },
  {
    label: 'Settings',
    description: 'Team accounts and system configuration',
    href: '/settings',
    check: (ability) => ability.can('manage', 'Settings'),
  },
]

export default async function AppsPage() {
  const profile = (await getProfile())!
  const ability = defineAbilityFor(profile.role)
  const visibleApps = APPS.filter((app) => app.check(ability))

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-center text-lg font-semibold text-zinc-100">
          Polaris
        </h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {visibleApps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="text-sm font-medium text-zinc-100 group-hover:text-white">
                {app.label}
              </div>
              <div className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-400">
                {app.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
