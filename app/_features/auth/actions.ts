'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signIn, signOut } from '@/lib/auth'
import { authEnv } from '@/lib/env-auth'

// Validate the request headers used to build the post-logout redirect origin.
// `.catch` keeps logout resilient while constraining the scheme — a forged
// x-forwarded-proto can't inject javascript:/data: into the redirect URL.
const OriginHeaders = z.object({
  proto: z.enum(['http', 'https']).catch('http'),
  host: z.string().min(1).catch('localhost:3000'),
})

export async function signInAction() {
  await signIn('keycloak', { redirectTo: '/dashboard' })
}

export async function signOutAction() {
  const session = await auth()
  const idToken = (session as { idToken?: string } | null)?.idToken

  const headerList = await headers()
  const { proto, host } = OriginHeaders.parse({
    proto: headerList.get('x-forwarded-proto'),
    host: headerList.get('host'),
  })
  const origin = `${proto}://${host}`

  // Clear the app session, then end the Keycloak SSO session so a later
  // login requires credentials again (signOut alone leaves Keycloak logged in).
  await signOut({ redirect: false })

  const endSession = new URL(
    `${authEnv.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`,
  )
  if (idToken) endSession.searchParams.set('id_token_hint', idToken)
  endSession.searchParams.set('post_logout_redirect_uri', `${origin}/`)

  redirect(endSession.toString())
}
