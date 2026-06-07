import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'
import { authRedirect } from '@/lib/route-guard'

// Edge-safe auth instance built from the shared config only — never imports the
// Node-only lib/auth (which pulls node-postgres via events). Canonical Auth.js
// edge/node split.
const { auth } = NextAuth(authConfig)

export default auth((request) => {
  const target = authRedirect(!!request.auth?.user, request.nextUrl.pathname)
  if (target) {
    return NextResponse.redirect(new URL(target, request.nextUrl))
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
}
