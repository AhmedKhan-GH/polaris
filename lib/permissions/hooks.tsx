'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { UserRole } from '../profile'
import { defineAbilityFor, type AppAbility } from './abilities'

interface AbilityContextValue {
  ability: AppAbility
  role: UserRole
}

const AbilityContext = createContext<AbilityContextValue | null>(null)

export function AbilityProvider({
  role,
  children,
}: {
  role: UserRole
  children: ReactNode
}) {
  const ability = defineAbilityFor(role)
  return (
    <AbilityContext value={{ ability, role }}>
      {children}
    </AbilityContext>
  )
}

export function useAbility(): AbilityContextValue {
  const ctx = useContext(AbilityContext)
  if (!ctx) throw new Error('useAbility must be used within AbilityProvider')
  return ctx
}
