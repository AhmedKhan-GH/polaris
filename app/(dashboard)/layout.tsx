import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/app/_features/shell/PageHeader'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col flex-1 bg-zinc-50 font-sans dark:bg-black">
      <PageHeader user={user} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-16 py-8">{children}</main>
    </div>
  )
}
