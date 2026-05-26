import type { UserRole } from '../profile'
import { orderPermissions } from './subjects/order'
import { settingsPermissions } from './subjects/settings'

export interface ActionRule {
  roles: readonly UserRole[]
}

export type SubjectPermissions = Record<string, ActionRule>

export type PermissionSchema = Record<string, SubjectPermissions>

export const permissions = {
  Order: orderPermissions,
  Settings: settingsPermissions,
} as const satisfies PermissionSchema

export type Subject = keyof typeof permissions
export type Action = {
  [S in Subject]: keyof (typeof permissions)[S]
}[Subject]
