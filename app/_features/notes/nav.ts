import type { NavItem } from '@/lib/registry/nav';

/**
 * Notes dashboard navigation entry. Deliberately UNGATED (no `permission`): every
 * authenticated user has a notes page (they read their own, owners read all), so
 * the dashboard shows this link to everyone — contrast the owner-only Activity
 * entry. Wired into the chrome through lib/registry/nav.
 */
export const notesNav: NavItem = {
  label: 'Notes',
  href: '/notes',
};
