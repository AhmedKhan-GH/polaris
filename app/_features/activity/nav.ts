import type { NavItem } from '@/lib/registry/nav';

/**
 * Activity dashboard navigation entry. Gated by the same `read SignInLog`
 * permission its page enforces, so the dashboard renders this link only for an
 * owner. Wired into the chrome through lib/registry/nav.
 */
export const activityNav: NavItem = {
  label: 'Activity',
  href: '/activity',
  permission: { action: 'read', subject: 'SignInLog' },
};
