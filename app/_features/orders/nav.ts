import type { NavItem } from '@/lib/registry/nav';

/**
 * Orders dashboard navigation entry. Deliberately UNGATED (no `permission`):
 * every rep has orders (their own; owners read all), so the dashboard shows this
 * link to everyone. Wired into the chrome through lib/registry/nav.
 */
export const ordersNav: NavItem = {
  label: 'Orders',
  href: '/orders',
};
