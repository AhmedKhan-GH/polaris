import type { UserRole } from './profile'

/**
 * Route allowlist — the single source of truth for page access.
 *
 * HOW TO USE:
 * - When you create a new page, add its path to the roles that should access it.
 * - '*' means all authenticated routes are allowed (admin/owner).
 * - If a route is NOT listed for a role, that role gets redirected to /apps.
 * - Public routes (login, register, landing) are handled separately in middleware.
 *
 * ADDING A NEW ROUTE:
 * 1. Create the page file (e.g. app/(dashboard)/(supply-chain)/catalog/page.tsx)
 * 2. Add '/catalog' to the appropriate role arrays below
 * 3. That's it — middleware enforces access, tiles auto-filter by role
 */
export const ROLE_ROUTES: Record<UserRole, readonly string[] | '*'> = {
  guest: [
    '/apps',
    '/orders',
    '/fulfillment',
    '/accounting',
    '/settings',
  ],

  member: [
    '/apps',
    '/orders',
    '/fulfillment',
    '/accounting',
    '/customers',
    '/inventory',
    '/procurement',
    '/disposal',
    '/personnel',
    '/providers',
    '/assets',
    '/equipment',
    '/locations',
    '/sales',
    '/settings',
  ],

  admin: '*',
  owner: '*',
  system: '*',
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role]
  if (allowed === '*') return true
  return allowed.some((route) => pathname === route || pathname.startsWith(route + '/'))
}
