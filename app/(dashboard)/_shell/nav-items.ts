import type { AppAbility } from '@/lib/abilities'

export interface NavItem {
  label: string
  href: string
  check: (ability: AppAbility) => boolean
}

export const NAV_ITEMS: NavItem[] = [
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
  return NAV_ITEMS.filter((item) => item.check(ability))
}
