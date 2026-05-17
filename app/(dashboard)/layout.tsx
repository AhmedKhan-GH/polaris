import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/profile'
import { AppTopBar } from '@/app/_features/shell/AppTopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="flex h-full flex-col">
      <AppTopBar />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
