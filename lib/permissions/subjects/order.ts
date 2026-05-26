import type { SubjectPermissions } from '../schema'

export const orderPermissions = {
  create:     { roles: ['guest', 'member', 'admin', 'owner'] },
  read:       { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
  transition: { roles: ['guest', 'member', 'admin', 'owner', 'system'] },
  discard:    { roles: ['guest', 'member', 'admin', 'owner'] },
  duplicate:  { roles: ['member', 'admin', 'owner'] },
} as const satisfies SubjectPermissions
