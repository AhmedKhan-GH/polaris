import type { NextAuthConfig } from 'next-auth'
import Keycloak from 'next-auth/providers/keycloak'

// Provider/config only — no NextAuth() instantiation here, so this module
// stays free of the Next server runtime and is safe to import in tests/edge.
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    // Persist the Keycloak id_token so sign-out can perform RP-initiated
    // logout (id_token_hint) against Keycloak's end-session endpoint.
    async jwt({ token, account }) {
      if (account?.id_token) {
        ;(token as Record<string, unknown>).idToken = account.id_token
      }
      return token
    },
    async session({ session, token }) {
      ;(session as { idToken?: string }).idToken = (
        token as Record<string, unknown>
      ).idToken as string | undefined
      return session
    },
  },
}
