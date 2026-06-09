import { getSessionUser } from '@/lib/auth/session'
import { PageHeader } from '@/app/_features/shell/PageHeader'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser()

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <PageHeader user={session ? { email: session.email } : null} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-16 py-8">{children}</main>
    </div>
  )
}
