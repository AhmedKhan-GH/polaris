import 'next-auth'

// Custom claims we attach to the session in the jwt/session callbacks
// (lib/auth.config.ts). Declaring them here means readers get `session.userId`
// / `session.roles` / `session.idToken` typed — no `(session as { … })` casts.
declare module 'next-auth' {
  interface Session {
    userId?: string
    roles?: string[]
    idToken?: string
  }
}
