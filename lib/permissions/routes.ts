import type { UserRole } from '../profile'
import { permissions } from './schema'

const routeToSubject: Record<string, string> = {
  '/orders': 'Order',
  '/settings': 'Settings',
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const base = '/' + pathname.split('/').filter(Boolean)[0]

  if (base === '/apps') return true

  const subject = routeToSubject[base]
  if (!subject) return false

  const subjectPermissions = permissions[subject as keyof typeof permissions]
  if (!subjectPermissions) return false

  return Object.values(subjectPermissions).some((rule) =>
    rule.roles.includes(role),
  )
}
