import { notFound } from 'next/navigation'
import { SkuManagement } from '@/app/_features/settings/SkuManagement'
import { defineAbilityFor } from '@/lib/abilities'
import { findSkus } from '@/lib/db/orderLineItemRepository'
import { getProfile } from '@/lib/profile'

export default async function InventoryPage() {
  const profile = await getProfile()
  if (!profile) notFound()

  const ability = defineAbilityFor(profile.role)
  if (!ability.can('read', 'Sku')) notFound()

  const skus = await findSkus()
  const canManage = ability.can('manage', 'Sku')

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-50">Inventory</h1>
        <p className="mt-1 text-sm text-zinc-400">
          SKU catalog for every item the company carries.
        </p>
      </header>

      <SkuManagement
        initialSkus={skus}
        canManage={canManage}
        className="min-h-0"
      />
    </div>
  )
}
