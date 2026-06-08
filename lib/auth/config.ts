import type { NextAuthConfig } from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'
import { z } from 'zod'
import { authEnv } from '@/lib/env/auth'

// The Keycloak claims we read are external data — validate their shape rather
// than `as`-casting. safeParse + fallback keeps login resilient: a malformed
// claim degrades (e.g. roles → []) instead of leaking a raw value that would
// crash downstream `.includes`/`.join`.
const ProfileClaims = z.object({
  sub: z.string().optional(),
  roles: z.array(z.string()).optional(),
})
const SessionClaims = z.object({
  idToken: z.string().optional(),
  roles: z.array(z.string()).optional(),
  userId: z.string().optional(),
})

// Provider/config only — no NextAuth() instantiation here, so this module
// stays free of the Next server runtime and is safe to import in tests/edge.
// Provider env comes from the validated, edge-safe authEnv (t3-env).
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Keycloak({
      clientId: authEnv.AUTH_KEYCLOAK_ID,
      clientSecret: authEnv.AUTH_KEYCLOAK_SECRET,
      issuer: authEnv.AUTH_KEYCLOAK_ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // Persist the Keycloak id_token so sign-out can perform RP-initiated
    // logout (id_token_hint) against Keycloak's end-session endpoint.
    async jwt({ token, account, profile }) {
      const t = token as Record<string, unknown>
      if (account?.id_token) t.idToken = account.id_token
      const claims = profile ? (ProfileClaims.safeParse(profile).data ?? {}) : {}
      if (profile) t.roles = claims.roles ?? []
      if (account?.providerAccountId || claims.sub) {
        t.userId = account?.providerAccountId ?? claims.sub
      }
      return token
    },
    async session({ session, token }) {
      const claims = SessionClaims.safeParse(token).data ?? {}
      // Local write-cast where the session is assembled (the augmented fields
      // are optional on reads but NextAuth types them strictly on the callback
      // param). Readers elsewhere use the typed session — no casts.
      const s = session as { idToken?: string; roles?: string[]; userId?: string }
      s.idToken = claims.idToken
      s.roles = claims.roles ?? []
      s.userId = claims.userId
      return session
    },
  },
}
