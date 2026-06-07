import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { recordSignIn } from './auth-events'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    signIn: recordSignIn,
  },
})
