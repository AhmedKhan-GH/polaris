import Link from 'next/link'
import { getProfile } from '@/lib/profile'
import { defineAbilityFor } from '@/lib/abilities'

interface AppTile {
  label: string
  description: string
  href: string
  check: (ability: ReturnType<typeof defineAbilityFor>) => boolean
}

interface AppCategory {
  label: string
  apps: AppTile[]
}

const CATEGORIES: AppCategory[] = [
  {
    label: 'Operations',
    apps: [
      {
        label: 'Orders',
        description: 'Create, track, and manage orders through the pipeline',
        href: '/orders',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Fulfillment',
        description: 'Delivery scheduling, route planning, and dispatch',
        href: '/fulfillment',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Accounting',
        description: 'Invoices, payments, and financial tracking',
        href: '/accounting',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'Supply Chain',
    apps: [
      {
        label: 'Procurement',
        description: 'Suppliers, purchase orders, and receiving',
        href: '/procurement',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Inventory',
        description: 'Products, SKUs, stock levels, and warehouse locations',
        href: '/inventory',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Disposal',
        description: 'Waste management, recycling, equipment retirement, and write-offs',
        href: '/disposal',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'People',
    apps: [
      {
        label: 'Customers',
        description: 'Manage customers, contacts, and communication history',
        href: '/customers',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Personnel',
        description: 'Staff records, scheduling, and workforce management',
        href: '/personnel',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Providers',
        description: 'Service providers — repair technicians, electricians, plumbers',
        href: '/providers',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'Property',
    apps: [
      {
        label: 'Assets',
        description: 'Customer-rented freezers, display cases, and coolers',
        href: '/assets',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Equipment',
        description: 'Internal machinery, vehicles, and maintenance tracking',
        href: '/equipment',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Locations',
        description: 'Warehouses, cold storage, depots, and delivery sites',
        href: '/locations',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'Growth',
    apps: [
      {
        label: 'Branding',
        description: 'Graphic design, style guides, and brand identity',
        href: '/branding',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Marketing',
        description: 'Online ads, social media profiles, and campaigns',
        href: '/marketing',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Sales',
        description: 'Leads, pipelines, proposals, and deal tracking',
        href: '/sales',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'Engineering',
    apps: [
      {
        label: 'Software',
        description: 'Internal tools and platform development',
        href: '/software',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Hardware',
        description: 'Equipment design, electrical, and mechanical engineering',
        href: '/hardware',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Recipes',
        description: 'Food science, recipe development, and nutritional analysis',
        href: '/recipes',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
  {
    label: 'Intelligence',
    apps: [
      {
        label: 'Analytics',
        description: 'Dashboards, KPIs, and business intelligence',
        href: '/analytics',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Augmentation',
        description: 'AI-powered insights, recommendations, and automation',
        href: '/augmentation',
        check: (ability) => ability.can('read', 'Order'),
      },
      {
        label: 'Compliance',
        description: 'Taxes, FDA inspections, food safety, and regulatory records',
        href: '/compliance',
        check: (ability) => ability.can('read', 'Order'),
      },
    ],
  },
]

export default async function AppsPage() {
  const profile = (await getProfile())!
  const ability = defineAbilityFor(profile.role)

  const visibleCategories = CATEGORIES.map((category) => ({
    ...category,
    apps: category.apps.filter((app) => app.check(ability)),
  })).filter((category) => category.apps.length > 0)

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <h1 className="mb-8 text-center text-lg font-semibold text-zinc-100">
          Polaris
        </h1>
        <div className="space-y-6">
          {visibleCategories.map((category, i) => (
            <div key={category.label}>
              {i > 0 && <hr className="mb-6 border-zinc-800" />}
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {category.label}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {category.apps.map((app) => (
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
          ))}
        </div>
      </div>
    </div>
  )
}
