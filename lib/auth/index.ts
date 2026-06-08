import NextAuth from 'next-auth'
import { authConfig } from './config'
import { recordSignIn } from './events'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    signIn: recordSignIn,
  },
})
