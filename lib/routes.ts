import type { UserRole } from './profile'

export const ROLE_ROUTES: Record<UserRole, readonly string[] | '*'> = {
  guest: ['/apps', '/orders', '/settings'],
  member: ['/apps', '/orders', '/settings'],
  admin: '*',
  owner: '*',
  system: '*',
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role]
  if (allowed === '*') return true
  return allowed.some((route) => pathname === route || pathname.startsWith(route + '/'))
}
