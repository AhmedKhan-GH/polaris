import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/profile'
import { SettingsPage } from '@/app/_features/settings/SettingsPage'

export default async function Page() {
  const profile = await getProfile()
  if (!profile) notFound()

  return <SettingsPage profile={profile} />
}
