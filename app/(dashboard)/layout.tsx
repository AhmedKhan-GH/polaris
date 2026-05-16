import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'
import { getVisibleNavItems } from './_shell/nav-items'
import { AppSidebar } from './_shell/AppSidebar'
import { AppTopBar } from './_shell/AppTopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) redirect('/no-access')

  const ability = defineAbilityFor(profile.role)
  const visibleNav = getVisibleNavItems(ability)

  return (
    <div className="flex h-full">
      <AppSidebar items={visibleNav} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopBar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
