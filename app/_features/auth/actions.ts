'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signIn, signOut } from '@/lib/auth'

export async function signInAction() {
  await signIn('keycloak', { redirectTo: '/dashboard' })
}

export async function signOutAction() {
  const session = await auth()
  const idToken = (session as { idToken?: string } | null)?.idToken

  const headerList = await headers()
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  const host = headerList.get('host') ?? 'localhost:3000'
  const origin = `${proto}://${host}`

  // Clear the app session, then end the Keycloak SSO session so a later
  // login requires credentials again (signOut alone leaves Keycloak logged in).
  await signOut({ redirect: false })

  const endSession = new URL(
    `${process.env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`,
  )
  if (idToken) endSession.searchParams.set('id_token_hint', idToken)
  endSession.searchParams.set('post_logout_redirect_uri', `${origin}/`)

  redirect(endSession.toString())
}
