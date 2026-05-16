import type { UserRole } from './profile'

export const ROLE_LABELS: Record<UserRole, string> = {
  system: 'System',
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
}

export const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  system: 'bg-red-900/50 text-red-300',
  owner: 'bg-amber-900/50 text-amber-300',
  admin: 'bg-blue-900/50 text-blue-300',
  member: 'bg-zinc-800 text-zinc-300',
  guest: 'bg-zinc-800/50 text-zinc-500',
}
