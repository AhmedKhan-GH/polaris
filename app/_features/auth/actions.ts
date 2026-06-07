'use server'

import { signIn, signOut } from '@/lib/auth'

export async function signInAction() {
  await signIn('keycloak', { redirectTo: '/dashboard' })
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' })
}
