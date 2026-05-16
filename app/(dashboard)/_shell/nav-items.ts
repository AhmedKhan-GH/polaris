import type { AppAbility } from '@/lib/abilities'

export interface NavItem {
  label: string
  href: string
}

interface NavItemDef extends NavItem {
  check: (ability: AppAbility) => boolean
}

const NAV_ITEMS: NavItemDef[] = [
  {
    label: 'Orders',
    href: '/',
    check: (ability) => ability.can('read', 'Order'),
  },
  {
    label: 'Settings',
    href: '/settings/team',
    check: (ability) => ability.can('manage', 'Settings'),
  },
]

export function getVisibleNavItems(ability: AppAbility): NavItem[] {
  return NAV_ITEMS
    .filter((item) => item.check(ability))
    .map(({ label, href }) => ({ label, href }))
}
