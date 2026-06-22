import type { NavItem } from '@/lib/registry/nav';

/**
 * Products dashboard navigation entry. Deliberately UNGATED (no `permission`):
 * catalog read is unconditional, so every authenticated user sees this link —
 * the page itself shows the owner-only create/edit/retire controls. Wired into
 * the chrome through lib/registry/nav.
 */
export const productsNav: NavItem = {
  label: 'Products',
  href: '/products',
};
