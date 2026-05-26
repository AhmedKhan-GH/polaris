import { ForbiddenError } from '@casl/ability'
import { getProfile, type Profile } from '../profile'
import { defineAbilityFor, type AppAbility } from './abilities'
import type { Action, Subject } from './schema'

interface PermissionContext {
  ability: AppAbility
  profile: Profile
}

export async function withPermission<T>(
  action: Action,
  subject: Subject,
  fn: (ctx: PermissionContext) => Promise<T>,
): Promise<T> {
  const profile = await getProfile()
  if (!profile) throw new Error('Unauthenticated')

  const ability = defineAbilityFor(profile.role)
  ForbiddenError.from(ability).throwUnlessCan(action, subject)

  return fn({ ability, profile })
}
