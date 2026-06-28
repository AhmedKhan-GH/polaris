import type { NavItem } from '@/lib/registry/nav';

/**
 * Orders dashboard navigation entry. Deliberately UNGATED (no `permission`):
 * every signed-in user has orders (a member their own; owner/admin all), so the
 * dashboard shows this link to everyone. Wired into the chrome through
 * lib/registry/nav.
 */
export const ordersNav: NavItem = {
  label: 'Orders',
  href: '/orders',
};
