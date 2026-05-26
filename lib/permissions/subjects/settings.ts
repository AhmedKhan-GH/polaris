import type { SubjectPermissions } from '../schema'

export const settingsPermissions = {
  manage: { roles: ['owner', 'system'] },
} as const satisfies SubjectPermissions
