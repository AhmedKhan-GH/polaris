import type { NavItem } from '@/lib/registry/nav';

/**
 * Brand & Identity dashboard nav entry. Deliberately UNGATED (no `permission`):
 * the canonical brand reference is for everyone — web, sales, marketing, design —
 * so every authenticated user sees this link, mirroring Products. Wired into the
 * chrome through lib/registry/nav.
 */
export const brandNav: NavItem = {
  label: 'Brand',
  href: '/brand',
};
