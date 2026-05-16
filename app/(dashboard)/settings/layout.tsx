import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('manage', 'Settings')) notFound()

  return children
}
